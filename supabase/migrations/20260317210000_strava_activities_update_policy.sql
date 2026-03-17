-- Allow athletes to update their own strava activities (for matching)
CREATE POLICY "Users can update own strava activities"
  ON strava_activities FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
