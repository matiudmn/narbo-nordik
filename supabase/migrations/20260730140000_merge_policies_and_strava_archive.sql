-- ============================================================================
-- Advisors Supabase restants (projet Narbo_Nordik / jubvxfjxokeefhfmjhwl)
-- ----------------------------------------------------------------------------
-- Traite les deux familles d'advisors laissées hors périmètre par
-- 20260730120000_security_perf_hardening.sql (PR #40) :
--   1. multiple_permissive_policies sur public.sessions (INSERT/UPDATE/DELETE)
--      et public.users (INSERT/UPDATE) : fusion en une policy par action.
--   2. public._archive_strava_activities : rls_enabled_no_policy + no_primary_key.
--
-- ORDRE : cette migration suppose 20260730120000 déjà appliquée, ce qui est le
-- cas en prod (vérifié le 2026-07-30 via `supabase migration list --linked` :
-- 20260730120000 est appliquée, 20260730140000 ne l'est pas). Les expressions
-- reprises ci-dessous sont celles que cette migration laisse en place, c'est à
-- dire avec auth.uid() encapsulé en (select auth.uid()). Recréer les policies
-- fusionnées sous la forme non encapsulée réintroduirait l'advisor
-- auth_rls_initplan que la PR #40 vient de corriger.
--
-- NON APPLIQUÉE À LA PROD : aucune écriture n'a été faite pendant sa rédaction.
-- Elle attend une revue puis un `supabase db push` explicite.
--
-- ----------------------------------------------------------------------------
-- TRAÇABILITÉ DES SOURCES (à lire avant revue)
-- ----------------------------------------------------------------------------
-- Contrairement à 20260730120000, aucune relecture directe de pg_policies n'a pu
-- être faite pour cette migration : le serveur MCP Supabase n'était pas connecté
-- à la session et l'accès au token du CLI a été refusé. Seul
-- `supabase migration list --linked` a pu être interrogé (il ne lit que le
-- registre des migrations, pas les policies). Les EXPRESSIONS
-- proviennent de deux sources concordantes, (a) et (b). Une troisième source,
-- (c), ne dit rien des expressions mais confirme l'INVENTAIRE et les RÔLES :
--   (a) les migrations du dépôt, source de vérité déclarée (cf. MIGRATIONS.md) :
--       20260307000000_baseline.sql, 20260310120000_personal_sessions_rls.sql ;
--   (b) la section 6 de 20260730120000_security_perf_hardening.sql, recopiée
--       depuis pg_policies le 2026-07-30 ;
--   (c) la sortie de l'advisor multiple_permissive_policies lui-même, qui
--       énumère exactement DEUX policies permissives par action concernée
--       (athlètes + coachs). C'est une confirmation tierce de l'inventaire :
--       s'il existait une troisième policy permissive en prod sur ces actions,
--       l'advisor l'aurait listée.
--
-- Portée exacte de (b) : la section 6 ne contient QUE les policies signalées par
-- auth_rls_initplan, donc uniquement celles dont l'expression appelle auth.*.
-- Ce n'est pas un dump complet de pg_policies (« Users can read all profiles »,
-- en USING (true), n'y figure pas). Les 10 policies fusionnées ici appellent
-- toutes auth.uid(), elles sont donc bien toutes couvertes par (b) ; mais la
-- mention « inventaire exhaustif » ne vaut que pour le DÉPÔT, l'exhaustivité
-- côté prod reposant sur (c).
--
-- Pourquoi (b) est crédible comme reflet de la PROD et pas du dépôt : sur
-- exit_feedbacks, (b) écrit `auth.uid() = user_id` alors que le dépôt n'a ni
-- colonne user_id ni policy « Users can read their own feedback » (baseline
-- lignes 172-177 et 361-377). Sur ce point précis, (b) suit donc la prod contre
-- le dépôt. Ce n'est pas une supposition : 20260730120000 a été appliquée avec
-- succès en prod, et un `ALTER POLICY` sur une colonne ou une policy absente
-- échoue. La prod possède donc bel et bien cette colonne et cette policy. Sur les 10 policies fusionnées ici, (b) et (a) coïncident, ce dont
-- on INFÈRE que prod et dépôt sont alignés pour sessions/users. C'est une
-- inférence, pas un fait re-vérifiable dans cette session : elle repose sur une
-- transcription faite ailleurs, d'où le contrôle pré-push obligatoire ci-dessous.
-- (Cette dérive exit_feedbacks est un défaut réel de 20260730120000, qui casse
-- `supabase db reset` ; traitée hors de cette migration, voir la PR.)
--
-- ----------------------------------------------------------------------------
-- ANALYSE DE RISQUE DE LA FUSION (dans les deux sens)
-- ----------------------------------------------------------------------------
-- Sens 1, élargissement : IMPOSSIBLE par construction. Chaque policy fusionnée
--   vaut exactement (A OR B), A et B étant les deux policies remplacées. Si un
--   `DROP POLICY IF EXISTS` ne trouvait pas sa cible (nom divergent en prod),
--   l'ancienne policy survivrait à côté de la fusionnée : les policies
--   permissives s'additionnant en OR, l'accès effectif resterait (A OR B), donc
--   identique. Seul l'advisor continuerait d'être signalé.
-- Sens 2, restriction : c'était LE risque résiduel. Une policy prod de MÊME NOM
--   mais d'expression plus large que celle du dépôt serait remplacée en silence
--   par une version plus restrictive, d'où une perte d'accès sur les écritures
--   de sessions/users. Ce risque est désormais très réduit par un fait
--   vérifiable : 20260730120000 EST appliquée en prod, or ses 44 instructions
--   de section 6 sont des `ALTER POLICY`, qui n'acceptent pas de `IF EXISTS` et
--   échouent sur une policy inexistante. Son application réussie prouve donc
--   (i) que les 10 policies visées ici existent bien en prod sous ces noms
--   exacts, et (ii) que leurs `qual`/`with_check` en prod sont exactement ceux
--   que 20260730120000 y a écrits, c'est à dire la source (b) reprise ici.
--   Ce qui reste NON prouvé : les RÔLES, qu'un `ALTER POLICY` ne modifie pas et
--   que (b) ne documente donc pas. C'est la partie la plus utile du contrôle
--   ci-dessous.
--   MITIGATION OBLIGATOIRE : AVANT le `db push`, exécuter en lecture seule
--     SELECT policyname, permissive, roles, cmd, qual, with_check
--       FROM pg_policies
--      WHERE schemaname = 'public' AND tablename IN ('sessions','users')
--      ORDER BY tablename, cmd, policyname;
--   et comparer aux expressions ci-dessous. Les colonnes `permissive` et `roles`
--   ne sont pas optionnelles dans ce contrôle : une policy prod PERMISSIVE mais
--   ciblant un rôle différent (TO public au lieu de TO authenticated) serait
--   invisible de (b), et la fusion la restreindrait silencieusement. Le SQL de
--   rollback figure dans la PR.
--
-- SÉMANTIQUE UPDATE (point de vigilance de la fusion)
--   Les policies UPDATE remplacées n'ont pas de WITH CHECK. Postgres applique
--   alors l'expression USING également à la nouvelle ligne. Avant fusion, la
--   nouvelle ligne devait donc satisfaire (CHECK_A OR CHECK_B) = (USING_A OR
--   USING_B). Les policies fusionnées omettent elles aussi WITH CHECK, ce qui
--   redonne exactement (A OR B) sur la nouvelle ligne. Comportement inchangé.
-- ============================================================================

-- ============================================================================
-- 1. public.sessions : fusion athlètes + coachs (INSERT / UPDATE / DELETE)
-- ============================================================================
-- Expressions sources, identiques pour les trois actions :
--   A (athlètes, séances perso, 20260310120000) :
--       (is_personal = true) AND (created_by = (select auth.uid()))
--   B (coachs, baseline) :
--       EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid())
--                                     AND users.role = 'coach')
-- Rôle : les deux policies ciblent TO authenticated d'après (a), corroboré par
-- (c) qui rapporte ses doublons PAR rôle. La source (b) est muette sur ce point
-- (ses ALTER POLICY n'ont aucune clause TO, ALTER ne pouvant pas changer les
-- rôles). La fusion est donc légitime : même rôle, même action. Fusionner des
-- policies de rôles différents serait faux, d'où le contrôle pré-push sur la
-- colonne `roles`.
-- La policy SELECT « Sessions are readable by authenticated users » n'est PAS
-- concernée : elle est seule sur son action, l'advisor ne la signale pas.

