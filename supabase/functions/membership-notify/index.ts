// Notification bureau + adhérent à l'arrivée d'une demande d'adhésion
// (formulaire du site Next.js ou saisie papier par le bureau). Même squelette
// que send-notification-email/weekly-digest/daily-session-digest : appel
// Resend en fetch brut, contrôle d'appelant par décodage du JWT.
//
// Appelant : uniquement le trigger DB `notify_membership_submitted`
// (migration 20260817120000), qui porte le secret Vault `service_role_key` en
// Bearer et poste { membership_season_id, member_id } (contrat lu dans la
// migration, section 8). La passerelle Supabase (verify_jwt=true) a déjà
// vérifié la signature avant d'invoquer la fonction : on lit donc le rôle du
// JWT déjà authentifié plutôt que de comparer sa valeur à
// SUPABASE_SERVICE_ROLE_KEY (motif identique aux 3 fonctions ci-dessus).
//
// L'appel `net.http_post` du trigger est ASYNCHRONE et best-effort : un échec
// ici (fonction non déployée, erreur Resend) ne fait PAS échouer l'insertion
// de l'adhésion et n'est visible que dans `net._http_response` côté DB. Cette
// fonction ne doit donc jamais lever d'exception non gérée qui masquerait la
// vraie cause dans les logs Edge.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildBoardEmailHtml,
  buildMemberEmailHtml,
  boardEmailSubject,
  memberEmailSubject,
  type MemberRecord,
  type MembershipSeasonRecord,
} from './lib.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'Narbo Nordik <club@2nc.fr>';
const CLUB_EMAIL = 'narbo.nordik.club@gmail.com'; // boîte officielle du bureau

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

// Log structuré, jamais de PII : uniquement des ids et des compteurs.
function log(level: 'info' | 'warn' | 'error', stage: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ fn: 'membership-notify', stage, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendResendEmail(payload: {
  to: string[];
  subject: string;
  html: string;
}, tag: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      // Ne jamais journaliser le corps brut : sur un `to` invalide ou une
      // adresse en liste de suppression, Resend renvoie l'e-mail du
      // destinataire dans le message d'erreur (422). Parse tolérant : si le
      // corps n'est pas du JSON exploitable, on se contente du statut.
      let errorName: string | undefined;
      try {
        const parsed = JSON.parse(await res.text());
        if (parsed && typeof parsed.name === 'string') errorName = parsed.name;
      } catch {
        // corps non JSON : rien de plus à en tirer
      }
      log('error', 'resend', { tag, status: res.status, errorName });
      return false;
    }
    return true;
  } catch (err) {
    log('error', 'resend-fetch', { tag, message: String(err) });
    return false;
  }
}

serve(async (req) => {
  if (!isServiceRoleCaller(req)) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    log('warn', 'invalid-body');
    return json({ ok: false, error: 'Corps de requête invalide.' }, 400);
  }

  const membershipSeasonId = typeof body.membership_season_id === 'string' ? body.membership_season_id : null;
  const memberId = typeof body.member_id === 'string' ? body.member_id : null;
  if (!membershipSeasonId || !memberId) {
    log('warn', 'missing-ids', { hasMembershipSeasonId: !!membershipSeasonId, hasMemberId: !!memberId });
    return json({ ok: false, error: 'membership_season_id et member_id sont requis.' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: season, error: seasonError } = await supabase
    .from('membership_seasons')
    .select('season, section, license_type, activities, tshirt_model, tshirt_size, tshirt_included, membership_type, amount_due_cents, family_discount_cents, payment_method, rules_accepted_at, gdpr_consent_at, ce_certificate_requested')
    .eq('id', membershipSeasonId)
    .maybeSingle();

  if (seasonError) {
    log('error', 'season-fetch', { membershipSeasonId, message: seasonError.message });
    return json({ ok: false, error: 'Lecture du dossier impossible.' }, 500);
  }
  if (!season) {
    log('warn', 'season-not-found', { membershipSeasonId });
    return json({ ok: false, error: 'Dossier d\'adhésion introuvable.' }, 404);
  }

  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('firstname, lastname, birth_date, sex, nationality, address_street, address_postal_code, address_city, email, phone, section, family_group, notes, source')
    .eq('id', memberId)
    .maybeSingle();

  if (memberError) {
    log('error', 'member-fetch', { memberId, message: memberError.message });
    return json({ ok: false, error: 'Lecture de l\'adhérent impossible.' }, 500);
  }
  if (!member) {
    log('warn', 'member-not-found', { memberId });
    return json({ ok: false, error: 'Adhérent introuvable.' }, 404);
  }

  const memberRecord = member as MemberRecord;
  const seasonRecord = season as MembershipSeasonRecord;

  // Destinataires bureau : la boîte officielle du club (CLUB_EMAIL) + les
  // super-admins. Décision du 2026-08-17 : le dossier complet ne part plus
  // à tous les coachs, uniquement au bureau.
  const { data: boardUsers, error: boardError } = await supabase
    .from('users')
    .select('email')
    .eq('is_super_admin', true);

  if (boardError) {
    log('error', 'board-fetch', { membershipSeasonId, message: boardError.message });
  }

  const boardEmails = Array.from(new Set([
    CLUB_EMAIL,
    ...(boardUsers ?? [])
      .map((u) => (typeof u.email === 'string' ? u.email.trim() : ''))
      .filter((email) => email.length > 0),
  ]));

  let memberSent = false;
  if (memberRecord.email) {
    memberSent = await sendResendEmail({
      to: [memberRecord.email],
      subject: memberEmailSubject(),
      html: buildMemberEmailHtml(memberRecord, seasonRecord),
    }, 'member');
  } else {
    log('warn', 'member-no-email', { memberId });
  }

  const boardSent = await sendResendEmail({
    to: boardEmails,
    subject: boardEmailSubject(memberRecord, seasonRecord),
    html: buildBoardEmailHtml(memberRecord, seasonRecord),
  }, 'board');

  log('info', 'done', { membershipSeasonId, memberId, memberSent, boardSent, boardRecipientCount: boardEmails.length });

  return json({ ok: true, sent: { member: memberSent, board: boardSent } }, 200);
});
