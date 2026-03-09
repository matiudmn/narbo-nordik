ALTER TABLE race_results ADD COLUMN IF NOT EXISTS is_label BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Users can insert their own race results" ON race_results;
CREATE POLICY "Users or coaches can insert race results" ON race_results
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

DROP POLICY IF EXISTS "Users can update their own race results" ON race_results;
CREATE POLICY "Users or coaches can update race results" ON race_results
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
