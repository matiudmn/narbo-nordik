-- Réactions (kudos) sur un compte-rendu de séance. P1 gamification.
-- Le coach (et plus tard les athletes via un mur) peut réagir au compte-rendu
-- d'un athlète. Modèle et RLS calqués sur session_nordiks.

CREATE TABLE IF NOT EXISTS validation_reactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id UUID REFERENCES session_validations(id) ON DELETE CASCADE NOT NULL,
  author_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  emoji         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(validation_id, author_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_validation_reactions_validation ON validation_reactions(validation_id);

ALTER TABLE validation_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Validation reactions readable by authenticated" ON validation_reactions;
CREATE POLICY "Validation reactions readable by authenticated" ON validation_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own validation reactions" ON validation_reactions;
CREATE POLICY "Users can insert own validation reactions" ON validation_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own validation reactions" ON validation_reactions;
CREATE POLICY "Users can delete own validation reactions" ON validation_reactions
  FOR DELETE TO authenticated USING (auth.uid() = author_id);
