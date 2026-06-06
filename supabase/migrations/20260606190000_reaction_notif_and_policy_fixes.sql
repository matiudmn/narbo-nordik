-- Correctifs d'audit (PR réactions / coup de coeur).

-- 1. Type 'reaction' pour les notifications de kudos, EXCLU de l'email transactionnel
-- (sinon chaque emoji du coach envoie un mail à l'athlète). La CHECK inline de
-- notifications.type porte le nom auto 'notifications_type_check'.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_session', 'palmares', 'vma_update', 'weekly_digest', 'system', 'reaction'));

-- Le trigger email skippe désormais aussi 'reaction' (corps identique sinon).
CREATE OR REPLACE FUNCTION notify_email_on_insert()
RETURNS trigger AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF NEW.type IN ('weekly_digest', 'palmares', 'new_session', 'reaction') THEN
    RETURN NEW;
  END IF;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('record', jsonb_build_object(
      'id', NEW.id, 'user_id', NEW.user_id, 'type', NEW.type,
      'title', NEW.title, 'body', NEW.body, 'link', NEW.link
    ))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. WITH CHECK sur la policy UPDATE de club_settings (cohérence avec le fix
-- session_validations ; blinde un futur ajout de colonne sensible).
DROP POLICY IF EXISTS "Coaches can update club settings" ON club_settings;
CREATE POLICY "Coaches can update club settings" ON club_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'coach'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'coach'));
