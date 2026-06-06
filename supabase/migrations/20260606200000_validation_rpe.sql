-- RPE (ressenti d'effort 1-10) sur le compte-rendu de séance. Complète les
-- sensations par une mesure d'intensité perçue, utile au coach.
ALTER TABLE session_validations ADD COLUMN IF NOT EXISTS rpe SMALLINT;
ALTER TABLE session_validations DROP CONSTRAINT IF EXISTS chk_rpe;
ALTER TABLE session_validations ADD CONSTRAINT chk_rpe CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10));
