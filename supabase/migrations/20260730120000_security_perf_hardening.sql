-- Durcissement securite et perf (advisors Supabase, projet Narbo_Nordik / jubvxfjxokeefhfmjhwl).
-- Redige le 2026-07-30 a partir de get_advisors(security) + get_advisors(performance) et
-- d'une lecture directe (SELECT uniquement) de pg_policies / pg_proc en prod. Cette
-- migration N'A PAS ETE APPLIQUEE A LA PROD : aucun apply_migration ni SQL d'ecriture
-- n'a ete execute pendant sa redaction (contrainte de la mission), elle attend une revue
-- puis un `supabase db push` / passage CLI explicite.

-- ============================================================================
-- 1. search_path mutable sur les fonctions signalees (WARN function_search_path_mutable)
-- ============================================================================

-- increment_template_usage() reference la table `session_templates` sans la qualifier
-- (UPDATE session_templates SET ...) : le search_path doit donc conserver 'public'.
ALTER FUNCTION public.increment_template_usage(uuid) SET search_path = public, pg_temp;

-- notify_email_on_insert() ne lit que des champs de NEW (trigger) et appelle net.http_post,
-- deja qualifie par son schema : aucun schema applicatif n'est requis, on verrouille a vide.
ALTER FUNCTION public.notify_email_on_insert() SET search_path = '';

-- ============================================================================
-- 2. increment_template_usage : SECURITY DEFINER exposee a anon (WARN
--    anon_security_definer_function_executable / authenticated_security_definer_function_executable)
-- ============================================================================

-- Constat code : seul src/lib/sessionTemplates.ts (incrementUsage) appelle
-- `supabase.rpc('increment_template_usage', ...)`, depuis le client authentifie.
-- On retire l'acces public/anon et on rend explicite l'acces authenticated (deja
-- accorde en prod ; GRANT redondant mais volontaire pour documenter l'intention).
REVOKE EXECUTE ON FUNCTION public.increment_template_usage(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_template_usage(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_template_usage(uuid) TO authenticated;

-- ============================================================================
-- 3. notifications : policy INSERT permissive WITH CHECK (true) (WARN rls_policy_always_true)
-- ============================================================================

-- Constat code : TOUTES les notifications ne viennent PAS de triggers SECURITY DEFINER.
-- notify_new_session / notify_new_palmares / notify_vma_update (baseline) inserent bien
-- cote trigger (proprietaire postgres, notifications.relforcerowsecurity = false donc
-- non soumis a la RLS), MAIS src/contexts/DataContext.tsx insere aussi directement depuis
-- le client authentifie pour 2 types :
--   - toggleSessionNordik  -> type 'system'   (notifie session.created_by, jamais l'acteur)
--   - toggleValidationReaction -> type 'reaction' (notifie val.user_id, jamais l'acteur)
-- Dans les deux cas la notif cible un AUTRE utilisateur : un simple
-- `WITH CHECK (auth.uid() = user_id)` casserait donc la fonctionnalite, et un DROP pur
-- casserait ces deux flux clients. On restreint le WITH CHECK au perimetre reellement
-- utilise par le client (types 'system'/'reaction', jamais pour soi-meme, comme le code
-- le garantit deja cote applicatif). Les autres types (new_session, palmares, vma_update,
-- weekly_digest) restent reserves aux triggers SECURITY DEFINER et aux Edge Functions
-- (send-notification-email / weekly-digest / daily-session-digest, qui utilisent
-- SUPABASE_SERVICE_ROLE_KEY et bypassent donc la RLS) : un client ne peut plus les forger.
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    type IN ('system', 'reaction')
    AND user_id <> (select auth.uid())
  );

-- ============================================================================
-- 4. storage.objects : bucket public session-attachments, SELECT trop large
--    (WARN public_bucket_allows_listing)
-- ============================================================================

-- Constat code (src/lib/storage.ts, src/contexts/DataContext.tsx) : l'app n'appelle
-- jamais `.list()` ni `.download()` sur ce bucket. La lecture cote app passe uniquement
-- par `getPublicUrl()` (coach/Dashboard.tsx, athlete/SessionDetail.tsx), qui sert les
-- objets via la route publique de Storage et ne depend PAS des policies RLS de
-- storage.objects (bucket public). La policy SELECT actuelle (bucket_id =
-- 'session-attachments', sans filtre de dossier) permet neanmoins a tout authentifie
-- de lister/interroger l'integralite des objets du bucket via l'API Storage/PostgREST
-- (chemins = <user_id>/<session_id>/..., donc une fuite d'information entre athletes).
-- On aligne cette policy sur le meme perimetre que les policies UPDATE/DELETE deja en
-- place (dossier racine = auth.uid()), ce qui ne change rien pour l'app (qui ne s'en sert
-- pas) et supprime le listing complet.
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
CREATE POLICY "Users can list their own attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- 5. Index manquants sur les FK signalees (INFO unindexed_foreign_keys)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_club_settings_featured_validation ON public.club_settings(featured_validation_id);
CREATE INDEX IF NOT EXISTS idx_club_settings_updated_by ON public.club_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON public.sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_specific_preparations_created_by ON public.specific_preparations(created_by);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON public.users(group_id);
CREATE INDEX IF NOT EXISTS idx_validation_reactions_author ON public.validation_reactions(author_id);

-- ============================================================================
-- 6. auth_rls_initplan : 44 policies qui re-evaluent auth.uid()/auth.jwt() par ligne
--    (WARN auth_rls_initplan) -> encapsulation en (select auth.<fn>()) pour forcer un
--    seul appel par requete (InitPlan) au lieu d'un appel par ligne.
--    ALTER POLICY ne peut modifier que USING / WITH CHECK : la semantique de chaque
--    policy (roles, commande, colonnes testees) reste EXACTEMENT la meme, seule
--    l'evaluation de auth.uid() est encapsulee. Expressions reprises telles que
--    relevees via pg_policies (schemaname, tablename, policyname, cmd, qual, with_check).
-- ============================================================================

-- -- club_settings --------------------------------------------------------
ALTER POLICY "Coaches can insert club settings" ON public.club_settings
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can update club settings" ON public.club_settings
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

-- -- exit_feedbacks --------------------------------------------------------
ALTER POLICY "Users can insert their own feedback" ON public.exit_feedbacks
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can read their own feedback" ON public.exit_feedbacks
  USING (((select auth.uid()) = user_id));

-- -- groups -----------------------------------------------------------------
ALTER POLICY "Coaches can insert groups" ON public.groups
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can update groups" ON public.groups
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can delete groups" ON public.groups
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

-- -- notifications -----------------------------------------------------------
ALTER POLICY "Users see own notifications" ON public.notifications
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users mark own as read" ON public.notifications
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- -- race_nordiks --------------------------------------------------------
ALTER POLICY "Users can insert their own nordiks" ON public.race_nordiks
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Users can delete their own nordiks" ON public.race_nordiks
  USING ((user_id = (select auth.uid())));

-- -- race_results --------------------------------------------------------
ALTER POLICY "Users can delete their own race results" ON public.race_results
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users or coaches can insert race results" ON public.race_results
  WITH CHECK (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text))))));

