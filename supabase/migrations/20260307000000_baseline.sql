-- ============================================================================
-- Narbo Nordik — Baseline schema (état pré-CLI)
-- ----------------------------------------------------------------------------
-- Migration de RÉFÉRENCE qui reconstitue l'état COMPLET de la base AVANT
-- l'introduction des migrations CLI Supabase (1er fichier daté : 20260309133009).
--
-- Elle consolide, de façon idempotente, les anciens fichiers SQL racine qui
-- étaient appliqués À LA MAIN (jamais versionnés comme migrations CLI) :
--   - supabase-schema.sql
--   - supabase-migration-phase2.sql            (notifications in-app + préférences)
--   - supabase-migration-phase4.sql            (préparations spécifiques + preparation_id)
--   - supabase-migration-phase5.sql            (pièces jointes validations + bucket storage)
--   - supabase-migration-session-nordiks.sql   (doublon de la table déjà dans le schéma)
--   - supabase-migration-restrict-notifications.sql (version finale de notify_new_session)
--
-- OBJECTIF : faire de `supabase/migrations/` l'UNIQUE source de vérité, pour que
--   `supabase db reset`  (baseline ➜ migrations CLI horodatées) reconstruise la
--   base ENTIÈRE depuis zéro, de façon déterministe. Avant ce fichier, un
--   `db reset` échouait (les migrations CLI font des ALTER sur des tables qui
--   n'existaient dans aucune migration).
--
-- NON inclus VOLONTAIREMENT — infra spécifique à l'environnement, contenant des
-- URLs/secrets propres au projet de prod (cf. supabase/MIGRATIONS.md) :
--   - phase3 / phase6 : envoi d'emails (notify_email_on_insert) + crons digests
--   - phase4          : cron de purge des préparations (cleanup-expired-preparations)
-- Ces éléments restent décrits dans les fichiers racine d'origine et doivent être
-- (re)configurés PAR environnement : URL du projet, service_role key, edge
-- functions déployées, extensions pg_net / pg_cron. Ils sont optionnels : l'appli
-- fonctionne sans eux (seuls les emails / purges automatiques sont désactivés).
--
-- VÉRIFIÉ vs PROD (06/2026) via les advisors Supabase : 15 tables, FKs, index,
-- fonctions et 46 policies recoupés. 4 dérives « dashboard » (absentes de TOUT
-- fichier) détectées et régularisées ici : policy d'inscription `users`,
-- renommage de la policy d'insert `notifications`, et `exit_feedbacks` (insert).
-- Détails + points de sécurité : supabase/MIGRATIONS.md. (Diff colonne-par-colonne
-- non récupérable — execute_sql / list_tables non autorisés en session ; recoupé
-- via src/types/index.ts + le comportement réel de l'app.)
--
-- IDEMPOTENT : sûr à ré-exécuter (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS). Sur la base de PROD EXISTANTE : NE PAS l'exécuter,
-- la marquer comme déjà appliquée afin que le CLI ne tente pas de la rejouer :
--   supabase migration repair --status applied 20260307000000
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables (ordre respectant les clés étrangères)
-- ----------------------------------------------------------------------------

-- Groupes
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Utilisateurs / profils (inclut notification_preferences — ex phase2)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('athlete', 'coach')) DEFAULT 'athlete',
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  vma REAL,
  vma_history JSONB DEFAULT '[]'::jsonb,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  phone TEXT,
  strava_id TEXT,
  birth_date DATE,
  license_number TEXT,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{
    "new_session": {"in_app": true, "email": true},
    "palmares": {"in_app": true, "email": true},
    "vma_update": {"in_app": true, "email": false},
    "weekly_digest": {"email": true}
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Préparations spécifiques (ex phase4) — placée avant sessions pour la FK
CREATE TABLE IF NOT EXISTS specific_preparations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Séances (inclut preparation_id — ex phase4)
-- NB: session_type reste à 3 valeurs ici (état pré-CLI). Les migrations CLI
--     20260310140000 puis 20260316100000 l'étendent à 6 puis 7 valeurs.
--     is_personal est ajouté par 20260310110000. Ne PAS les ajouter ici.
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'entrainement'
    CHECK (session_type IN ('entrainement', 'sortie_longue', 'recuperation')),
  terrain_options JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  location_url TEXT,
  description TEXT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  preparation_id UUID REFERENCES specific_preparations(id) ON DELETE SET NULL,
  target_distance INTEGER,
  vma_percent_min INTEGER,
  vma_percent_max INTEGER,
  blocks JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Liaison athlètes <-> préparations (ex phase4)
CREATE TABLE IF NOT EXISTS user_preparations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  preparation_id UUID REFERENCES specific_preparations(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(user_id, preparation_id)
);

-- Validations de séance (inclut attachment_* — ex phase5)
-- NB: objective_reached / sensations sont ajoutés par la migration CLI
--     20260310100000. Ne PAS les ajouter ici.
CREATE TABLE IF NOT EXISTS session_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'missed')) DEFAULT 'pending',
  feedback TEXT,
  attachment_path TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Palmarès / résultats de course
