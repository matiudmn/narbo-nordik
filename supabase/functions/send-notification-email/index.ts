import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'Narbo Nordik <club@2nc.fr>';

interface NotificationPayload {
  record: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
  };
}

const SUBJECT_PREFIX: Record<string, string> = {
  new_session: 'Nouvelle seance',
  palmares: 'Palmares',
  vma_update: 'VMA',
  system: 'Info',
  new_athlete: 'Nouvel athlète',
};

// Appelant : uniquement le trigger DB (notify_email_on_insert), qui porte le
// GUC app.settings.service_role_key en Bearer. La passerelle Supabase
// (verify_jwt=true) a deja verifie la signature avant d'invoquer la fonction :
// on lit donc le role du JWT deja authentifie plutot que de comparer sa valeur
// a SUPABASE_SERVICE_ROLE_KEY (le GUC et l'env peuvent diverger silencieusement
// en cas de rotation). La cle anon du bundle porte role 'anon' et est rejetee.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function isServiceRoleCaller(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return payload?.role === 'service_role';
}

serve(async (req) => {
  if (!isServiceRoleCaller(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { record } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, firstname, notification_preferences')
      .eq('id', record.user_id)
      .single();

    if (userError || !user?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'user not found' }), { status: 200 });
    }

    // Check email preference for this notification type
    const prefs = user.notification_preferences || {};
    const typePref = prefs[record.type];
    if (typePref && typePref.email === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'email disabled' }), { status: 200 });
    }

    // Build email
    const subject = `${SUBJECT_PREFIX[record.type] || 'Notification'} — ${record.title}`;
    const html = buildHtml(user.firstname, record.title, record.body, record.link);

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject,
        html,
      }),
    });

    const resData = await res.json();

    return new Response(JSON.stringify({ sent: true, resend: resData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function buildHtml(firstname: string, title: string, body: string, link: string | null): string {
  const cta = link
    ? `<a href="https://narbo-nordik.vercel.app${escapeHtml(link)}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#6CCBE6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Voir dans l'appli</a>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#1a1a2e;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#6CCBE6;font-size:20px;">Narbo Nordik</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Salut ${escapeHtml(firstname)},</p>
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">${escapeHtml(title)}</h2>
      <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>
      ${cta}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Narbo Nordik Running Club — Narbonne</p>
    </div>
  </div>
</body>
</html>`;
}
