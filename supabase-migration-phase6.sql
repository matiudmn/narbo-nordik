-- ============================================================
-- Phase 6: Refonte notifications email
-- - Supprimer les emails de palmares (garder in-app)
-- - Remplacer les emails individuels de new_session par un
--   digest quotidien a 20h (Europe/Paris)
-- - Corriger l'URL de l'appli
-- Prerequisites:
--   1. Deploy Edge Function: daily-session-digest
--   2. Redeploy send-notification-email et weekly-digest (URL corrigee)
-- ============================================================

-- 1. Modifier notify_email_on_insert pour skipper palmares et new_session
-- palmares : plus d'email, seulement in-app
-- new_session : gere par le cron quotidien daily-session-digest
CREATE OR REPLACE FUNCTION notify_email_on_insert()
RETURNS trigger AS $$
BEGIN
  -- Skip types handled elsewhere or disabled
  IF NEW.type IN ('weekly_digest', 'palmares', 'new_session') THEN
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

-- 2. pg_cron job: daily session digest at 20h Paris
-- 18h UTC = 20h CEST (ete, ~7 mois) / 19h CET (hiver, ~5 mois)
SELECT cron.schedule(
  'daily-session-digest',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jubvxfjxokeefhfmjhwl.supabase.co/functions/v1/daily-session-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YnZ4Zmp4b2tlZWZoZm1qaHdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkwNTc0MywiZXhwIjoyMDg4NDgxNzQzfQ.CFVNwW9Q4hKDJM1ww9lyiTgY10yh0CoauqgESc45wBI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
