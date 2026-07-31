-- Cloisonnement des colonnes PII de public.users pour le rôle authenticated.
--
-- FAILLE (confirmée, chantier "sec-pii-users"). La policy SELECT
-- `Users can read all profiles` (USING (true), posée par le baseline) ouvre
-- TOUTES les colonnes de `users` à tout membre authentifié : n'importe quel
-- athlète peut lire l'email, le téléphone, le numéro de licence et la date de
-- naissance de tous les autres via un simple GET REST, par ex. :
--
--   GET /rest/v1/users?select=email,phone,license_number,birth_date
--
-- Le toggle "Profil public" (`is_public`, colonne posée par le baseline) ne
-- gate RIEN aujourd'hui : ni la policy RLS, ni le code applicatif.
-- `Directory.tsx` et `AthleteDetail.tsx` affichent le téléphone (lien
-- WhatsApp) et la date de naissance (catégorie FFA) de CHAQUE membre à
-- N'IMPORTE QUEL autre membre, coach ou non (routes `/directory` et
-- `/directory/:id` partagées, sans garde de rôle : vérifié dans App.tsx).
--
-- Note de contexte : la migration précédente (20260731081000) documentait ce
-- point comme "hors périmètre, chantier séparé". C'est ce chantier.
--
-- Révision assumée d'une décision antérieure : la section "Confidentialité /
-- RLS par persona, décisions 2026-06-08" de MIGRATIONS.md déclarait
-- téléphone et date de naissance "club-visibles par design" et ne listait que
-- email/license_number/notification_preferences/strava_id comme backlog
-- sensible. Cette migration REVIENT sur le volet téléphone/date de naissance
-- (décision explicitement validée par Matthieu le 2026-07-31) : ces deux
-- colonnes rejoignent le périmètre restreint. `strava_id` n'existe plus
-- (colonne supprimée par 20260606150000).
--
-- MÉCANISME CHOISI : privilèges colonne par colonne (REVOKE table + GRANT sur
-- liste explicite), pas de policy RESTRICTIVE ni de vue. La RLS ne filtre que
-- des LIGNES, jamais des colonnes : `USING (true)` reste la bonne policy pour
-- laisser un athlète lire les colonnes non sensibles de tout le club
-- (annuaire, VMA, groupe, avatar). Les privilèges colonne sont le seul levier
-- Postgres qui restreint des COLONNES pour un rôle donné sans dupliquer la
-- logique RLS.
--
-- COLONNES RETIRÉES à `authenticated` (accessibles uniquement via les deux
-- fonctions ci-dessous, donc soi-même + coach/super-admin) :
--   email, phone, license_number, birth_date, notification_preferences.
-- `notification_preferences` n'est lue nulle part dans l'app pour un AUTRE
-- utilisateur que soi-même (grep du chantier : AuthContext.loadProfile,
-- DataContext.patchUser, Profile.tsx, jamais Directory/AthleteDetail/
-- AthletesTab) : aucune raison de la laisser ouverte à tout le club.
--
-- COLONNES CONSERVÉES pour `authenticated` (club-visibles, inchangé) :
--   id, role         → CRITIQUE : une vingtaine de policies d'autres tables
--                       (club_settings, exit_feedbacks, groups, race_results,
--                       session_templates, sessions, specific_preparations,
--                       user_preparations) contiennent toutes un
--                       EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND
--                       role = 'coach'). Elles ne référencent que ces deux
--                       colonnes (vérifié via pg_policies) : les retirer
--                       casserait l'accès coach sur tout le reste de la base.
--   firstname, lastname, vma, vma_history, group_id, photo_url, is_public,
--   is_super_admin, created_at
--                    → annuaire, VMA, avatar, groupe : transparence club
--                      assumée (décision 2026-06-08, non remise en cause ici),
--                      non-PII. `is_public` doit rester lisible par tous : le
--                      gating annuaire (ETAPE 3 du chantier) est un filtre
--                      applicatif qui a besoin de lire ce flag pour CHAQUE
--                      ligne, y compris celles des autres athlètes.
--
-- anon : aucune policy SELECT ne le vise sur `users` (RLS ferme tout par
-- défaut, vérifié via pg_policies + pg_roles.rolbypassrls = false). Le GRANT
-- large hérité du provisioning Supabase par défaut ne lui donne donc accès à
-- AUCUNE ligne, quelles que soient les colonnes. On ne touche pas à son GRANT
-- ici : déjà inoffensif, hors périmètre de ce chantier.
--
-- service_role / postgres : rolbypassrls = true (vérifié) → bypassent RLS et
-- privilèges colonne. Les Edge Functions (send-notification-email,
-- daily-session-digest, weekly-digest) qui lisent notification_preferences
-- utilisent SUPABASE_SERVICE_ROLE_KEY : aucun impact de ce REVOKE.
--
-- Fragilité connue (même limite que le mécanisme à trigger de 20260730160000
-- et 20260731081000) : un futur GRANT large sur `users` (ex. depuis le
-- dashboard, ou un `GRANT ALL ON ALL TABLES IN SCHEMA public`) réouvrirait
-- silencieusement ces colonnes. À revérifier à chaque évolution de schéma
-- touchant `users`.
--
-- Migration additive et idempotente : REVOKE/GRANT et CREATE OR REPLACE
-- FUNCTION peuvent être rejoués sans erreur.

REVOKE SELECT ON TABLE public.users FROM authenticated;

GRANT SELECT (
  id, role, firstname, lastname, vma, vma_history, group_id, photo_url,
  is_public, created_at, is_super_admin
) ON public.users TO authenticated;

-- --------------------------------------------------------------------------
-- get_own_profile() : ligne complète de l'appelant (auth.uid()), toutes
-- colonnes. Seule voie pour un athlète de relire son propre email, téléphone,
-- numéro de licence, date de naissance et préférences de notification une
-- fois le GRANT ci-dessus posé (SECURITY DEFINER : exécutée avec les
-- privilèges du propriétaire de la fonction, qui ne sont pas soumis au REVOKE
-- ci-dessus, même principe que les triggers SECURITY DEFINER existants sur
-- cette table).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.users
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT * FROM public.users WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- --------------------------------------------------------------------------
-- get_users_for_coach() : lignes complètes de TOUT le club, toutes colonnes,
-- réservée aux coachs et au super-admin. Les LIGNES étaient déjà toutes
-- visibles avant ce chantier (RLS USING (true)) ; seules les colonnes PII
-- passaient par le GRANT large qu'on vient de retirer, d'où cette fonction
-- pour les rendre à qui doit continuer à les voir (AthletesTab, RiskScoreCard,
-- fiches athlète côté coach).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_users_for_coach()
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND (role = 'coach' OR is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Réservé aux coachs et au super-admin.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM public.users;
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_for_coach() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_for_coach() TO authenticated;

-- Hors périmètre, vérifié et volontairement non traité :
--   - RLS de `users` inchangée (`USING (true)` reste la policy SELECT) : la
--     LIGNE reste techniquement visible par tout authenticated (y compris un
--     profil is_public=false), seules les COLONNES PII sont fermées. Le
--     cloisonnement de l'annuaire (un profil is_public=false masqué pour les
--     AUTRES athlètes) est un filtre applicatif (Directory/search/
--     AthleteDetail, cf. `isAthleteVisible` dans src/lib/search.ts), pas une
--     frontière RLS. Documenté ici pour que ce ne soit pas (re)découvert
--     comme une faille lors d'un futur audit.
