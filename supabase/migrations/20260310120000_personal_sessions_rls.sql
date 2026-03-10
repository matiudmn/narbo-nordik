-- Allow athletes to insert their own personal sessions
DROP POLICY IF EXISTS "Athletes can insert personal sessions" ON sessions;
CREATE POLICY "Athletes can insert personal sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (is_personal = true AND created_by = auth.uid());

-- Allow athletes to update their own personal sessions
DROP POLICY IF EXISTS "Athletes can update personal sessions" ON sessions;
CREATE POLICY "Athletes can update personal sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (is_personal = true AND created_by = auth.uid());

-- Allow athletes to delete their own personal sessions
DROP POLICY IF EXISTS "Athletes can delete personal sessions" ON sessions;
CREATE POLICY "Athletes can delete personal sessions" ON sessions
  FOR DELETE TO authenticated
  USING (is_personal = true AND created_by = auth.uid());
