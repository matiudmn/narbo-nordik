-- =====================================================
-- Phase 2 : Notifications in-app + Preferences
-- =====================================================

-- 1. Ajouter notification_preferences sur users
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "new_session": {"in_app": true, "email": true},
  "palmares": {"in_app": true, "email": true},
  "vma_update": {"in_app": true, "email": false},
  "weekly_digest": {"email": true}
}'::jsonb;

-- 2. Table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_session', 'palmares', 'vma_update', 'weekly_digest', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- 3. RLS sur notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users mark own as read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coaches can insert notifications (for triggers running as SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 4. Trigger : nouvelle seance → notif pour les membres du groupe (ou tous si pas de groupe)
CREATE OR REPLACE FUNCTION notify_new_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user RECORD;
BEGIN
  FOR target_user IN
    SELECT id, notification_preferences
    FROM users
    WHERE id != NEW.created_by
      AND (
        NEW.group_id IS NULL
        OR group_id = NEW.group_id
        OR role = 'coach'
      )
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

DROP TRIGGER IF EXISTS on_new_session ON sessions;
CREATE TRIGGER on_new_session
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION notify_new_session();

-- 5. Trigger : nouveau palmares → notif pour tous les membres
CREATE OR REPLACE FUNCTION notify_new_palmares()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  race RECORD;
  runner RECORD;
  target_user RECORD;
BEGIN
  SELECT * INTO race FROM race_results WHERE id = NEW.race_id;
  SELECT * INTO runner FROM users WHERE id = race.user_id;

  FOR target_user IN
    SELECT id, notification_preferences
    FROM users
    WHERE id != race.user_id
  LOOP
    IF (target_user.notification_preferences->'palmares'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        target_user.id,
        'palmares',
        'Nouveau palmares',
        runner.firstname || ' ' || runner.lastname || ' - ' || race.race_name,
        '/club'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_palmares ON race_results;
CREATE TRIGGER on_new_palmares
  AFTER INSERT ON race_results
  FOR EACH ROW EXECUTE FUNCTION notify_new_palmares();

-- 6. Trigger : VMA modifiee → notif pour l'athlete concerne
CREATE OR REPLACE FUNCTION notify_vma_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.vma IS DISTINCT FROM NEW.vma AND NEW.vma IS NOT NULL THEN
    IF (NEW.notification_preferences->'vma_update'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        NEW.id,
        'vma_update',
        'VMA mise a jour',
        'Nouvelle VMA : ' || NEW.vma || ' km/h',
        '/profile'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vma_update ON users;
CREATE TRIGGER on_vma_update
  AFTER UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION notify_vma_update();