-- NB: is_label (20260309133009) et comment (20260316100000) sont ajoutés par
--     les migrations CLI. Ne PAS les ajouter ici.
CREATE TABLE IF NOT EXISTS race_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  race_name TEXT NOT NULL,
  race_type TEXT NOT NULL CHECK (race_type IN ('route', 'trail', 'piste')),
  distance_km REAL NOT NULL,
  date DATE NOT NULL,
  time_duration TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Nordiks sur palmarès (likes)
CREATE TABLE IF NOT EXISTS race_nordiks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID REFERENCES race_results(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(race_id, user_id)
);

-- Nordiks sur séances perso (likes) — était dupliqué entre schema.sql et
-- supabase-migration-session-nordiks.sql ; consolidé ici une seule fois.
CREATE TABLE IF NOT EXISTS session_nordiks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Feedbacks de sortie (anonymes, enquête suppression de compte)
CREATE TABLE IF NOT EXISTS exit_feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications in-app (ex phase2)
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

-- ----------------------------------------------------------------------------
-- 2. Index
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_group ON sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_preparation ON sessions(preparation_id);
CREATE INDEX IF NOT EXISTS idx_validations_session ON session_validations(session_id);
CREATE INDEX IF NOT EXISTS idx_validations_user ON session_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_race_results_user ON race_results(user_id);
CREATE INDEX IF NOT EXISTS idx_race_nordiks_race ON race_nordiks(race_id);
CREATE INDEX IF NOT EXISTS idx_race_nordiks_user ON race_nordiks(user_id);
CREATE INDEX IF NOT EXISTS idx_session_nordiks_session ON session_nordiks(session_id);
CREATE INDEX IF NOT EXISTS idx_session_nordiks_user ON session_nordiks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preparations_user ON user_preparations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preparations_preparation ON user_preparations(preparation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE specific_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preparations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_validations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_nordiks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_nordiks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_feedbacks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- Policies : groups
DROP POLICY IF EXISTS "Groups are readable by authenticated users" ON groups;
CREATE POLICY "Groups are readable by authenticated users" ON groups
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Coaches can insert groups" ON groups;
CREATE POLICY "Coaches can insert groups" ON groups
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can update groups" ON groups;
CREATE POLICY "Coaches can update groups" ON groups
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can delete groups" ON groups;
CREATE POLICY "Coaches can delete groups" ON groups
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : users
DROP POLICY IF EXISTS "Users can read all profiles" ON users;
CREATE POLICY "Users can read all profiles" ON users
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);
-- Inscription : un utilisateur crée sa PROPRE ligne profil (AuthContext.signup,
-- insert { id: auth.uid(), ... }). Présent en prod mais ABSENT de l'ancien
-- supabase-schema.sql (ajouté via dashboard) — sans cette policy, l'inscription
-- échoue sur une base reconstruite. Dérive régularisée.
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Coaches can update any user" ON users;
CREATE POLICY "Coaches can update any user" ON users
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can insert users" ON users;
CREATE POLICY "Coaches can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can delete users" ON users;
CREATE POLICY "Coaches can delete users" ON users
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : specific_preparations
DROP POLICY IF EXISTS "Authenticated users can read preparations" ON specific_preparations;
CREATE POLICY "Authenticated users can read preparations" ON specific_preparations
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Coaches can insert preparations" ON specific_preparations;
CREATE POLICY "Coaches can insert preparations" ON specific_preparations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can update preparations" ON specific_preparations;
CREATE POLICY "Coaches can update preparations" ON specific_preparations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can delete preparations" ON specific_preparations;
CREATE POLICY "Coaches can delete preparations" ON specific_preparations
  FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : sessions (RLS coach. Les policies "perso athlète" arrivent en
--   migration CLE 20260310120000 — elles s'appuient sur is_personal.)
DROP POLICY IF EXISTS "Sessions are readable by authenticated users" ON sessions;
CREATE POLICY "Sessions are readable by authenticated users" ON sessions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Coaches can insert sessions" ON sessions;
CREATE POLICY "Coaches can insert sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can update sessions" ON sessions;
CREATE POLICY "Coaches can update sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can delete sessions" ON sessions;
CREATE POLICY "Coaches can delete sessions" ON sessions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : user_preparations
DROP POLICY IF EXISTS "Authenticated users can read user_preparations" ON user_preparations;
CREATE POLICY "Authenticated users can read user_preparations" ON user_preparations
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Coaches can insert user_preparations" ON user_preparations;
CREATE POLICY "Coaches can insert user_preparations" ON user_preparations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
DROP POLICY IF EXISTS "Coaches can delete user_preparations" ON user_preparations;
CREATE POLICY "Coaches can delete user_preparations" ON user_preparations
  FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : session_validations
DROP POLICY IF EXISTS "Validations are readable by authenticated users" ON session_validations;
CREATE POLICY "Validations are readable by authenticated users" ON session_validations
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own validations" ON session_validations;
CREATE POLICY "Users can insert their own validations" ON session_validations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own validations" ON session_validations;
CREATE POLICY "Users can update their own validations" ON session_validations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own validations" ON session_validations;
CREATE POLICY "Users can delete their own validations" ON session_validations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies : race_results (versions PRÉ-CLI. La migration 20260309133009
--   remplace les policies insert/update par des versions incluant les coachs.)
DROP POLICY IF EXISTS "Race results are readable by authenticated users" ON race_results;
CREATE POLICY "Race results are readable by authenticated users" ON race_results
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own race results" ON race_results;
CREATE POLICY "Users can insert their own race results" ON race_results
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own race results" ON race_results;
CREATE POLICY "Users can update their own race results" ON race_results
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own race results" ON race_results;
CREATE POLICY "Users can delete their own race results" ON race_results
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies : race_nordiks
DROP POLICY IF EXISTS "Race nordiks are readable by authenticated users" ON race_nordiks;
CREATE POLICY "Race nordiks are readable by authenticated users" ON race_nordiks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own nordiks" ON race_nordiks;
CREATE POLICY "Users can insert their own nordiks" ON race_nordiks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own nordiks" ON race_nordiks;
CREATE POLICY "Users can delete their own nordiks" ON race_nordiks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies : session_nordiks
DROP POLICY IF EXISTS "Session nordiks readable by authenticated" ON session_nordiks;
CREATE POLICY "Session nordiks readable by authenticated" ON session_nordiks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own session nordiks" ON session_nordiks;
CREATE POLICY "Users can insert own session nordiks" ON session_nordiks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own session nordiks" ON session_nordiks;
CREATE POLICY "Users can delete own session nordiks" ON session_nordiks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies : exit_feedbacks (enquête ANONYME de suppression de compte).
-- Dérive prod (constatée via advisors) :
--  * INSERT renommée "Users can insert their own feedback" — reflétée ici (effet
--    identique : l'app insère {reason, comment} SANS user_id ⇒ WITH CHECK (true)).
--  * SELECT renommée "Users can read their own feedback" — définition live NON
--    récupérable (execute_sql non autorisé). La table étant anonyme (pas de
--    user_id) et les motifs de départ sensibles, on CONSERVE une lecture
--    restreinte aux coachs (choix sûr). À VÉRIFIER en prod : si la définition
--    live est permissive, ces retours sont sur-exposés (cf. MIGRATIONS.md § sécu).
DROP POLICY IF EXISTS "Authenticated users can insert exit feedbacks" ON exit_feedbacks;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON exit_feedbacks;
CREATE POLICY "Users can insert their own feedback" ON exit_feedbacks
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Coaches can read exit feedbacks" ON exit_feedbacks;
CREATE POLICY "Coaches can read exit feedbacks" ON exit_feedbacks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));

