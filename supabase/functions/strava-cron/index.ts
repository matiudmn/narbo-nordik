import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!;
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!;
const ENCRYPTION_KEY = Deno.env.get('STRAVA_ENCRYPTION_KEY')!;

// --- Crypto helpers ---

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
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  conn: StravaConnection
): Promise<string | null> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();

  if (expiresAt - now < 5 * 60 * 1000) {
    try {
      const refreshToken = await decrypt(conn.refresh_token_encrypted);
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
        await supabase.from('strava_connections')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', conn.user_id);
        return null;
      }

      await supabase.from('strava_connections').update({
        access_token_encrypted: await encrypt(data.access_token),
        refresh_token_encrypted: await encrypt(data.refresh_token),
        token_expires_at: new Date(data.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', conn.user_id);

      return data.access_token;
    } catch {
      return null;
    }
  }

  try {
    return await decrypt(conn.access_token_encrypted);
  } catch {
    return null;
  }
}

// --- Strava API ---

async function stravaGet(token: string, path: string): Promise<unknown | null> {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  // Verify this is called by service role or cron (check Authorization header)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: { user_id: string; synced: number; error?: string }[] = [];

  // Get all active connections
  const { data: connections } = await supabase
    .from('strava_connections')
    .select('user_id, strava_athlete_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('is_active', true);

  if (!connections || connections.length === 0) {
    return new Response(JSON.stringify({ message: 'No active connections', results: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const after = Math.floor(Date.now() / 1000) - 7 * 24 * 3600; // Last 7 days

  for (const conn of connections) {
    const token = await getValidToken(supabase, conn as StravaConnection);
    if (!token) {
      results.push({ user_id: conn.user_id, synced: 0, error: 'Token invalide' });
      continue;
    }

    const activities = await stravaGet(token, `/athlete/activities?per_page=50&after=${after}`) as Array<Record<string, unknown>> | null;
    if (!activities) {
      results.push({ user_id: conn.user_id, synced: 0, error: 'API Strava erreur' });
      continue;
    }

    let stored = 0;
    for (const act of activities) {
      const { error } = await supabase.from('strava_activities').upsert({
        user_id: conn.user_id,
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

    results.push({ user_id: conn.user_id, synced: stored });
  }

  return new Response(JSON.stringify({
    message: `Synced ${connections.length} connection(s)`,
    results,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
