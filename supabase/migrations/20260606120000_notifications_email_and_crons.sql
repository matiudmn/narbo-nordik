-- ============================================================================
-- Infra notifications email + crons — PORTÉE dans la lignée CLI, SANS SECRET
-- ----------------------------------------------------------------------------
-- Régularise les anciens fichiers racine phase3 / phase6 (emails) et phase4
-- (purge des préparations), qui embarquaient l'URL du projet + la clé
-- service_role EN CLAIR. Ici on lit ces valeurs depuis des GUC (même modèle que
-- 20260317230000_strava_cron.sql, donc déjà en place en prod) :
--   app.settings.supabase_url
--   app.settings.service_role_key
--
-- Pré-requis (env) AVANT que les emails/digests fonctionnent :
--   - extensions pg_net & pg_cron (créées ci-dessous si absentes)
--   - edge functions déployées : send-notification-email, weekly-digest,
--     daily-session-digest
--   - GUC définis, ex :
--       alter database postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
--       alter database postgres set app.settings.service_role_key = '<service_role_key>';
--
-- SÛR par défaut : si les GUC ne sont pas définis, le trigger email NE FAIT RIEN
-- (pas d'erreur) — l'appli reste 100% fonctionnelle, seuls les emails sont
-- inactifs. Idempotent. NE PAS appliquer en prod sans validation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Email à l'insertion d'une notification
--    (skippe les types gérés ailleurs : weekly_digest/palmares/new_session).
--    Garde missing_ok=true sur les GUC -> aucune erreur si infra non configurée.
CREATE OR REPLACE FUNCTION notify_email_on_insert()
RETURNS trigger AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF NEW.type IN ('weekly_digest', 'palmares', 'new_session') THEN
    RETURN NEW;
  END IF;

  -- Infra email non configurée -> on ne tente rien (pas d'échec de transaction).
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

DROP TRIGGER IF EXISTS on_notification_insert_email ON notifications;
CREATE TRIGGER on_notification_insert_email
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_email_on_insert();

-- 2. Crons — idempotent : on retire l'éventuel job existant (y compris les
--    anciennes versions « à secret en dur » créées par phase3/4/6) puis on (re)crée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest-monday') THEN
    PERFORM cron.unschedule('weekly-digest-monday');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-session-digest') THEN
    PERFORM cron.unschedule('daily-session-digest');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-preparations') THEN
    PERFORM cron.unschedule('cleanup-expired-preparations');
  END IF;
END $$;

-- Digest hebdo : lundi 07:00 UTC (~08/09h Paris selon saison)
SELECT cron.schedule('weekly-digest-monday', '0 7 * * 1', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-digest',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  );
$cron$);

-- Digest quotidien des séances : 18:00 UTC (20h CEST / 19h CET)
SELECT cron.schedule('daily-session-digest', '0 18 * * *', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-session-digest',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  );
$cron$);

-- Purge des préparations expirées : tous les jours à 03:00 (SQL pur, sans secret)
SELECT cron.schedule('cleanup-expired-preparations', '0 3 * * *', $cron$
  DELETE FROM specific_preparations WHERE event_date + INTERVAL '3 days' < CURRENT_DATE;
$cron$);