-- Policies : notifications (ex phase2)
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users mark own as read" ON notifications;
CREATE POLICY "Users mark own as read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Dérive prod : renommée "System can insert notifications" -> "Authenticated can
-- insert notifications" (même effet). WITH CHECK (true) est VOULU : le client
-- insère des notifs pour d'AUTRES users (ex. nordik -> notif au propriétaire de
-- la séance, DataContext addSessionNordik). Signalé « permissif » par le linter
-- (rls_policy_always_true) — laissé tel quel par design ; cf. MIGRATIONS.md § sécu.
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
CREATE POLICY "Authenticated can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. Fonctions & triggers DB (logique applicative, sans secret)
-- ----------------------------------------------------------------------------

-- Suppression du compte auth quand le profil est supprimé
CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS on_profile_deleted ON public.users;
CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION delete_auth_user();

-- Nouvelle séance -> notif in-app (version FINALE de restrict-notifications :
-- uniquement les athlètes du même groupe ; rien pour les séances sans groupe).
CREATE OR REPLACE FUNCTION notify_new_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user RECORD;
BEGIN
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
      VALUES (target_user.id, 'new_session', 'Nouvelle seance', NEW.title, '/session/' || NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_new_session ON sessions;
CREATE TRIGGER on_new_session
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION notify_new_session();

-- Nouveau palmarès -> notif in-app pour tous les autres membres
CREATE OR REPLACE FUNCTION notify_new_palmares()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  runner RECORD;
  target_user RECORD;
BEGIN
  SELECT * INTO runner FROM users WHERE id = NEW.user_id;

  FOR target_user IN
    SELECT id, notification_preferences FROM users WHERE id != NEW.user_id
  LOOP
    IF (target_user.notification_preferences->'palmares'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        target_user.id, 'palmares', 'Nouveau palmares',
        runner.firstname || ' ' || runner.lastname || ' - ' || NEW.race_name, '/club'
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

-- VMA modifiée -> notif in-app pour l'athlète concerné
CREATE OR REPLACE FUNCTION notify_vma_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.vma IS DISTINCT FROM NEW.vma AND NEW.vma IS NOT NULL THEN
    IF (NEW.notification_preferences->'vma_update'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'vma_update', 'VMA mise a jour', 'Nouvelle VMA : ' || NEW.vma || ' km/h', '/profile');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_vma_update ON users;
CREATE TRIGGER on_vma_update
  AFTER UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION notify_vma_update();

-- ----------------------------------------------------------------------------
-- 5. Storage : bucket des pièces jointes de validation (ex phase5)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-attachments', 'session-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own attachments" ON storage.objects;
CREATE POLICY "Users can upload their own attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'session-attachments');

DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;
CREATE POLICY "Users can update their own attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Fin du baseline. La suite de l'historique est portée par les migrations CLI
-- horodatées de supabase/migrations/ (20260309133009 et suivantes).
-- ============================================================================
