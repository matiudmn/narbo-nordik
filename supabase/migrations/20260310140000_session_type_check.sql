-- Add velo, marche, renfo to allowed session_type values
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;

ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type = ANY (ARRAY['entrainement', 'sortie_longue', 'recuperation', 'velo', 'marche', 'renfo']));
