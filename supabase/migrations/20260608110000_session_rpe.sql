-- RPE de seance (optionnel) : difficulte globale ATTENDUE de la seance, posee
-- par le coach. Sensible au volume (ex. 10x200 VMA = RPE 6, 20x200 VMA = RPE 8).
-- Distincte de l'effort de zone PMA (rendu cote) et du RPE RESSENTI par
-- l'athlete (session_validations.rpe). Echelle 1-10. Jamais obligatoire.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_rpe smallint;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_session_rpe;
ALTER TABLE sessions ADD CONSTRAINT chk_session_rpe
  CHECK (session_rpe IS NULL OR (session_rpe >= 1 AND session_rpe <= 10));