DROP POLICY IF EXISTS "Athletes can insert personal sessions" ON public.sessions;
DROP POLICY IF EXISTS "Coaches can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Athletes or coaches can insert sessions" ON public.sessions;
CREATE POLICY "Athletes or coaches can insert sessions" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    ((is_personal = true) AND (created_by = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM public.users
                 WHERE users.id = (select auth.uid()) AND users.role = 'coach'))
  );

DROP POLICY IF EXISTS "Athletes can update personal sessions" ON public.sessions;
DROP POLICY IF EXISTS "Coaches can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Athletes or coaches can update sessions" ON public.sessions;
CREATE POLICY "Athletes or coaches can update sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (
    ((is_personal = true) AND (created_by = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM public.users
                 WHERE users.id = (select auth.uid()) AND users.role = 'coach'))
  );

DROP POLICY IF EXISTS "Athletes can delete personal sessions" ON public.sessions;
DROP POLICY IF EXISTS "Coaches can delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Athletes or coaches can delete sessions" ON public.sessions;
CREATE POLICY "Athletes or coaches can delete sessions" ON public.sessions
  FOR DELETE TO authenticated
  USING (
    ((is_personal = true) AND (created_by = (select auth.uid())))
    OR (EXISTS (SELECT 1 FROM public.users
                 WHERE users.id = (select auth.uid()) AND users.role = 'coach'))
  );

