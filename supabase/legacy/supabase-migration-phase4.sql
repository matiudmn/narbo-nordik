-- Phase 4: Preparations specifiques + colonne preparation_id sur sessions

-- Table des preparations specifiques
CREATE TABLE specific_preparations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table de liaison athletes <-> preparations
CREATE TABLE user_preparations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  preparation_id UUID REFERENCES specific_preparations(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(user_id, preparation_id)
);

-- Colonne preparation_id sur sessions
ALTER TABLE sessions ADD COLUMN preparation_id UUID REFERENCES specific_preparations(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_user_preparations_user ON user_preparations(user_id);
CREATE INDEX idx_user_preparations_preparation ON user_preparations(preparation_id);
CREATE INDEX idx_sessions_preparation ON sessions(preparation_id);

-- RLS : specific_preparations
ALTER TABLE specific_preparations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read preparations" ON specific_preparations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Coaches can insert preparations" ON specific_preparations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );
CREATE POLICY "Coaches can update preparations" ON specific_preparations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );
CREATE POLICY "Coaches can delete preparations" ON specific_preparations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

-- RLS : user_preparations
ALTER TABLE user_preparations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read user_preparations" ON user_preparations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Coaches can insert user_preparations" ON user_preparations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );
CREATE POLICY "Coaches can delete user_preparations" ON user_preparations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

-- Auto-suppression : pg_cron tous les jours a 3h du matin
-- Supprime les preparations dont event_date + 3 jours < aujourd'hui
SELECT cron.schedule('cleanup-expired-preparations', '0 3 * * *',
  $$DELETE FROM specific_preparations WHERE event_date + INTERVAL '3 days' < CURRENT_DATE$$
);
