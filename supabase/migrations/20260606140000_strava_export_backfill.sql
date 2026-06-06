-- Export / rapatriement Strava AVANT retrait (capitaliser avant suppression).
-- 1) Archive complète des activités : table _archive_strava_activities, qui
--    survit au DROP de strava_activities (rien n'est perdu).
-- 2) Backfill des métriques de compte-rendu pour les activités déjà matchées à
--    une séance ET ayant déjà une validation (UPDATE seul : on n'invente aucune
--    validation, pour ne pas fausser l'assiduité ni le score de risque).
--
-- Garde-fous : on n'écrit une valeur que si elle respecte les bornes de
-- chk_metrics_bounds (migration 20260606130000), sinon NULL, pour ne pas faire
-- échouer la migration sur une donnée Strava aberrante (FC à 0 sans capteur, etc.).

CREATE TABLE IF NOT EXISTS _archive_strava_activities AS TABLE strava_activities;

UPDATE session_validations sv SET
  distance_m     = COALESCE(sv.distance_m,  CASE WHEN sa.distance_meters      BETWEEN 0  AND 500000 THEN round(sa.distance_meters)::int      END),
  duration_s     = COALESCE(sv.duration_s,  CASE WHEN sa.moving_time_seconds  BETWEEN 0  AND 200000 THEN sa.moving_time_seconds              END),
  elevation_m    = COALESCE(sv.elevation_m, CASE WHEN sa.total_elevation_gain BETWEEN 0  AND 20000  THEN round(sa.total_elevation_gain)::int END),
  avg_hr         = COALESCE(sv.avg_hr,      CASE WHEN sa.average_heartrate    BETWEEN 20 AND 260    THEN round(sa.average_heartrate)::int    END),
  max_hr         = COALESCE(sv.max_hr,      CASE WHEN sa.max_heartrate        BETWEEN 20 AND 260    THEN round(sa.max_heartrate)::int        END),
  avg_cadence    = COALESCE(sv.avg_cadence, CASE WHEN sa.average_cadence      BETWEEN 0  AND 260    THEN round(sa.average_cadence)::int      END),
  metrics_source = COALESCE(sv.metrics_source, 'watch')
FROM strava_activities sa
WHERE sa.matched_session_id = sv.session_id
  AND sa.user_id = sv.user_id
  AND sa.matched_session_id IS NOT NULL
  AND (sa.distance_meters IS NOT NULL OR sa.moving_time_seconds IS NOT NULL);
