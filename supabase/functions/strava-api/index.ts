import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!;
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!;
const ENCRYPTION_KEY = Deno.env.get('STRAVA_ENCRYPTION_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Crypto helpers (same as strava-auth) ---

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(ENCRYPTION_KEY), 'AES-GCM', false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encrypted: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(ENCRYPTION_KEY), 'AES-GCM', false, ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// --- Token refresh ---

interface StravaConnection {
  user_id: string;
  strava_athlete_id: number;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  scope_granted: string;
  connected_at: string;
  is_active: boolean;
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ token: string; stravaAthleteId: number }> {
  const { data: conn, error } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !conn) throw new Error('Aucune connexion Strava active');

  const connection = conn as StravaConnection;
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();

  // Refresh if expiring within 5 minutes
  if (expiresAt - now < 5 * 60 * 1000) {
    const refreshToken = await decrypt(connection.refresh_token_encrypted);
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await res.json();
    if (data.errors || !data.access_token) {
      // Token revoked by user on Strava
      await supabase.from('strava_connections')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      throw new Error('Connexion Strava expiree, veuillez vous reconnecter');
    }

    await supabase.from('strava_connections').update({
      access_token_encrypted: await encrypt(data.access_token),
      refresh_token_encrypted: await encrypt(data.refresh_token),
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return { token: data.access_token, stravaAthleteId: connection.strava_athlete_id };
  }

  return {
    token: await decrypt(connection.access_token_encrypted),
    stravaAthleteId: connection.strava_athlete_id,
  };
}

// --- Strava API caller ---

async function stravaGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 429) {
    throw new Error('Limite API Strava atteinte, reessayez dans quelques minutes');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava API error ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Auth helper ---

function getUserIdFromJwt(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromJwt(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Non authentifie' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, target_user_id } = body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Coaches can query other athletes' data
    const effectiveUserId = target_user_id || userId;
    if (target_user_id && target_user_id !== userId) {
      const { data: caller } = await supabase
        .from('users').select('role').eq('id', userId).single();
      if (!caller || caller.role !== 'coach') {
        return new Response(JSON.stringify({ error: 'Acces refuse' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // --- STATUS (no Strava API call needed) ---
    if (action === 'status') {
      const { data: conn } = await supabase
        .from('strava_connections')
        .select('strava_athlete_id, scope_granted, connected_at, is_active, updated_at')
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .single();

      return new Response(JSON.stringify({ connected: !!conn, connection: conn }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- All other actions require a valid Strava token ---
    const { token, stravaAthleteId } = await getValidToken(supabase, effectiveUserId);

    if (action === 'athlete_stats') {
      const stats = await stravaGet(token, `/athletes/${stravaAthleteId}/stats`);
      return new Response(JSON.stringify(stats), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'athlete_zones') {
      const zones = await stravaGet(token, '/athlete/zones');
      return new Response(JSON.stringify(zones), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'recent_activities') {
      const perPage = body.per_page || 5;
      const activities = await stravaGet(token, `/athlete/activities?per_page=${perPage}`);
      return new Response(JSON.stringify(activities), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync_activities') {
      const perPage = body.per_page || 30;
      const after = body.after || Math.floor(Date.now() / 1000) - 90 * 24 * 3600; // 90 days default
      const activities = await stravaGet(
        token,
        `/athlete/activities?per_page=${perPage}&after=${after}`
      ) as Array<Record<string, unknown>>;

      let stored = 0;
      for (const act of activities) {
        const { error } = await supabase.from('strava_activities').upsert({
          user_id: effectiveUserId,
          strava_activity_id: act.id,
          sport_type: act.sport_type || act.type,
          name: act.name,
          distance_meters: act.distance,
          moving_time_seconds: act.moving_time,
          elapsed_time_seconds: act.elapsed_time,
          average_speed: act.average_speed,
          max_speed: act.max_speed,
          average_heartrate: act.average_heartrate,
          max_heartrate: act.max_heartrate,
          average_cadence: act.average_cadence,
          total_elevation_gain: act.total_elevation_gain,
          suffer_score: act.suffer_score,
          calories: act.calories,
          device_name: act.device_name,
          start_date: act.start_date,
          start_date_local: act.start_date_local,
          raw_payload: act,
        }, { onConflict: 'strava_activity_id' });
        if (!error) stored++;
      }

      return new Response(JSON.stringify({ synced: stored, total: activities.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Action inconnue' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('expiree') ? 401 : message.includes('Limite') ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
