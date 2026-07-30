-- ============================================================================
-- exit_feedbacks : régularisation de la dérive prod + remise en service
-- de l'enquête de suppression de compte (projet Narbo_Nordik / jubvxfjxokeefhfmjhwl)
-- ----------------------------------------------------------------------------
-- NON APPLIQUÉE À LA PROD : rédigée en lecture seule, en attente d'un
-- `supabase db push` explicite après revue.
--
-- ----------------------------------------------------------------------------
-- 1. CE QUI A ÉTÉ LU EN PROD (2026-07-30, lecture seule)
-- ----------------------------------------------------------------------------
-- Le serveur MCP Supabase n'était pas connecté et psql/Docker sont absents du
-- poste. Trois sources de lecture indépendantes ont malgré tout pu être
-- interrogées, et elles concordent :
--
--   (a) `supabase gen types typescript --linked` (schéma distant réel) :
--         exit_feedbacks.Row    -> user_id: string        => colonne NOT NULL
--         exit_feedbacks.Insert -> user_id: string        => AUCUN DEFAULT
--                                  (comparer : id?, created_at?, donc à défaut)
--         exit_feedbacks.Relationships: []                => AUCUNE clé étrangère
--   (b) sondes PostgREST avec la clé anon :
--         ?select=user_id     -> 200 []   => la colonne existe
--         ?select=zzz_nope    -> 42703    => contrôle négatif, la sonde discrimine
--         ?user_id=eq.xxx     -> 22P02 "invalid input syntax for type uuid"
--         ?select=id,users(id)-> PGRST200 => pas de FK vers public.users
--   (c) `supabase inspect db table-stats/vacuum-stats --linked` :
--         public.exit_feedbacks : 0 ligne, jamais analysée, 0 ligne morte
--         => la table n'a JAMAIS contenu la moindre ligne validée.
--
-- Les DÉFINITIONS des policies live n'ont pas eu à être devinées : elles sont
-- exactement celles que 20260730120000 (appliquée en prod le 2026-07-30) a
-- posées, soit
--     INSERT "Users can insert their own feedback" WITH CHECK ((select auth.uid()) = user_id)
--     SELECT "Users can read their own feedback"   USING      ((select auth.uid()) = user_id)
-- Le fait même que cet ALTER POLICY soit passé en prod prouve, en retour, que
-- la colonne et ces deux policies y existent bien.
--
-- ----------------------------------------------------------------------------
-- 2. CE QUE ÇA CASSE (reproduit sur Postgres, 11/11 vérifications)
-- ----------------------------------------------------------------------------
--   * L'app insère {reason, comment} SANS user_id (src/pages/athlete/Profile.tsx:149).
--     La policy INSERT exige (select auth.uid()) = user_id : l'insert est REJETÉ
--     en 42501 (la violation RLS précède même le NOT NULL). Profile.tsx ne teste
--     pas l'erreur retournée et enchaîne sur la suppression du compte : chaque
--     réponse à l'enquête est perdue en silence. La table vide (§1c) le confirme.
--   * La policy SELECT limite la lecture à l'auteur de la ligne, dont le compte
--     vient précisément d'être supprimé : PERSONNE ne peut lire ces retours, et
--     surtout pas un coach. La finalité de l'enquête est inatteignable.
--   * Un user_id NOT NULL rend l'enquête nominative, alors que la modale de
--     suppression promet la suppression de « toutes vos données personnelles »
--     (Profile.tsx:1011) et que le dépôt la documente comme anonyme.
--
-- La question de sécurité laissée ouverte dans le baseline (§ dérives
-- « dashboard ») est donc tranchée : la policy SELECT live n'est PAS permissive,
-- les motifs de départ ne sont pas sur-exposés aux membres. Le problème réel est
-- l'inverse : la table est inexploitable et nominative.
--
-- ----------------------------------------------------------------------------
-- 3. DÉCISION
-- ----------------------------------------------------------------------------
-- Retour à l'intention documentée : enquête ANONYME, lisible par les coachs.
--   * DROP de user_id : aucune perte de données (table vide, §1c), l'anonymat
--     redevient une propriété du schéma et non une promesse d'interface, et
--     l'app refonctionne SANS modification.
--   * INSERT ouvert aux authentifiés (WITH CHECK true) : sans user_id il n'y a
--     plus rien à contrôler ligne à ligne. La policy est renommée
--     "Authenticated can insert exit feedbacks" pour ne plus annoncer un
--     « their own » qui n'existe pas (même convention que notifications).
--   * SELECT rendu aux coachs.
--
-- Alternative écartée : garder user_id et corriger l'app pour qu'elle l'envoie.
-- Elle conserverait un identifiant nominatif d'un membre parti, sans FK ni
-- cascade, en contradiction avec la promesse d'effacement total, et ne rendrait
-- toujours pas les retours lisibles par un coach.
--
-- ORDRE : les policies doivent tomber AVANT la colonne (elles en dépendent,
-- sinon Postgres refuse le DROP COLUMN). Migration rejouable telle quelle.
--
-- ROLLBACK :
--   ALTER TABLE public.exit_feedbacks ADD COLUMN user_id uuid NOT NULL;
--   DROP POLICY "Authenticated can insert exit feedbacks" ON public.exit_feedbacks;
--   DROP POLICY "Coaches can read exit feedbacks" ON public.exit_feedbacks;
--   CREATE POLICY "Users can insert their own feedback" ON public.exit_feedbacks
--     FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));
--   CREATE POLICY "Users can read their own feedback" ON public.exit_feedbacks
--     FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
-- ============================================================================

DROP POLICY IF EXISTS "Users can read their own feedback"       ON public.exit_feedbacks;
DROP POLICY IF EXISTS "Coaches can read exit feedbacks"         ON public.exit_feedbacks;
DROP POLICY IF EXISTS "Users can insert their own feedback"     ON public.exit_feedbacks;
DROP POLICY IF EXISTS "Authenticated can insert exit feedbacks" ON public.exit_feedbacks;

ALTER TABLE public.exit_feedbacks DROP COLUMN IF EXISTS user_id;

COMMENT ON TABLE public.exit_feedbacks IS
  'Enquête de sortie ANONYME (suppression de compte). Ne jamais y ajouter de '
  'colonne identifiante : la modale de suppression promet l''effacement total '
  'des données personnelles.';

-- Insertion : plus rien à contrôler ligne à ligne une fois la table anonyme.
CREATE POLICY "Authenticated can insert exit feedbacks" ON public.exit_feedbacks
  FOR INSERT TO authenticated WITH CHECK (true);

-- Lecture : coachs uniquement. auth.uid() encapsulé en (select ...) pour ne pas
-- réintroduire l'advisor auth_rls_initplan corrigé par 20260730120000.
CREATE POLICY "Coaches can read exit feedbacks" ON public.exit_feedbacks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users
                 WHERE users.id = (select auth.uid()) AND users.role = 'coach'));
