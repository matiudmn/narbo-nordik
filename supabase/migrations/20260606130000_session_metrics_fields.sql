-- Saisie de métriques de séance (remplacement de Strava).
-- Les chiffres d'une séance réalisée (distance, durée, D+, FC, cadence) sont
-- portés par le compte-rendu, déjà 1:1 avec (session, user) dans session_validations.
-- On étend donc cette table plutôt que d'en créer une seconde.
-- Colonnes additives nullable : aucune régression, RLS héritée des policies
-- existantes de session_validations. L'allure n'est pas stockée (dérivée).

ALTER TABLE session_validations
  ADD COLUMN IF NOT EXISTS distance_m     INTEGER,   -- mètres
  ADD COLUMN IF NOT EXISTS duration_s     INTEGER,   -- secondes (temps en mouvement)
  ADD COLUMN IF NOT EXISTS elevation_m    INTEGER,   -- D+ mètres
  ADD COLUMN IF NOT EXISTS avg_hr         SMALLINT,  -- FC moyenne bpm
  ADD COLUMN IF NOT EXISTS max_hr         SMALLINT,  -- FC max bpm
  ADD COLUMN IF NOT EXISTS avg_cadence    SMALLINT,  -- cadence moyenne (ppm)
  ADD COLUMN IF NOT EXISTS metrics_source TEXT;      -- 'manual' | 'ocr' | 'watch'

ALTER TABLE session_validations DROP CONSTRAINT IF EXISTS chk_metrics_source;
ALTER TABLE session_validations
  ADD CONSTRAINT chk_metrics_source
  CHECK (metrics_source IS NULL OR metrics_source IN ('manual', 'ocr', 'watch'));

-- Bornes de cohérence (saisie humaine), tolérantes mais anti-aberration.
ALTER TABLE session_validations DROP CONSTRAINT IF EXISTS chk_metrics_bounds;
ALTER TABLE session_validations
  ADD CONSTRAINT chk_metrics_bounds CHECK (
    (distance_m  IS NULL OR (distance_m  >= 0 AND distance_m  <= 500000)) AND
    (duration_s  IS NULL OR (duration_s  >= 0 AND duration_s  <= 200000)) AND
    (elevation_m IS NULL OR (elevation_m >= 0 AND elevation_m <= 20000))  AND
    (avg_hr      IS NULL OR (avg_hr      BETWEEN 20 AND 260)) AND
    (max_hr      IS NULL OR (max_hr      BETWEEN 20 AND 260)) AND
    (avg_cadence IS NULL OR (avg_cadence BETWEEN 0  AND 260))
  );
