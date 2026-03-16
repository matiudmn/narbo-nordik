-- Add comment field to race_results
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

-- Add 'course' to allowed session_type values
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type = ANY (ARRAY['entrainement', 'sortie_longue', 'recuperation', 'velo', 'marche', 'renfo', 'course']));
