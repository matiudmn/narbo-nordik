-- ============================================================================
-- Notification coach à l'inscription d'un nouvel athlète (demande David, 10/08/2026)
-- ----------------------------------------------------------------------------
-- CONTEXTE. Avant l'onboarding des nouveaux adhérents (qui arrivent sans
-- licence FFA et sans VMA mesurée), le coach demande d'être prévenu à chaque
-- inscription « pour pouvoir renseigner une VMA ou interpréter ». Sa VMA reste
-- vide tant que personne ne la saisit, donc aucune allure n'est calculée pour
-- lui (cf. AthleteDetail « VMA non renseignee »).
--
-- CE QUI EXISTAIT (PR #62, 31/07) et que ce fichier REMPLACE : un insert
-- best-effort côté client dans `AuthContext.signup`, qui posait une
-- notification de type `system` à chaque coach. Trois limites, toutes levées
-- ici : il ne couvrait que l'inscription self-service (rien quand un coach
-- créait l'athlète via `addUser`), il disparaissait si le navigateur partait
-- entre le RPC et l'insert, et il ne disait pas ce qui manquait au profil.
-- Le bloc client est retiré dans le même commit : sans cela, chaque
-- inscription produirait DEUX notifications.
--
-- CE QUE FAIT CE FICHIER (2 volets, additifs, aucun changement de table) :
--   1. `new_athlete` : notification immédiate aux coachs à la création d'une
--      ligne `users` de rôle athlete, avec mention de ce qui manque (VMA,
--      numéro de licence, ou les deux). Couvre les DEUX chemins de création :
--      l'inscription self-service (RPC `register_profile`, 20260731130000) et
--      la création manuelle par un coach (`addUser`, DataContext), puisque le
--      déclencheur est posé sur la table et non sur l'un des deux appelants.
--   2. `vma_missing` : rappel récurrent tant qu'il reste des inscrits récents
--      sans VMA (cron quotidien, au plus une notification par coach et par
--      semaine).
--
-- POURQUOI PAS DE COLONNE D'ÉTAT (ex. `users.vma_reminder_sent_at`) pour le
-- rappel : `get_users_for_coach()` (20260731120000) renvoie `SETOF public.users`
-- via `SELECT *`, donc toute colonne ajoutée à `users` part chez tous les
-- coachs et dans les types générés. Le rappel est donc conçu sans état : c'est
-- un digest périodique, dédupliqué en interrogeant `notifications` elle-même
-- (au plus une par coach tous les 7 jours). Il s'éteint tout seul dès que les
-- VMA sont saisies, et il est insensible à un run de cron manqué.
--
-- CHOIX DE CANAL. `new_athlete` part aussi en e-mail (événement rare, le coach
-- n'a pas l'app ouverte en permanence) ; `vma_missing` reste in-app seulement
-- (un rappel hebdomadaire par e-mail se ferait filtrer, même raisonnement que
-- `reaction` en 20260606190000). Coupe-circuit disponible sans nouvelle
-- migration ni UI, comme pour les autres types : poser
-- `notification_preferences->'new_athlete'->>'in_app'` (ou `'email'`, lu par la
-- fonction Edge send-notification-email) à `false` sur la ligne du coach.
-- L'absence de clé vaut « activé » (`IS NOT FALSE`), comme les triggers
-- existants : aucune ligne `users` déjà en base n'a besoin d'être migrée.
--
-- Additive et idempotente (CREATE OR REPLACE / DROP ... IF EXISTS / unschedule
-- conditionnel). NE PAS APPLIQUER EN PROD SANS VALIDATION EXPLICITE DE MATTHIEU.
-- ============================================================================

-- ============================================================================
-- 1. Deux nouveaux types de notification
-- ============================================================================
-- Même motif qu'en 20260606190000 (ajout de 'reaction') : la CHECK inline de
-- `notifications.type` porte le nom auto `notifications_type_check`, on la
-- remplace en réénumérant la liste complète.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_session', 'palmares', 'vma_update', 'weekly_digest', 'system',
    'reaction', 'new_athlete', 'vma_missing'
  ));

-- ============================================================================
-- 2. `vma_missing` exclu de l'e-mail transactionnel
-- ============================================================================
-- Corps repris tel quel de 20260606190000, seule la liste de skip change.
--
-- PIÈGE À NE PAS REPRODUIRE : `CREATE OR REPLACE FUNCTION` réassigne TOUTES les
-- propriétés de la fonction sauf le propriétaire et les droits. Le
-- `SET search_path = ''` posé par 20260730120000 (correctif d'advisor
-- function_search_path_mutable) doit donc être re-déclaré ici, sinon le
-- remplacement rouvre l'avertissement. Les REVOKE de 20260514085447 sur cette
-- fonction, eux, survivent (les droits ne sont pas touchés).
CREATE OR REPLACE FUNCTION public.notify_email_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF NEW.type IN ('weekly_digest', 'palmares', 'new_session', 'reaction', 'vma_missing') THEN
    RETURN NEW;
  END IF;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('record', jsonb_build_object(
      'id', NEW.id, 'user_id', NEW.user_id, 'type', NEW.type,
      'title', NEW.title, 'body', NEW.body, 'link', NEW.link
    ))
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. `new_athlete` : notification immédiate aux coachs
-- ============================================================================
-- SECURITY DEFINER (propriétaire postgres) comme les autres notify_* : l'INSERT
-- dans `notifications` vise d'AUTRES utilisateurs que l'appelant, ce que la
-- policy client (`type IN ('system','reaction')`, 20260730120000) interdit.
-- search_path vide + noms qualifiés : pas de nouvel advisor.
--
-- Le coach qui crée l'athlète à la main n'est pas notifié de son propre geste
-- (exclusion sur auth.uid(), même intention que `id != NEW.created_by` dans
-- notify_new_session) ; les autres coachs le sont. Dans le flux self-service,
-- auth.uid() vaut l'athlète lui-même, donc aucun coach n'est exclu.
--
-- Lien : l'onglet Athlètes des paramètres coach, seul écran où la VMA et le
-- numéro de licence se saisissent (AthletesTab ; `/directory/:id` les affiche
-- mais ne les édite pas). Le deep-link `?tab=athletes` est déjà géré par
-- Settings.tsx.
CREATE OR REPLACE FUNCTION public.notify_coaches_new_athlete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_coach RECORD;
  v_missing text;
  v_body text;
