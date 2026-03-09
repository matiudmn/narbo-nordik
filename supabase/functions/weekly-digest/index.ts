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

    // Date range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString().split('T')[0];

    // Fetch sessions from last week
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, title, date')
      .gte('date', weekAgoISO)
      .order('date', { ascending: true });

    // Fetch race results from last week
    const { data: races } = await supabase
      .from('race_results')
      .select('id, race_name, user_id, distance_km, time_duration, date')
      .gte('created_at', weekAgo.toISOString())
      .order('date', { ascending: false });

    // Fetch upcoming sessions (next 7 days)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayISO = now.toISOString().split('T')[0];
    const nextWeekISO = nextWeek.toISOString().split('T')[0];

    const { data: upcoming } = await supabase
      .from('sessions')
      .select('id, title, date')
      .gte('date', todayISO)
      .lte('date', nextWeekISO)
      .order('date', { ascending: true });

    // Nothing to report
    if ((!sessions || sessions.length === 0) && (!races || races.length === 0) && (!upcoming || upcoming.length === 0)) {
      return new Response(JSON.stringify({ sent: 0, reason: 'nothing to report' }), { status: 200 });
    }

    // Fetch all users with weekly_digest email enabled
    const { data: users } = await supabase
      .from('users')
      .select('id, email, firstname, notification_preferences')
      .eq('role', 'athlete');

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no users' }), { status: 200 });
    }

    // Fetch user names for race results
    const raceUserIds = [...new Set((races || []).map(r => r.user_id))];
    const { data: raceUsers } = await supabase
      .from('users')
      .select('id, firstname, lastname')
      .in('id', raceUserIds.length > 0 ? raceUserIds : ['_none_']);

    const userMap = new Map((raceUsers || []).map(u => [u.id, u]));

    // Fetch validations for participation stats
    const sessionIds = (sessions || []).map(s => s.id);
    const { data: validations } = await supabase
      .from('session_validations')
      .select('session_id, status')
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['_none_']);

    const doneCount = (validations || []).filter(v => v.status === 'done').length;

    // Build digest content
    const sessionsHtml = (sessions && sessions.length > 0)
      ? `<h3 style="margin:16px 0 8px;color:#111827;font-size:15px;">Seances de la semaine</h3>
         <ul style="margin:0;padding:0 0 0 16px;color:#4b5563;font-size:14px;line-height:1.8;">
           ${sessions.map(s => `<li><strong>${s.title}</strong> — ${formatDate(s.date)}</li>`).join('')}
         </ul>
         <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">${doneCount} validation${doneCount > 1 ? 's' : ''} enregistree${doneCount > 1 ? 's' : ''}</p>`
      : '';

    const racesHtml = (races && races.length > 0)
      ? `<h3 style="margin:16px 0 8px;color:#111827;font-size:15px;">Courses de la semaine</h3>
         <ul style="margin:0;padding:0 0 0 16px;color:#4b5563;font-size:14px;line-height:1.8;">
           ${races.map(r => {
             const u = userMap.get(r.user_id);
             const name = u ? `${u.firstname} ${u.lastname.charAt(0)}.` : '';
             return `<li><strong>${r.race_name}</strong> — ${r.distance_km} km en ${formatDuration(r.time_duration)} (${name})</li>`;
           }).join('')}
         </ul>`
      : '';

    const upcomingHtml = (upcoming && upcoming.length > 0)
      ? `<h3 style="margin:16px 0 8px;color:#111827;font-size:15px;">A venir cette semaine</h3>
         <ul style="margin:0;padding:0 0 0 16px;color:#4b5563;font-size:14px;line-height:1.8;">
           ${upcoming.map(s => `<li><strong>${s.title}</strong> — ${formatDate(s.date)}</li>`).join('')}
         </ul>`
      : '';

    const subject = `Digest Narbo Nordik — Semaine du ${formatDate(weekAgoISO)}`;

    let sentCount = 0;

    for (const user of users) {
      // Check preference
      const prefs = user.notification_preferences || {};
      if (prefs.weekly_digest?.email === false) continue;
      if (!user.email) continue;

      const html = buildDigestHtml(user.firstname, sessionsHtml, racesHtml, upcomingHtml);

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

function formatDuration(duration: string): string {
  const parts = duration.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildDigestHtml(firstname: string, sessionsHtml: string, racesHtml: string, upcomingHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#1a1a2e;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#6CCBE6;font-size:20px;">Narbo Nordik</h1>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Digest hebdomadaire</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Salut ${firstname},</p>
      <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Voici le resume de la semaine au club.</p>
      ${sessionsHtml}
      ${racesHtml}
      ${upcomingHtml}
      <a href="${APP_URL}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#6CCBE6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ouvrir l'appli</a>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Narbo Nordik Running Club — Narbonne</p>
    </div>
  </div>
</body>
</html>`;
}
