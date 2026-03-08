-- Narbo Nordik Club - Supabase Schema
-- Run this in the Supabase SQL Editor to create the database

-- Groups table
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users / profiles table
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('athlete', 'coach')) DEFAULT 'athlete',
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  vma REAL,
  vma_history JSONB DEFAULT '[]'::jsonb,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  phone TEXT,
  strava_id TEXT,
  birth_date DATE,
  license_number TEXT,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'entrainement' CHECK (session_type IN ('entrainement', 'sortie_longue', 'recuperation')),
  terrain_options JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  location_url TEXT,
  description TEXT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  target_distance INTEGER,
  vma_percent_min INTEGER,
  vma_percent_max INTEGER,
  blocks JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session validations
CREATE TABLE session_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'missed')) DEFAULT 'pending',
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Race results
CREATE TABLE race_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  race_name TEXT NOT NULL,
  race_type TEXT NOT NULL CHECK (race_type IN ('route', 'trail', 'piste')),
  distance_km REAL NOT NULL,
  date DATE NOT NULL,
  time_duration TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Race nordiks (likes/endorsements)
CREATE TABLE race_nordiks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID REFERENCES race_results(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(race_id, user_id)
);

-- Exit feedbacks (anonymous, for account deletion survey)
CREATE TABLE exit_feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_group ON sessions(group_id);
CREATE INDEX idx_validations_session ON session_validations(session_id);
CREATE INDEX idx_validations_user ON session_validations(user_id);
CREATE INDEX idx_race_results_user ON race_results(user_id);
CREATE INDEX idx_race_nordiks_race ON race_nordiks(race_id);
CREATE INDEX idx_race_nordiks_user ON race_nordiks(user_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_nordiks ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_feedbacks ENABLE ROW LEVEL SECURITY;

-- Policies: Groups
CREATE POLICY "Groups are readable by authenticated users" ON groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coaches can insert groups" ON groups
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can update groups" ON groups
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can delete groups" ON groups
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies: Users
CREATE POLICY "Users can read all profiles" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Coaches can update any user" ON users
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can delete users" ON users
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies: Sessions
CREATE POLICY "Sessions are readable by authenticated users" ON sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coaches can insert sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can update sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

CREATE POLICY "Coaches can delete sessions" ON sessions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies: Validations
CREATE POLICY "Validations are readable by authenticated users" ON session_validations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own validations" ON session_validations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own validations" ON session_validations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own validations" ON session_validations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies: Race results
CREATE POLICY "Race results are readable by authenticated users" ON race_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own race results" ON race_results
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own race results" ON race_results
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own race results" ON race_results
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies: Race nordiks
CREATE POLICY "Race nordiks are readable by authenticated users" ON race_nordiks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own nordiks" ON race_nordiks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own nordiks" ON race_nordiks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies: Exit feedbacks (anonymous insert only)
CREATE POLICY "Authenticated users can insert exit feedbacks" ON exit_feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches can read exit feedbacks" ON exit_feedbacks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Trigger: delete auth user when profile is deleted
CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION delete_auth_user();