-- ============================================================================
-- 2. public.users : fusion profil propre + coachs (INSERT / UPDATE)
-- ============================================================================
-- Expressions sources, identiques pour les deux actions :
--   A (profil propre, baseline) : (select auth.uid()) = id
--   B (coachs, baseline) :
--       EXISTS (SELECT 1 FROM users users_1 WHERE users_1.id = (select auth.uid())
--                                             AND users_1.role = 'coach')
-- L'alias est nécessaire ici : la sous-requête interroge la table même sur
-- laquelle porte la policy. pg_policies rend cet alias `users_1` ; on le nomme
-- explicitement `u` pour la lisibilité, la sémantique est identique (le `id` du
-- premier membre reste lié à la ligne externe, hors des parenthèses du EXISTS).
-- Rôle : TO authenticated pour les quatre policies d'après (a), corroboré par
-- (c) ; (b) est muette sur les rôles (cf. section 1).
-- Les policies SELECT (« Users can read all profiles ») et DELETE (« Coaches can
-- delete users ») ne sont PAS concernées : seules sur leur action.
--
-- DÉPENDANCE À CONNAÎTRE (inchangée par la fusion, mais latente) : le EXISTS
-- interroge `users` depuis une policy sur `users`. Postgres n'entre pas en
-- récursion parce que la policy SELECT appliquée à la sous-requête est
-- « Users can read all profiles » en USING (true), qui ne contient elle-même
-- aucune sous-requête. Si cette policy SELECT était un jour resserrée avec un
-- EXISTS sur `users`, la récursion se produirait sur la policy SELECT elle-même :
-- non seulement les écritures, mais aussi les LECTURES de `users` échoueraient en
-- « infinite recursion detected in policy for relation users ».

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Coaches can insert users" ON public.users;
DROP POLICY IF EXISTS "Users or coaches can insert user profiles" ON public.users;
CREATE POLICY "Users or coaches can insert user profiles" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    ((select auth.uid()) = id)
    OR (EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (select auth.uid()) AND u.role = 'coach'))
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Coaches can update any user" ON public.users;
DROP POLICY IF EXISTS "Users or coaches can update user profiles" ON public.users;
CREATE POLICY "Users or coaches can update user profiles" ON public.users
  FOR UPDATE TO authenticated
  USING (
    ((select auth.uid()) = id)
    OR (EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (select auth.uid()) AND u.role = 'coach'))
  );

-- ============================================================================
-- 3. public._archive_strava_activities
-- ============================================================================
-- Contexte : copie brute de strava_activities faite par 20260606140000 avant le
-- retrait total de Strava (20260606150000). Créée par `CREATE TABLE AS`, donc
-- sans clé primaire, sans NOT NULL et sans RLS héritées. 20260606160000 a coupé
-- l'accès API (REVOKE ALL sur anon/authenticated + ENABLE ROW LEVEL SECURITY
-- sans policy), en gardant l'accès service_role/postgres pour un export ultérieur.
--
-- DÉCISION : cette migration ne tranche PAS le sort de la table. Celle-ci
-- contient des données personnelles (user_id, fréquence cardiaque, device,
-- raw_payload avec les traces GPS) et sa suppression est irréversible : elle
-- relève d'un « go » explicite, pas d'une migration de nettoyage d'advisors. On
-- constate donc qu'à ce jour la table est conservée, et on refuse de la laisser
-- dans un état ambigu : deny-all explicite et durable, plus une clé primaire. Si
-- la décision de suppression tombe ensuite, un `DROP TABLE` emporte tout cela
-- sans laisser de trace.
--
-- À TRANCHER (hors de cette migration, voir la PR) : la finalité du traitement a
-- disparu avec l'intégration Strava le 2026-06-06 et les métriques utiles ont
-- déjà été rapatriées dans session_validations par le backfill 20260606140000.
-- Conserver ces données sans durée de conservation définie est une dette RGPD.
-- Si l'archive n'est plus utile, la bonne suite est une migration dédiée
-- `DROP TABLE public._archive_strava_activities;` qui rend caduque toute la
-- section 3.

