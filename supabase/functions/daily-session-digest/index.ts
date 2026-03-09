import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'Narbo Nordik <club@2nc.fr>';
const APP_URL = 'https://narbo-nordik.vercel.app';

serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Today's date range (UTC)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Fetch sessions created today
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, title, date, group_id, created_by, preparation_id')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', now.toISOString())
      .order('date', { ascending: true });

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no sessions created today' }), { status: 200 });
    }

    // Fetch all users
    const { data: users } = await supabase
      .from('users')
      .select('id, email, firstname, group_id, role, notification_preferences');

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no users' }), { status: 200 });
    }

    // Fetch user_preparations for preparation-based sessions
    const prepIds = [...new Set(sessions.filter(s => s.preparation_id).map(s => s.preparation_id))];
    const { data: userPreps } = await supabase
      .from('user_preparations')
      .select('user_id, preparation_id')
      .in('preparation_id', prepIds.length > 0 ? prepIds : ['_none_']);

    let sentCount = 0;

    for (const user of users) {
      // Check email preference
      const prefs = user.notification_preferences || {};
      if (prefs.new_session?.email === false) continue;
      if (!user.email) continue;

      // Find sessions relevant to this user
      const userSessions = sessions.filter(s => {
        // Skip sessions created by this user
        if (s.created_by === user.id) return false;
        // Preparation-based session
        if (s.preparation_id) {
          return (userPreps || []).some(
            up => up.user_id === user.id && up.preparation_id === s.preparation_id
          );
        }
        // No group = all users, or matching group, or user is coach
        if (!s.group_id) return true;
        return s.group_id === user.group_id || user.role === 'coach';
      });

      if (userSessions.length === 0) continue;

      const subject = userSessions.length === 1
        ? `Nouvelle seance — ${userSessions[0].title}`
        : `${userSessions.length} nouvelles seances`;

      const html = buildHtml(user.firstname, userSessions);

      await fetch('https://api.resend.com/emails', {
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

      sentCount++;
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const months = ['jan.', 'fev.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'dec.'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function buildHtml(firstname: string, sessions: Array<{ id: string; title: string; date: string }>): string {
  const sessionsList = sessions.map(s =>
    `<li style="margin-bottom:8px;">
      <a href="${APP_URL}/session/${s.id}" style="color:#6CCBE6;text-decoration:none;font-weight:600;">${s.title}</a>
      <span style="color:#6b7280;font-size:13px;"> — ${formatDate(s.date)}</span>
    </li>`
  ).join('');

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
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Salut ${firstname},</p>
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">${sessions.length > 1 ? 'Nouvelles seances' : 'Nouvelle seance'}</h2>
      <p style="margin:0 0 12px;color:#4b5563;font-size:14px;">${sessions.length > 1 ? `${sessions.length} seances ont ete ajoutees aujourd'hui :` : 'Une seance a ete ajoutee aujourd\'hui :'}</p>
      <ul style="margin:0;padding:0 0 0 16px;color:#4b5563;font-size:14px;line-height:1.8;">
        ${sessionsList}
      </ul>
      <a href="${APP_URL}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#6CCBE6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ouvrir l'appli</a>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Narbo Nordik Running Club — Narbonne</p>
    </div>
  </div>
</body>
</html>`;
}
