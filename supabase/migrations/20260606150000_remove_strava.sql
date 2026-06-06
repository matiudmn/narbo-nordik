-- Retrait Strava (DESTRUCTIF). À appliquer APRÈS le remplacement (saisie de
-- métriques, 20260606130000) et l'export (archive + backfill, 20260606140000).
-- L'archive _archive_strava_activities est conservée (non droppée ici).
-- Décision produit : retrait TOTAL, y compris la colonne users.strava_id.

-- 1. Désinscrire le cron quotidien (no-op s'il n'existe pas / si pg_cron absent).
DO $$ BEGIN
  PERFORM cron.unschedule('strava-daily-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Fonctions RPC de matching.
DROP FUNCTION IF EXISTS match_strava_activity(uuid, uuid);
DROP FUNCTION IF EXISTS unmatch_strava_activity(uuid);

-- 3. Policies RLS (explicite, même si DROP TABLE les emporte).
DROP POLICY IF EXISTS "Users can read own strava connection"   ON strava_connections;
DROP POLICY IF EXISTS "Coaches can see strava connections"      ON strava_connections;
DROP POLICY IF EXISTS "Users can read own strava activities"    ON strava_activities;
DROP POLICY IF EXISTS "Coaches can read all strava activities"  ON strava_activities;
DROP POLICY IF EXISTS "Users can update own strava activities"  ON strava_activities;

-- 4. Tables (la FK matched_session_id -> sessions est ON DELETE SET NULL,
--    DROP TABLE ne touche pas sessions).
DROP TABLE IF EXISTS strava_activities;
DROP TABLE IF EXISTS strava_connections;

-- 5. Colonne lien profil public (retrait total).
ALTER TABLE users DROP COLUMN IF EXISTS strava_id;