-- 3a. rls_enabled_no_policy. « RLS activée sans aucune policy » est
-- indiscernable, pour un relecteur comme pour un futur audit, d'un oubli de
-- policy. On matérialise le deny-all voulu par 20260606160000 au lieu de le
-- laisser implicite.
-- La policy est RESTRICTIVE et non permissive, à dessein : une permissive en
-- USING (false) n'apporterait rien, les permissives s'additionnant en OR. Ce
-- n'est pas théorique, c'est vérifié sur Postgres : avec la variante permissive,
-- l'ajout ultérieur d'une simple policy « FOR SELECT TO authenticated USING
-- (true) » rouvre l'archive EN ENTIER, raw_payload GPS compris ; avec la
-- variante RESTRICTIVE, la même policy ajoutée ne donne toujours rien, la
-- restrictive se combinant en AND.
-- Ciblage TO public et non TO anon/authenticated : une policy restrictive ne
-- s'applique qu'aux rôles qu'elle liste, donc restreindre la liste laisserait
-- passer tout futur rôle non-BYPASSRLS. TO public ferme cela sans rien coûter
-- aux accès d'export documentés par 20260606160000 : service_role a BYPASSRLS
-- (la RLS n'est jamais évaluée pour lui) et postgres est propriétaire (aucun
-- FORCE ROW LEVEL SECURITY sur la table). Aucun changement d'accès aujourd'hui :
-- anon/authenticated n'ont de toute façon aucun GRANT sur cette table.
-- L'absence de FORCE ROW LEVEL SECURITY est une prémisse de ce raisonnement :
-- si on l'activait un jour sur cette table, la restrictive TO public
-- s'appliquerait aussi au propriétaire et couperait l'export côté postgres ;
-- l'export via service_role (BYPASSRLS) continuerait, lui, de fonctionner.
DROP POLICY IF EXISTS "Strava archive is deny-all" ON public._archive_strava_activities;
CREATE POLICY "Strava archive is deny-all" ON public._archive_strava_activities
  AS RESTRICTIVE
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- 3b. no_primary_key. La colonne `id` provient de strava_activities où elle était
-- `UUID DEFAULT gen_random_uuid() PRIMARY KEY` (20260317200000) : les valeurs
-- copiées sont donc uniques et non nulles. `CREATE TABLE AS` ne copie ni la
-- contrainte ni le NOT NULL, d'où l'advisor. La copie a été faite en une seule
-- instruction `CREATE TABLE IF NOT EXISTS ... AS TABLE`, non rejouable, et aucune
-- écriture n'est possible depuis (aucun GRANT anon/authenticated, aucune
-- référence dans src/ ni dans les Edge Functions). L'ajout de la clé primaire ne
-- peut donc pas échouer, y compris sur une base reconstruite où la table est vide.
-- Le bloc DO rend l'instruction rejouable : `ADD CONSTRAINT` n'accepte pas de
-- `IF NOT EXISTS` en PostgreSQL, et tout le reste du fichier est idempotent.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public._archive_strava_activities'::regclass
                    AND contype = 'p') THEN
    ALTER TABLE public._archive_strava_activities
      ADD CONSTRAINT _archive_strava_activities_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ============================================================================
-- Reste hors périmètre après cette migration :
--   - Configuration Auth (leaked password protection, MFA) : dashboard Supabase,
--     pas de SQL possible.
--   - Sort définitif de _archive_strava_activities : décision produit/RGPD.
--   - Dérive exit_feedbacks introduite par 20260730120000 (colonne user_id et
--     policy SELECT absentes du dépôt) : casse `supabase db reset`, à régulariser
--     dans le baseline. Voir la PR.
--   - Escalade de privilège préexistante sur users : les policies UPDATE/INSERT
--     contrôlent la LIGNE, jamais les COLONNES. Un athlète peut donc passer son
--     propre `role` à 'coach'. Inchangé par cette fusion (vérifié avant/après),
--     donc non traité ici, mais à corriger. Voir la PR.
-- ============================================================================
