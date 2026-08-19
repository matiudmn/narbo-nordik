-- Migration: session_nordiks table (like/endorsement on personal sessions)

CREATE TABLE session_nordiks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_session_nordiks_session ON session_nordiks(session_id);
CREATE INDEX idx_session_nordiks_user ON session_nordiks(user_id);

ALTER TABLE session_nordiks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session nordiks readable by authenticated" ON session_nordiks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own session nordiks" ON session_nordiks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own session nordiks" ON session_nordiks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