ALTER POLICY "Users or coaches can update race results" ON public.race_results
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text))))));

-- -- session_nordiks --------------------------------------------------------
ALTER POLICY "Users can insert own session nordiks" ON public.session_nordiks
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can delete own session nordiks" ON public.session_nordiks
  USING (((select auth.uid()) = user_id));

-- -- session_templates --------------------------------------------------------
ALTER POLICY "Session templates are readable by authenticated users" ON public.session_templates
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Coaches can insert templates" ON public.session_templates
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can update non-seed templates" ON public.session_templates
  USING (((is_seed = false) AND (EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text))))));

ALTER POLICY "Coaches can delete non-seed templates" ON public.session_templates
  USING (((is_seed = false) AND (EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text))))));

-- -- session_validations --------------------------------------------------------
ALTER POLICY "Users can insert their own validations" ON public.session_validations
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "Users can delete their own validations" ON public.session_validations
  USING ((user_id = (select auth.uid())));

ALTER POLICY "Users can update their own validations" ON public.session_validations
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- -- sessions --------------------------------------------------------
ALTER POLICY "Coaches can insert sessions" ON public.sessions
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can update sessions" ON public.sessions
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can delete sessions" ON public.sessions
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Athletes can insert personal sessions" ON public.sessions
  WITH CHECK (((is_personal = true) AND (created_by = (select auth.uid()))));

ALTER POLICY "Athletes can update personal sessions" ON public.sessions
  USING (((is_personal = true) AND (created_by = (select auth.uid()))));

ALTER POLICY "Athletes can delete personal sessions" ON public.sessions
  USING (((is_personal = true) AND (created_by = (select auth.uid()))));

ALTER POLICY "Sessions are readable by authenticated users" ON public.sessions
  USING (((COALESCE(is_personal, false) = false) OR (created_by = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text))))));

-- -- specific_preparations --------------------------------------------------------
ALTER POLICY "Authenticated users can read preparations" ON public.specific_preparations
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Coaches can insert preparations" ON public.specific_preparations
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can update preparations" ON public.specific_preparations
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can delete preparations" ON public.specific_preparations
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

-- -- user_preparations --------------------------------------------------------
ALTER POLICY "Authenticated users can read user_preparations" ON public.user_preparations
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Coaches can insert user_preparations" ON public.user_preparations
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

ALTER POLICY "Coaches can delete user_preparations" ON public.user_preparations
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = (select auth.uid())) AND (users.role = 'coach'::text)))));

-- -- users --------------------------------------------------------
ALTER POLICY "Users can insert their own profile" ON public.users
  WITH CHECK (((select auth.uid()) = id));

ALTER POLICY "Users can update their own profile" ON public.users
  USING (((select auth.uid()) = id));

ALTER POLICY "Coaches can insert users" ON public.users
  WITH CHECK ((EXISTS ( SELECT 1 FROM users users_1 WHERE ((users_1.id = (select auth.uid())) AND (users_1.role = 'coach'::text)))));

ALTER POLICY "Coaches can update any user" ON public.users
  USING ((EXISTS ( SELECT 1 FROM users users_1 WHERE ((users_1.id = (select auth.uid())) AND (users_1.role = 'coach'::text)))));

ALTER POLICY "Coaches can delete users" ON public.users
  USING ((EXISTS ( SELECT 1 FROM users users_1 WHERE ((users_1.id = (select auth.uid())) AND (users_1.role = 'coach'::text)))));

-- -- validation_reactions --------------------------------------------------------
ALTER POLICY "Users can insert own validation reactions" ON public.validation_reactions
  WITH CHECK (((select auth.uid()) = author_id));

ALTER POLICY "Users can delete own validation reactions" ON public.validation_reactions
  USING (((select auth.uid()) = author_id));

-- ============================================================================
-- Hors perimetre de cette migration (volontairement non traite, cf. summary/decisions) :
--   - multiple_permissive_policies (sessions / users) : fusion de policies, pas demandee ici.
--   - public._archive_strava_activities : table d'archive hors perimetre (rls_enabled_no_policy,
--     no_primary_key).
--   - Configuration des connexions Auth (leaked password protection, MFA, etc.) : se gere
--     dans le dashboard Supabase, pas en SQL.
-- ============================================================================
