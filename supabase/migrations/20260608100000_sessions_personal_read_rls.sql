-- ============================================================================
-- Narbo Nordik — Durcissement RLS : lecture des séances perso (palier 1)
-- ----------------------------------------------------------------------------
-- CONTEXTE (audit sécurité 06/2026)
--   La policy SELECT de `sessions` était ouverte : USING (true). Combinée au
--   chargement global côté client (DataContext.fetchAll), n'importe quel membre
--   authentifié pouvait lire, via un appel PostgREST direct avec son JWT, les
--   séances PERSONNELLES des autres athlètes (titre, description, blocs), alors
--   que l'app les masque déjà partout (lib/athleteSessions.filterSessionsForAthlete
--   ne renvoie une séance perso qu'à son créateur).
--
-- CE QUE FAIT CETTE MIGRATION
--   Remplace la policy SELECT de `sessions` pour que la lecture des séances
--   marquées is_personal = true soit limitée à leur créateur (created_by) et
--   aux coachs. Le programme du club (is_personal = false : séances de groupe,
--   globales, de préparation) reste lisible par tous les authentifiés, comme
--   aujourd'hui : aucune vue découvrable de l'app n'est impactée.
--
-- HORS PÉRIMÈTRE (décisions produit validées 08/06/2026, transparence club)
--   - race_results : reste public au club (Palmarès du club, ClubProfile, fiches).
--   - session_validations : reste lisible au club (assiduité affichée partout +
--     "Coup de coeur"). La confidentialité du CONTENU (feedback, ressenti,
--     métriques) n'est PAS traitée ici (nécessiterait un split de colonnes).
--   - users : protection des colonnes sensibles (email, licence, prefs notif)
--     non traitée ici (niveau colonne : vue/table dédiée + helper is_coach()).
--
-- NON DESTRUCTIF / IDEMPOTENT
--   Ne modifie aucune donnée. Remplace une seule policy (DROP IF EXISTS + CREATE).
--   Les policies INSERT/UPDATE/DELETE de `sessions` (dont celles des séances
--   perso, migration 20260310120000) sont inchangées.
--
-- COMPATIBILITÉ COACH / SUPER ADMIN
--   Le check coach réutilise le motif inline déjà employé partout dans le projet
--   (EXISTS ... role = 'coach'). Le super admin (contact@nunc.me) accède aux
--   routes /coach/* qui sont gardées sur user.role === 'coach' : son rôle en base
--   est donc 'coach', il conserve la lecture complète. (À confirmer en prod.)
-- ============================================================================

DROP POLICY IF EXISTS "Sessions are readable by authenticated users" ON sessions;
CREATE POLICY "Sessions are readable by authenticated users" ON sessions
  FOR SELECT TO authenticated
  USING (
    coalesce(is_personal, false) = false
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );
