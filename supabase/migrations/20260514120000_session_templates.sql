-- ============================================================
-- Phase 7 — Session templates (coach)
-- ------------------------------------------------------------
-- Permet aux coachs de :
--   - Choisir une séance depuis une bibliothèque de templates
--   - Sauvegarder une séance en cours comme template du club
--   - Dupliquer une séance depuis la semaine passée
--
-- 10 templates seed pré-installés couvrant les besoins courants
-- d'un club running (VMA, seuil, endurance, sortie longue, côtes,
-- pyramide, allure spécifique, récup).
-- ============================================================

CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('vma', 'seuil', 'endurance', 'sortie_longue', 'recup', 'autre')),
  session_type TEXT NOT NULL CHECK (session_type IN ('entrainement', 'sortie_longue', 'recuperation', 'velo', 'marche', 'renfo', 'course')),
  terrain_options JSONB DEFAULT '[]'::jsonb,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seed BOOLEAN DEFAULT FALSE,            -- True = template système non supprimable
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_templates_category ON session_templates(category);
CREATE INDEX IF NOT EXISTS idx_session_templates_created_by ON session_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_session_templates_usage ON session_templates(usage_count DESC);

-- ============================================================
-- RLS — lecture par tous, écriture coach uniquement
-- ============================================================

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session templates are readable by authenticated users"
  ON session_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Coaches can insert templates"
  ON session_templates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

