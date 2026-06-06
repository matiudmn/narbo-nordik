-- Corrections de sécurité + bornes, suite à l'audit du retrait Strava / métriques.

-- 1. SÉCU CRITIQUE : _archive_strava_activities a été créée par CREATE TABLE AS
-- (migration 20260606140000) et n'a hérité ni de la RLS ni des policies de
-- strava_activities. Elle est donc lisible par anon/authenticated via PostgREST
-- (user_id, FC, device, raw_payload/GPS = données personnelles). On coupe l'accès.
REVOKE ALL ON public._archive_strava_activities FROM anon, authenticated;
ALTER TABLE public._archive_strava_activities ENABLE ROW LEVEL SECURITY;
-- RLS activée sans policy = aucune ligne visible aux rôles non-bypass.
-- service_role / postgres conservent l'accès pour un éventuel export ultérieur.

-- 2. SÉCU : la policy UPDATE de session_validations n'avait pas de WITH CHECK
-- (seulement USING). Un athlète pouvait réassigner sa propre validation à un
-- autre user_id (corruption de l'assiduité / du score de risque de la cible).
DROP POLICY IF EXISTS "Users can update their own validations" ON session_validations;
CREATE POLICY "Users can update their own validations" ON session_validations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Borne duration_s élargie (55 h -> 150 h) pour couvrir les ultra-trails longs.
ALTER TABLE session_validations DROP CONSTRAINT IF EXISTS chk_metrics_bounds;
ALTER TABLE session_validations
  ADD CONSTRAINT chk_metrics_bounds CHECK (
    (distance_m  IS NULL OR (distance_m  >= 0 AND distance_m  <= 500000)) AND
    (duration_s  IS NULL OR (duration_s  >= 0 AND duration_s  <= 540000)) AND
    (elevation_m IS NULL OR (elevation_m >= 0 AND elevation_m <= 20000))  AND
    (avg_hr      IS NULL OR (avg_hr      BETWEEN 20 AND 260)) AND
    (max_hr      IS NULL OR (max_hr      BETWEEN 20 AND 260)) AND
    (avg_cadence IS NULL OR (avg_cadence BETWEEN 0  AND 260))
  );
