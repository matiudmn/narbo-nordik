-- Strava OAuth connections (1:1 with users)
CREATE TABLE strava_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  strava_athlete_id BIGINT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope_granted TEXT NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Strava activities cache
CREATE TABLE strava_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  strava_activity_id BIGINT NOT NULL UNIQUE,
  sport_type TEXT NOT NULL,
  name TEXT,
  distance_meters REAL,
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  average_speed REAL,
  max_speed REAL,
  average_heartrate REAL,
  max_heartrate REAL,
  average_cadence REAL,
  total_elevation_gain REAL,
  suffer_score INTEGER,
  calories INTEGER,
  device_name TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  start_date_local TIMESTAMPTZ NOT NULL,
  matched_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('auto_matched', 'manual', 'unmatched')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_strava_connections_user ON strava_connections(user_id);
CREATE INDEX idx_strava_connections_athlete ON strava_connections(strava_athlete_id);
CREATE INDEX idx_strava_activities_user ON strava_activities(user_id);
CREATE INDEX idx_strava_activities_strava_id ON strava_activities(strava_activity_id);
CREATE INDEX idx_strava_activities_date ON strava_activities(start_date_local);
CREATE INDEX idx_strava_activities_session ON strava_activities(matched_session_id);

-- RLS
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

-- strava_connections: users can read own connection status
CREATE POLICY "Users can read own strava connection"
  ON strava_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Coaches can see all connection statuses
CREATE POLICY "Coaches can see strava connections"
  ON strava_connections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- strava_activities: users can read own
CREATE POLICY "Users can read own strava activities"
  ON strava_activities FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Coaches can read all activities
CREATE POLICY "Coaches can read all strava activities"
  ON strava_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
