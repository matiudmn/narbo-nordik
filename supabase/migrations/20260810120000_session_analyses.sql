-- Verdict IA par séance validée (extension C7 du backlog évolutions 2026,
-- lignes 862-1159 de BACKLOG-EVOLUTIONS-2026.md). Le backlog documente un
-- provider Claude (Anthropic) : décision produit du 2026-08-10, la stack
-- réellement en place reste Mistral via AI_BASE_URL (RGPD, cf.
-- ai-coach-summary / ai-ocr) — seul le PROVIDER change, le modèle de données
-- ci-dessous reprend l'intention du backlog (verdict structuré, cache par
-- validation) adaptée à ce provider.
--
-- Table additive, idempotente, SANS dépendance à une colonne qui n'existe pas
-- encore (contrairement à `20260731130000_invite_code.sql`, aucun cast local
-- n'est nécessaire côté SQL : les colonnes référencées, `session_validations.
-- id` et `.user_id`, existent depuis le baseline).
--
-- ÉCRITURE : réservée au service_role. Aucune policy INSERT/UPDATE n'est
-- posée pour `authenticated` : une fois RLS activée, l'ABSENCE de policy pour
-- une commande vaut refus total pour ce rôle (deny-by-default), donc pas de
-- REVOKE nécessaire (même raisonnement que les tables déjà en RLS-only du
-- dépôt). Seule la Edge Function `analyze-validation` écrit, avec la clé
-- service (qui contourne RLS). Le client n'insère/ne met jamais à jour
-- `session_analyses` directement.
--
-- LECTURE : propriétaire de la validation analysée + coachs. Plus restrictif
-- que `session_validations` elle-même (lecture club entière, décision
-- 2026-06-08 documentée dans MIGRATIONS.md) : un verdict IA nominatif n'a pas
-- la même vocation de transparence club qu'un compte-rendu de séance.
CREATE TABLE IF NOT EXISTS public.session_analyses (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id  UUID REFERENCES public.session_validations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  verdict        JSONB NOT NULL,
  model          TEXT NOT NULL,
  -- Garde-fou de coût : signature déterministe des champs de la validation
  -- ayant servi à générer ce verdict (feedback, ressenti, métriques...). La
  -- Edge Function recompare cette signature à celle de la validation courante
  -- avant d'appeler le fournisseur IA ; si elles sont identiques, elle
  -- renvoie l'analyse déjà stockée sans dépenser un appel. `session_validations`
  -- n'a pas de colonne `updated_at` (jamais ajoutée) : une signature de
  -- contenu remplace la comparaison par horodatage.
  input_hash     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_analyses_validation ON public.session_analyses(validation_id);

ALTER TABLE public.session_analyses ENABLE ROW LEVEL SECURITY;

-- Forme `(select auth.uid())` partout : `auth.uid()` nu réévalue la fonction
-- par ligne (plan `initplan` non caché), advisor `auth_rls_initplan` déjà
-- corrigé sur tout le reste du dépôt par l'entrée 26
-- (`20260730120000_security_perf_hardening.sql`) — on ne réintroduit pas la
-- régression sur une table neuve.
DROP POLICY IF EXISTS "Owner reads own session analysis" ON public.session_analyses;
CREATE POLICY "Owner reads own session analysis" ON public.session_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_validations sv
      WHERE sv.id = session_analyses.validation_id
        AND sv.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Coaches read all session analyses" ON public.session_analyses;
CREATE POLICY "Coaches read all session analyses" ON public.session_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid()) AND u.role = 'coach'
    )
  );

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated/anon : voir note en
-- tête de fichier. service_role contourne RLS nativement (comme le reste du
-- dépôt, cf. daily-session-digest / weekly-digest / send-notification-email).
