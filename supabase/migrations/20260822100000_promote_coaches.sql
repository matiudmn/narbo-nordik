-- Promotion de cinq membres de l'encadrement au rôle coach.
--
-- Demande du coach principal (message du 22/08/2026) : donner la main sur
-- l'application (création et modification des séances, gestion des membres) à
-- cinq membres de l'encadrement, avec les mêmes droits que lui. Aucun écran de
-- l'application ne permet cette promotion (cf. 20260730160000) : le canal
-- prévu est un appel administratif hors session utilisateur, donc une
-- migration.
--
-- Les comptes sont désignés par leur id `public.users` plutôt que par nom ou
-- par email : le dépôt est public, on n'y versionne aucune donnée personnelle.
-- La correspondance id/personne a été vérifiée en base avant écriture (cinq
-- comptes existants, tous `role = 'athlete'`, aucune homonymie) et reste
-- consignée hors dépôt.
--
-- Le trigger `enforce_user_role_change` (20260730160000) laisse passer cette
-- écriture : une migration s'exécute hors session d'un utilisateur final
-- (`auth.uid()` IS NULL), branche explicitement prévue pour les promotions
-- administratives.
--
-- Sur une base locale reconstruite (`supabase db reset`), ces comptes
-- n'existent pas (les lignes de `users` naissent des inscriptions) : l'UPDATE
-- ne touche alors aucune ligne, c'est attendu et sans effet.

UPDATE public.users
SET role = 'coach'
WHERE id IN (
  'cb2e6e4f-daf8-4948-a7bd-63e0cf7839f5',
  '45437360-6c62-4697-be74-828cc78a2ddc',
  'ae4a93cf-820a-45a8-8ae1-97ee3b8c725f',
  '6d4717de-415d-4624-a121-415529bdf355',
  '8f1188d6-a478-4519-a7c1-91225adc8595'
)
AND role <> 'coach';

-- Effets assumés du modèle de rôle actuel (binaire 'athlete' | 'coach'),
-- validés avec le bureau avant application :
--   - accès aux écrans /coach/* et aux écritures couvertes par les policies
--     `role = 'coach'` : séances, groupes, prépas, palmarès, fiches athlètes ;
--   - accès aux PII de tout le club via `get_users_for_coach()`
--     (20260731120000) et aux dossiers d'adhésion `members` /
--     `membership_seasons` en lecture ET en écriture (20260817120000),
--     sections marche nordique et mineurs compris ;
--   - pouvoirs de tout coach : modifier le rôle d'un autre membre (trigger,
--     cf. 20260731081000) et supprimer des comptes ; `is_super_admin` reste
--     hors de portée d'un flux client ;
--   - ils sortent des listes d'athlètes côté coach (Dashboard, Réglages >
--     Athlètes filtrent sur `role = 'athlete'`), leur accueil bascule sur la
--     vue coach, et ils ne reçoivent plus les notifications athlètes
--     (`new_session`, digest hebdo) ; leurs validations passées restent en
--     base ; ils reçoivent les notifications coach (cf. 20260810140000) ;
--   - la préférence d'opt-out de régularité (`attendance_tracking`) est sans
--     effet pour un coach (Home.tsx court-circuite l'affichage par isCoach).
-- Un éventuel rôle mixte coach-athlète est un chantier produit séparé.
