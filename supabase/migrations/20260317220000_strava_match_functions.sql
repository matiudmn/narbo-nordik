-- RPC functions for matching Strava activities to sessions.
-- SECURITY DEFINER bypasses RLS; auth.uid() check ensures security.

CREATE OR REPLACE FUNCTION match_strava_activity(p_activity_id UUID, p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE strava_activities
  SET matched_session_id = p_session_id, match_status = 'manual'
  WHERE id = p_activity_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unmatch_strava_activity(p_activity_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE strava_activities
  SET matched_session_id = NULL, match_status = 'unmatched'
  WHERE id = p_activity_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