CREATE POLICY "Coaches can update non-seed templates"
  ON session_templates FOR UPDATE
  USING (
    is_seed = FALSE
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

CREATE POLICY "Coaches can delete non-seed templates"
  ON session_templates FOR DELETE
  USING (
    is_seed = FALSE
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

-- ============================================================
-- Increment usage_count helper (appelé après instanciation)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE session_templates SET usage_count = usage_count + 1 WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Seeds — 10 templates running pré-installés
--
-- Note sur les blocs : on respecte la structure SessionBlock
-- { id, type, allure, duration_seconds, distance_meters, repetitions, rest_seconds, rest_distance_meters }
-- Les `id` à l'intérieur de blocs seront régénérés par le client
-- au moment de l'instanciation (genBlockId).
-- ============================================================

INSERT INTO session_templates (name, description, category, session_type, terrain_options, blocks, is_seed)
VALUES
-- 1. VMA 30/30
(
  'VMA 30/30',
  'Échauffement EF · 12×(30''VMA / 30''récup) · Retour au calme',
  'vma',
  'entrainement',
  '["piste"]'::jsonb,
  '[
    {"id":"seed-1-1","type":"echauffement","allure":"ef","duration_seconds":1200,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-1-2","type":"travail","allure":"vma","duration_seconds":30,"distance_meters":null,"repetitions":12,"rest_seconds":30,"rest_distance_meters":null},
    {"id":"seed-1-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 2. Fartlek 10×400m piste
(
  'Fartlek 10×400m piste',
  'Échauffement 15'' · 10×400m VMA r=90'' · Retour 10''',
  'vma',
  'entrainement',
  '["piste"]'::jsonb,
  '[
    {"id":"seed-2-1","type":"echauffement","allure":"ef","duration_seconds":900,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-2-2","type":"travail","allure":"vma","duration_seconds":0,"distance_meters":400,"repetitions":10,"rest_seconds":90,"rest_distance_meters":null},
    {"id":"seed-2-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 3. Seuil 3×10' continu
(
  'Seuil 3×10'' continu',
  'Échauffement 15'' · 3×10'' SV2 r=2''EF · Retour 10''',
  'seuil',
  'entrainement',
  '[]'::jsonb,
  '[
    {"id":"seed-3-1","type":"echauffement","allure":"ef","duration_seconds":900,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-3-2","type":"travail","allure":"sv2","duration_seconds":600,"distance_meters":null,"repetitions":3,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-3-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 4. Seuil 6×1000m
(
  'Seuil 6×1000m',
  'Échauffement 20'' · 6×1000m SV2 r=2''EF · Retour 10''',
  'seuil',
  'entrainement',
  '["piste"]'::jsonb,
  '[
    {"id":"seed-4-1","type":"echauffement","allure":"ef","duration_seconds":1200,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-4-2","type":"travail","allure":"sv2","duration_seconds":0,"distance_meters":1000,"repetitions":6,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-4-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 5. Pyramide 400-800-1200-800-400
(
  'Pyramide 400-800-1200-800-400',
  'Échauffement 15'' · pyramide VMA→SV2 r=2'' · Retour 10''',
  'vma',
  'entrainement',
  '["piste"]'::jsonb,
  '[
    {"id":"seed-5-1","type":"echauffement","allure":"ef","duration_seconds":900,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-5-2","type":"travail","allure":"vma","duration_seconds":0,"distance_meters":400,"repetitions":1,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-5-3","type":"travail","allure":"vma","duration_seconds":0,"distance_meters":800,"repetitions":1,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-5-4","type":"travail","allure":"sv2","duration_seconds":0,"distance_meters":1200,"repetitions":1,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-5-5","type":"travail","allure":"vma","duration_seconds":0,"distance_meters":800,"repetitions":1,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-5-6","type":"travail","allure":"vma","duration_seconds":0,"distance_meters":400,"repetitions":1,"rest_seconds":120,"rest_distance_meters":null},
    {"id":"seed-5-7","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 6. Endurance fondamentale 1h
(
  'Endurance fondamentale 1h',
  '1h en endurance fondamentale en continu',
  'endurance',
  'entrainement',
  '[]'::jsonb,
  '[
    {"id":"seed-6-1","type":"travail","allure":"ef","duration_seconds":3600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 7. Sortie longue 2h
(
  'Sortie longue 2h',
  '2h EF avec 3×10'' SV1 en cœur de sortie',
  'sortie_longue',
  'sortie_longue',
  '[]'::jsonb,
  '[
    {"id":"seed-7-1","type":"travail","allure":"ef","duration_seconds":2400,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-7-2","type":"travail","allure":"sv1","duration_seconds":600,"distance_meters":null,"repetitions":3,"rest_seconds":300,"rest_distance_meters":null},
    {"id":"seed-7-3","type":"travail","allure":"ef","duration_seconds":1200,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 8. Allure spécifique semi 4×2km
(
  'Allure spécifique semi 4×2km',
  'Échauffement 20'' · 4×2km AS21 r=2''30'' · Retour 10''',
  'seuil',
  'entrainement',
  '[]'::jsonb,
  '[
    {"id":"seed-8-1","type":"echauffement","allure":"ef","duration_seconds":1200,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-8-2","type":"travail","allure":"as21","duration_seconds":0,"distance_meters":2000,"repetitions":4,"rest_seconds":150,"rest_distance_meters":null},
    {"id":"seed-8-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 9. Côtes 8×30''
(
  'Côtes 8×30''',
  'Échauffement 15'' · 8×30'' côte récup descente · Retour 10''',
  'vma',
  'entrainement',
  '["cotes"]'::jsonb,
  '[
    {"id":"seed-9-1","type":"echauffement","allure":"ef","duration_seconds":900,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null},
    {"id":"seed-9-2","type":"travail","allure":"vma","duration_seconds":30,"distance_meters":null,"repetitions":8,"rest_seconds":90,"rest_distance_meters":null},
    {"id":"seed-9-3","type":"retour_au_calme","allure":"ef","duration_seconds":600,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
),

-- 10. Récupération 40'
(
  'Récupération 40''',
  '40'' AER en continu — séance de décompression',
  'recup',
  'recuperation',
  '[]'::jsonb,
  '[
    {"id":"seed-10-1","type":"travail","allure":"aer","duration_seconds":2400,"distance_meters":null,"repetitions":1,"rest_seconds":0,"rest_distance_meters":null}
  ]'::jsonb,
  TRUE
);
