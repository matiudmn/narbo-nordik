-- ============================================================
-- Phase 3: Email notifications via Edge Functions
-- Prerequisites:
--   1. Enable pg_net extension (done)
--   2. Enable pg_cron extension (done)
--   3. Deploy Edge Functions: send-notification-email, weekly-digest (done)
--   4. Set Resend API key as secret (done)
-- ============================================================

-- 1. Function to call send-notification-email Edge Function on notification insert
CREATE OR REPLACE FUNCTION notify_email_on_insert()
RETURNS trigger AS $$
BEGIN
  -- Skip weekly_digest type (handled by pg_cron)
  IF NEW.type = 'weekly_digest' THEN
    RETURN NEW;
  END IF;

  -- Call Edge Function via pg_net
  PERFORM net.http_post(
    url := 'https://jubvxfjxokeefhfmjhwl.supabase.co/functions/v1/send-notification-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YnZ4Zmp4b2tlZWZoZm1qaHdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkwNTc0MywiZXhwIjoyMDg4NDgxNzQzfQ.CFVNwW9Q4hKDJM1ww9lyiTgY10yh0CoauqgESc45wBI"}'::jsonb,
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'type', NEW.type,
        'title', NEW.title,
        'body', NEW.body,
        'link', NEW.link
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_insert_email ON notifications;
CREATE TRIGGER on_notification_insert_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_email_on_insert();

-- 3. pg_cron job: weekly digest every Monday at 8:00 AM (Europe/Paris)
-- pg_cron uses UTC. 8:00 Paris = 7:00 UTC (winter) or 6:00 UTC (summer)
SELECT cron.schedule(
  'weekly-digest-monday',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jubvxfjxokeefhfmjhwl.supabase.co/functions/v1/weekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YnZ4Zmp4b2tlZWZoZm1qaHdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkwNTc0MywiZXhwIjoyMDg4NDgxNzQzfQ.CFVNwW9Q4hKDJM1ww9lyiTgY10yh0CoauqgESc45wBI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