BEGIN
  IF NEW.role <> 'athlete' THEN
    RETURN NEW;
  END IF;

  -- Un numéro de licence vide ('') compte comme absent : le formulaire coach
  -- envoie la chaîne vide plutôt que NULL quand le champ est effacé
  -- (updateUserLicense, `licenseValue.trim() || null`, mais l'insert initial
  -- de register_profile laisse NULL ; on couvre les deux).
  v_missing := CASE
    WHEN NEW.vma IS NULL AND coalesce(btrim(NEW.license_number), '') = ''
      THEN 'VMA et numéro de licence à renseigner'
    WHEN NEW.vma IS NULL
      THEN 'VMA à renseigner'
    WHEN coalesce(btrim(NEW.license_number), '') = ''
      THEN 'Numéro de licence à renseigner'
    ELSE NULL
  END;

  v_body := NEW.firstname || ' ' || NEW.lastname || ' vient de s''inscrire'
    || coalesce(' : ' || v_missing, '') || '.';

  FOR target_coach IN
    SELECT id, notification_preferences
    FROM public.users
    WHERE role = 'coach'
      AND id IS DISTINCT FROM (SELECT auth.uid())
  LOOP
    IF (target_coach.notification_preferences->'new_athlete'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        target_coach.id,
        'new_athlete',
        'Nouvel athlète',
        v_body,
        '/coach/settings?tab=athletes'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_coaches_new_athlete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_new_athlete ON public.users;
CREATE TRIGGER on_new_athlete
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_coaches_new_athlete();

-- ============================================================================
-- 4. `vma_missing` : rappel tant que des inscrits récents n'ont pas de VMA
-- ============================================================================
-- Trois seuils, volontairement explicites :
--   - 3 jours  : délai de grâce après l'inscription (« après quelques jours »),
--                le temps que le coach traite la notification `new_athlete` ;
--   - 30 jours : fenêtre d'onboarding. Au-delà, l'athlète n'est plus un
--                nouvel inscrit et un rappel perpétuel finirait par être
--                ignoré (la liste complète reste visible dans l'onglet
--                Athlètes) ;
--   - 7 jours  : anti-spam, une notification par coach au plus. C'est aussi la
--                déduplication : elle se lit dans `notifications`, donc un run
--                de cron manqué décale le rappel au lendemain sans le perdre,
--                et deux exécutions le même jour n'en produisent qu'un.
CREATE OR REPLACE FUNCTION public.notify_coaches_missing_vma()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_coach RECORD;
  v_names text[];
  v_count int;
  v_body text;
BEGIN
  SELECT array_agg(u.firstname || ' ' || u.lastname ORDER BY u.created_at), count(*)
    INTO v_names, v_count
  FROM public.users u
  WHERE u.role = 'athlete'
    AND u.vma IS NULL
    AND u.created_at < now() - interval '3 days'
    AND u.created_at > now() - interval '30 days';

  IF v_count = 0 THEN
    RETURN;
  END IF;

  IF v_count = 1 THEN
    v_body := v_names[1] || ' attend sa VMA depuis plus de 3 jours.';
  ELSE
    v_body := v_count || ' athlètes inscrits sans VMA : '
      || array_to_string(v_names[1:5], ', ')
      || CASE
           WHEN v_count > 5
             THEN ', et ' || (v_count - 5) || ' autre'
                  || CASE WHEN v_count - 5 > 1 THEN 's' ELSE '' END
           ELSE ''
         END
      || '.';
  END IF;

  FOR target_coach IN
    SELECT id, notification_preferences FROM public.users WHERE role = 'coach'
  LOOP
    CONTINUE WHEN (target_coach.notification_preferences->'vma_missing'->>'in_app')::boolean IS FALSE;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_coach.id
        AND n.type = 'vma_missing'
        AND n.created_at > now() - interval '7 days'
    );

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      target_coach.id,
      'vma_missing',
      'VMA à renseigner',
      v_body,
      '/coach/settings?tab=athletes'
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_coaches_missing_vma() FROM PUBLIC, anon, authenticated;

-- Cron quotidien, 07:00 UTC (avant les autres jobs du projet, aucun secret :
-- SQL pur, comme `cleanup-expired-preparations`). pg_cron est déjà installé par
-- 20260606120000, qui s'exécute avant ce fichier.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vma-missing-reminder') THEN
    PERFORM cron.unschedule('vma-missing-reminder');
  END IF;
END $$;

SELECT cron.schedule('vma-missing-reminder', '0 7 * * *', $cron$
  SELECT public.notify_coaches_missing_vma();
$cron$);
