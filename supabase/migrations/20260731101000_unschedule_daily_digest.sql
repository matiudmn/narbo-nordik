-- Retrait du cron pg_cron "daily-session-digest" : la fonction Edge
-- correspondante ne sera PAS deployee (decision Matthieu du 2026-07-31).
-- Le job (cree par 20260606120000_notifications_email_and_crons.sql, schedule
-- '0 18 * * *') appelle chaque jour /functions/v1/daily-session-digest, qui
-- n'existe pas cote deploiement -> 404 quotidien vu dans les logs (net.http_post
-- reussit toujours au sens pg_cron, l'echec HTTP est silencieux pour la base :
-- seul un bruit de log, pas de crash).
--
-- Idempotente (test d'existence avant unschedule). NON appliquee a la prod :
-- aucun apply_migration execute pendant sa redaction, attend une revue puis un
-- `supabase db push`.
--
-- Le code source de la fonction reste present dans
-- supabase/functions/daily-session-digest/ (non supprime, juste jamais
-- deploye) : si elle est deployee un jour, re-planifier avec le meme SQL que
-- 20260606120000 (bloc "Digest quotidien des seances") :
--
--   SELECT cron.schedule('daily-session-digest', '0 18 * * *', $cron$
--     SELECT net.http_post(
--       url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-session-digest',
--       headers := jsonb_build_object('Content-Type','application/json',
--         'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
--       body := '{}'::jsonb
--     );
--   $cron$);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-session-digest') THEN
    PERFORM cron.unschedule('daily-session-digest');
  END IF;
END $$;
