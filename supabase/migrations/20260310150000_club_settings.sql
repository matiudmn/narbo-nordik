-- Table for club-level settings (allure config, etc.)
CREATE TABLE IF NOT EXISTS club_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_paces JSONB NOT NULL DEFAULT '{}'::jsonb,
  allure_zones JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read club settings
CREATE POLICY "Anyone can read club settings" ON club_settings
  FOR SELECT TO authenticated USING (true);

-- Only coaches can update
CREATE POLICY "Coaches can update club settings" ON club_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'coach'));

CREATE POLICY "Coaches can insert club settings" ON club_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'coach'));

-- Insert default row with pctByLevel arrays: [debutant, intermediaire, confirme, avance, elite]
INSERT INTO club_settings (race_paces, allure_zones) VALUES (
  '{
    "ef":   { "label": "EF",   "pctByLevel": [60, 65, 65, 65, 65],      "color": "#22c55e", "description": "Endurance fondamentale" },
    "am":   { "label": "AM",   "pctByLevel": [72, 75, 77, 79, 80],      "color": "#10b981", "description": "Aerobie modere" },
    "sa1":  { "label": "SA1",  "pctByLevel": [75, 78, 78, 80, 82],      "color": "#3b82f6", "description": "Seuil aerobie" },
    "sa2":  { "label": "SA2",  "pctByLevel": [83, 85, 87, 88, 89],      "color": "#8b5cf6", "description": "Seuil anaerobie" },
    "as42": { "label": "AS42", "pctByLevel": [75, 77, 78, 79, 80],      "color": "#eab308", "description": "Marathon" },
    "as21": { "label": "AS21", "pctByLevel": [82, 83, 84, 85, 85],      "color": "#f97316", "description": "Semi-marathon" },
    "as10": { "label": "AS10", "pctByLevel": [88, 89, 89, 90, 91],      "color": "#ef4444", "description": "10 km" },
    "vma":  { "label": "VMA",  "pctByLevel": [100, 100, 100, 100, 100], "color": "#dc2626", "description": "VMA" }
  }'::jsonb,
  '{
    "ef":        { "label": "EF",        "pctMin": 60, "pctMax": 65, "color": "#22c55e" },
    "endurance": { "label": "Endurance", "pctMin": 70, "pctMax": 80, "color": "#3b82f6" },
    "as42":      { "label": "AS42",      "pctMin": 75, "pctMax": 85, "color": "#eab308" },
    "as21":      { "label": "AS21",      "pctMin": 83, "pctMax": 90, "color": "#f97316" },
    "vma":       { "label": "VMA",       "pctMin": 95, "pctMax": 105, "color": "#ef4444" }
  }'::jsonb
);
