-- Coup de coeur du coach : une validation (compte-rendu) mise en avant au niveau
-- du club, affichée sur le Home de tous. Stocké sur club_settings (déjà
-- modifiable par les coachs via RLS), pas de nouvelle table.

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS featured_validation_id UUID REFERENCES session_validations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;
