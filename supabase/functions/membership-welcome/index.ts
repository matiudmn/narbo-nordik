// Invitation à créer un compte dans l'app, envoyée à l'adhérent running/trail
// dont le bureau vient de valider le dossier. Même squelette que
// membership-notify : appel Resend en fetch brut, contrôle d'appelant par
// décodage du JWT déjà vérifié par la passerelle.
//
// Appelant : uniquement le trigger DB `notify_membership_validated`
// (migration 20260904070000), qui poste { membership_season_id, member_id }.
//
// Cette fonction REVÉRIFIE toutes les conditions du trigger avant d'envoyer
// (dossier validé, section running/trail, e-mail jamais envoyé) : le POST est
// asynchrone, l'état du dossier a pu changer entre le déclenchement et
// l'exécution, et rien n'interdit un appel manuel.
//
// C'est elle, et elle seule, qui pose `welcome_email_sent_at`, APRÈS un envoi
// réussi : sur un échec Resend, l'unique tentative n'est pas consommée.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildWelcomeEmailHtml, welcomeEmailSubject, type WelcomeMemberRecord, type WelcomeSeasonRecord } from './lib.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'Narbo Nordik <club@2nc.fr>';
// Même raison que membership-notify : club@2nc.fr n'a pas de MX, sans reply_to
// toute réponse d'un adhérent se perdrait.
const REPLY_TO_EMAIL = 'narbo.nordik.club@gmail.com';
const APP_URL = 'https://narbo-nordik.vercel.app';

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
  return decodeJwtPayload(token)?.role === 'service_role';
}

// Log structuré, jamais de PII : uniquement des ids et des drapeaux.
function log(level: 'info' | 'warn' | 'error', stage: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ fn: 'membership-welcome', stage, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// `_`, `%` et `*` sont des jokers : PostgREST traduit `*` en `%`, et `_` est
// courant dans une adresse e-mail. Même échappement que côté site :
// sans échappement, la recherche de compte existant matcherait l'adresse d'un
// autre membre.
function escapeLike(value: string): string {
  return value.replace(/[\\%_*]/g, (char) => `\\${char}`);
}

serve(async (req) => {
  if (!isServiceRoleCaller(req)) return json({ error: 'Forbidden' }, 403);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

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
    log('warn', 'missing-ids');
    return json({ ok: false, error: 'membership_season_id et member_id sont requis.' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: season, error: seasonError } = await supabase
    .from('membership_seasons')
    .select('season, section, status, welcome_email_sent_at')
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

  // Conditions revérifiées ici : l'état a pu changer depuis le trigger.
  if (season.status !== 'validated' || season.section !== 'running_trail' || season.welcome_email_sent_at) {
    log('info', 'skipped', {
      membershipSeasonId,
      status: season.status,
      section: season.section,
      alreadySent: !!season.welcome_email_sent_at,
    });
    return json({ ok: true, skipped: true }, 200);
  }

  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('firstname, email')
    .eq('id', memberId)
    .maybeSingle();

  if (memberError) {
    log('error', 'member-fetch', { memberId, message: memberError.message });
    return json({ ok: false, error: 'Lecture de l\'adhérent impossible.' }, 500);
  }
  if (!member?.email) {
    log('warn', 'member-no-email', { memberId });
    return json({ ok: false, error: 'Adhérent sans adresse e-mail.' }, 404);
  }

  // Compte déjà créé sur cette adresse : ne pas inviter quelqu'un qui est déjà
  // là. L'horodatage est posé quand même, sinon la moindre revalidation
  // relancerait la question.
  const { data: existingAccount, error: accountError } = await supabase
    .from('users')
    .select('id')
    .ilike('email', escapeLike(member.email))
    .maybeSingle();

  if (accountError) {
    log('error', 'account-lookup', { memberId, message: accountError.message });
    return json({ ok: false, error: 'Recherche de compte impossible.' }, 500);
  }
  if (existingAccount) {
    await supabase
      .from('membership_seasons')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', membershipSeasonId);
    log('info', 'account-exists', { membershipSeasonId });
    return json({ ok: true, skipped: true, reason: 'account-exists' }, 200);
  }

  const { data: settings, error: settingsError } = await supabase
    .from('club_settings')
    .select('invite_code')
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings?.invite_code) {
    log('error', 'invite-code', { message: settingsError?.message ?? 'code absent' });
    return json({ ok: false, error: 'Code d\'invitation indisponible.' }, 500);
  }

  const memberRecord = member as WelcomeMemberRecord;
  const seasonRecord = season as WelcomeSeasonRecord;

  let sent = false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        reply_to: REPLY_TO_EMAIL,
        to: [memberRecord.email],
        subject: welcomeEmailSubject(),
        html: buildWelcomeEmailHtml(memberRecord, seasonRecord, settings.invite_code, APP_URL),
      }),
    });
    if (res.ok) {
      sent = true;
    } else {
      // Jamais le corps brut : Resend y renvoie l'adresse du destinataire.
      let errorName: string | undefined;
      try {
        const parsed = JSON.parse(await res.text());
        if (parsed && typeof parsed.name === 'string') errorName = parsed.name;
      } catch {
        // corps non JSON : le statut suffit
      }
      log('error', 'resend', { status: res.status, errorName });
    }
  } catch (err) {
    log('error', 'resend-fetch', { message: String(err) });
  }

  if (!sent) {
    // `welcome_email_sent_at` reste NULL : une revalidation pourra réessayer.
    return json({ ok: false, error: 'Envoi impossible.' }, 500);
  }

  const { error: stampError } = await supabase
    .from('membership_seasons')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', membershipSeasonId);

  if (stampError) {
    // E-mail parti mais trace non posée : un doublon reste possible à la
    // prochaine revalidation. Signalé pour que ça ne se découvre pas par
    // l'adhérent.
    log('error', 'stamp', { membershipSeasonId, message: stampError.message });
  }

  log('info', 'done', { membershipSeasonId, memberId, sent });
  return json({ ok: true, sent: true }, 200);
});
