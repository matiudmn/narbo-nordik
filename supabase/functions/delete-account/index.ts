// Suppression définitive du compte de l'appelant (droit à l'effacement, RGPD
// art. 17). L'écran Profil promet la suppression de « toutes vos données
// personnelles » : cette promesse ne peut pas être tenue depuis le client.
//
// Ce que le client ne pouvait pas faire, et qui motive cette fonction :
//   1. auth.users est hors de portée d'un JWT d'athlète : seule la clé
//      service_role peut supprimer la ligne d'authentification (et donc
//      l'adresse e-mail). Sans elle, l'adresse survit indéfiniment.
//   2. La policy DELETE de public.users est réservée aux coachs
//      ("Coaches can delete users", relue en prod) : le DELETE d'un athlète
//      sur sa propre ligne ne correspond à AUCUNE ligne, PostgREST répond 204
//      sans erreur, et le compte reste entier.
//   3. sessions.created_by et specific_preparations.created_by référencent
//      public.users SANS cascade (NO ACTION) : la suppression est bloquée en
//      23503 tant que ces lignes existent. club_settings.updated_by bloque de
//      la même façon la suppression de auth.users.
//
// Modèle de sécurité : l'identité supprimée est TOUJOURS déduite du JWT
// (supa.auth.getUser()), jamais d'un identifiant transmis dans le corps de la
// requête. Le corps ne porte que l'enquête de sortie. Un athlète ne peut donc
// supprimer que son propre compte, même en forgeant le payload.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const COMMENT_MAX_LEN = 1000;
const RETRY_LATER = 'Suppression impossible pour le moment, réessaie plus tard.';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logError(stage: string, message: unknown) {
  console.error(JSON.stringify({ fn: 'delete-account', stage, message: String(message) }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Configuration serveur incomplète.' }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return json({ error: 'Motif de départ manquant.' }, 400);
  const rawComment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const comment = rawComment ? rawComment.slice(0, COMMENT_MAX_LEN) : null;

  // Identité de l'appelant : lue dans le JWT vérifié par GoTrue. La clé anon
  // seule passe la passerelle (verify_jwt) mais ne résout aucun utilisateur.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return json({ error: 'Non authentifié.' }, 401);
  const userId = auth.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile } = await admin.from('users').select('role').eq('id', userId).maybeSingle();
  if (!profile) return json({ error: 'Profil introuvable.' }, 404);

  // Garde-fou métier, déjà affiché par l'interface (Profile.tsx) mais qui ne
  // peut pas rester côté client : un club sans coach n'a plus personne pour
  // programmer les séances ni gérer les membres.
  if (profile.role === 'coach') {
    const { count, error } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'coach');
    if (error) {
      logError('coach-count', error.message);
      return json({ error: RETRY_LATER }, 500);
    }
    if ((count ?? 0) <= 1) {
      return json({
        error: 'Tu es le seul coach du club. Nomme un autre coach avant de supprimer ton compte.',
      }, 409);
    }
  }

  // 1. Fichiers de l'athlète dans le storage : aucune cascade ne les suit, ils
  //    resteraient téléchargeables dans des buckets publics. Les pièces
  //    jointes sont listées depuis les validations (chemin
  //    `<user_id>/<session_id>/<horodatage>.<ext>`) AVANT que la cascade ne
  //    les efface ; les avatars sont rangés à plat sous `<user_id>/`.
  const { data: attachments } = await admin
    .from('session_validations')
    .select('attachment_path')
    .eq('user_id', userId)
    .not('attachment_path', 'is', null);
  const attachmentPaths = (attachments ?? [])
    .map(row => row.attachment_path as string)
    .filter(Boolean);
  if (attachmentPaths.length > 0) {
    const { error } = await admin.storage.from('session-attachments').remove(attachmentPaths);
    if (error) logError('storage-attachments', error.message);
  }

  const { data: avatarFiles } = await admin.storage.from('avatars').list(userId);
  if (avatarFiles && avatarFiles.length > 0) {
    const { error } = await admin.storage
      .from('avatars')
      .remove(avatarFiles.map(file => `${userId}/${file.name}`));
    if (error) logError('storage-avatars', error.message);
  }

  // 2. Séances personnelles : données de l'athlète, elles partent avec lui
  //    (leurs validations, réactions et analyses suivent en cascade).
  const { error: personalError } = await admin
    .from('sessions')
    .delete()
    .eq('created_by', userId)
    .eq('is_personal', true);
  if (personalError) {
    logError('personal-sessions', personalError.message);
    return json({ error: RETRY_LATER }, 500);
  }

  // 3. Séances de club restantes : elles appartiennent au club, pas au coach
  //    qui les a saisies, et les effacer emporterait le programme et les
  //    comptes rendus de TOUS les athlètes. created_by étant NOT NULL, elles
  //    sont transférées au coach restant le plus ancien (il existe forcément,
  //    le garde-fou ci-dessus l'a vérifié).
  const { data: remaining } = await admin.from('sessions').select('id').eq('created_by', userId).limit(1);
  if (remaining && remaining.length > 0) {
    const { data: successor } = await admin
      .from('users')
      .select('id')
      .eq('role', 'coach')
      .neq('id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!successor) {
      return json({
        error: "Tes séances de club doivent d'abord être reprises par un autre coach.",
      }, 409);
    }
    const { error } = await admin
      .from('sessions')
      .update({ created_by: successor.id })
      .eq('created_by', userId);
    if (error) {
      logError('sessions-transfer', error.message);
      return json({ error: RETRY_LATER }, 500);
    }
  }

  // 4. Colonnes d'auteur nullables : on coupe le lien plutôt que de supprimer
  //    la donnée du club (préparations, réglages). specific_preparations et
  //    club_settings bloqueraient sinon la suppression (NO ACTION).
  const { error: prepError } = await admin
    .from('specific_preparations')
    .update({ created_by: null })
    .eq('created_by', userId);
  if (prepError) {
    logError('preparations-anonymize', prepError.message);
    return json({ error: RETRY_LATER }, 500);
  }

  const { error: settingsError } = await admin
    .from('club_settings')
    .update({ updated_by: null })
    .eq('updated_by', userId);
  if (settingsError) {
    logError('club-settings-anonymize', settingsError.message);
    return json({ error: RETRY_LATER }, 500);
  }

  // 5. Suppression du compte d'authentification. users.id référence
  //    auth.users(id) ON DELETE CASCADE : la ligne public.users et tout ce qui
  //    en dépend (notifications, palmarès, validations et leurs analyses,
  //    réactions, préparations suivies, séances nordiks) partent dans la même
  //    transaction. Supprimer auth.users EN PREMIER évite l'état bâtard d'un
  //    profil effacé dont l'adresse e-mail survivrait.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    logError('auth-delete', authError.message);
    return json({ error: RETRY_LATER }, 500);
  }

  // 6. Enquête de sortie, une fois la suppression acquise : la table est
  //    anonyme (aucune colonne identifiante, aucune clé étrangère vers users,
  //    cf. 20260730150000_exit_feedbacks_anonymous.sql), elle survit donc au
  //    compte. Un échec ici ne remet pas en cause la suppression, déjà faite.
  const { error: feedbackError } = await admin.from('exit_feedbacks').insert({ reason, comment });
  if (feedbackError) logError('exit-feedback', feedbackError.message);

  return json({ deleted: true });
});
