-- Migration: restrict notify_new_session to only athletes in the same group
-- Previously: notified all users (if no group) + coaches + group members
-- Now: only athletes in the same group, skip if no group (personal sessions)

CREATE OR REPLACE FUNCTION notify_new_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user RECORD;
BEGIN
  -- No notification for sessions without a group (personal sessions)
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR target_user IN
    SELECT id, notification_preferences
    FROM users
    WHERE id != NEW.created_by
      AND group_id = NEW.group_id
      AND role = 'athlete'
  LOOP
    IF (target_user.notification_preferences->'new_session'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        target_user.id,
        'new_session',
        'Nouvelle seance',
        NEW.title,
        '/session/' || NEW.id
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
