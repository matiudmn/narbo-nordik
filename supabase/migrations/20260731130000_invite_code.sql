-- Code d'invitation obligatoire à l'inscription (décision Matthieu du 31/07).
--
-- CONTEXTE. L'inscription self-service (Login.tsx, mode "signup") ne demandait
-- jusqu'ici que prénom/nom/email/mot de passe : n'importe qui trouvant l'URL de
-- l'app pouvait se créer un compte athlète. Décision : l'inscription exige
-- désormais un code partagé par le club, vérifié CÔTÉ BASE (pas seulement dans
-- le formulaire, qui resterait contournable par un appel direct à l'API).
--
-- MÉCANISME. Le code vit dans `club_settings.invite_code` (table déjà
-- singleton pour la config du club). L'ancien insert direct du client dans
-- `users` (policy self-service `(select auth.uid()) = id`, posée par le
-- baseline puis fusionnée par 20260730140000) est remplacé par un RPC
-- `SECURITY DEFINER`, `register_profile`, qui vérifie le code AVANT d'insérer
-- la ligne. La policy INSERT de `users` perd donc sa branche self-service : elle
-- redevient coach-only, comme avant la fusion 20260730140000.
--
-- ============================================================================
-- 1. club_settings.invite_code
-- ============================================================================
-- Colonne ajoutée sans DEFAULT permanent : le code doit être un secret
-- généré au moment du seed, jamais une valeur en dur rejouable par quiconque
-- lit ce fichier. Générateur : gen_random_uuid(), fonction du COEUR de
-- Postgres (13+), sans dépendance d'extension. La première version utilisait
-- gen_random_bytes (pgcrypto) et a échoué en prod le 2026-08-10 : sur
-- Supabase, pgcrypto vit dans le schéma `extensions` et n'est pas résolue
-- sans qualification depuis une migration (l'environnement de validation
-- PGlite l'embarquait, ce qui a masqué l'écart).
--
-- Idempotent : ADD COLUMN IF NOT EXISTS ne fait rien au 2e passage : l'UPDATE
-- ne cible que les lignes encore NULL (donc no-op si déjà seedée, un rejeu ne
-- régénère PAS le code d'un club déjà provisionné) : SET NOT NULL et SET
-- DEFAULT sont sans effet (idempotents) si déjà posés.
--
-- DEFAULT sur la colonne (même générateur que l'UPDATE de seed ci-dessous) :
-- protège l'INSERT de repli de `updateClubSettings` (DataContext), qui
-- n'envoie pas `invite_code` quand aucune ligne `club_settings` n'existe
-- encore côté client (payload sans cette colonne, la contrainte NOT NULL
-- lèverait sinon une erreur). Un rejeu de cette migration ne régénère pas non
-- plus le DEFAULT existant : `SET DEFAULT` réécrit la même expression.
ALTER TABLE public.club_settings ADD COLUMN IF NOT EXISTS invite_code text;

ALTER TABLE public.club_settings ALTER COLUMN invite_code
  SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

UPDATE public.club_settings
SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

ALTER TABLE public.club_settings ALTER COLUMN invite_code SET NOT NULL;

-- ============================================================================
-- 2. register_profile() : inscription self-service gardée par le code
-- ============================================================================
-- Comparaison insensible à la casse ET aux espaces (le code est communiqué à
-- l'oral/par SMS, une casse ou un espace de copier-coller ne doit pas bloquer
-- une inscription légitime) : on normalise les deux côtés en retirant tout
-- espace puis en passant en majuscules, avant de comparer.
--
-- Les 4 paramètres portent volontairement les mêmes noms que les colonnes de
-- `users` qu'ils alimentent (le client appelle
-- `rpc('register_profile', { invite_code, firstname, lastname, email })`).
-- Cela crée l'ambiguïté PL/pgSQL classique dès qu'une requête à l'intérieur de
-- la fonction porte sur une table qui a une colonne de même nom : réfèrencée
-- nue, l'identifiant se resoud alors au NOM DE COLONNE, pas au paramètre. On
-- qualifie donc CHAQUE référence aux paramètres par `register_profile.<nom>`
-- (qualification documentée par le manuel PostgreSQL pour ce cas précis),
-- plutôt que de ne le faire qu'où ça semblait nécessaire.
--
-- `role` n'est PAS un paramètre : la fonction fixe 'athlete' en dur, aucun
-- appelant ne peut donc se créer coach par ce chemin (une tentative d'appel
-- avec un 5e argument `role` échoue en 42883, fonction inexistante, avant même
-- d'atteindre le corps ci-dessous).
--
-- Le trigger `on_user_role_change` (enforce_user_role_change, 20260730160000)
-- se déclenche aussi sur cet INSERT : l'appelant a un auth.uid() non nul (c'est
-- lui qui vient d'exécuter register_profile) et n'est pas encore coach (il
-- n'existe pas encore dans `users`), donc caller_role est NULL et la branche
-- INSERT du trigger s'applique : elle exige déjà NEW.role = 'athlete', ce que
-- cette fonction fait. Vérifié en PGlite (cf. PR) : sans cette cohérence,
-- l'insertion échouerait en 42501 côté trigger malgré un code valide.
CREATE OR REPLACE FUNCTION public.register_profile(
  invite_code text,
  firstname text,
  lastname text,
  email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_settings cs
    WHERE upper(regexp_replace(cs.invite_code, '\s', '', 'g'))
        = upper(regexp_replace(register_profile.invite_code, '\s', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Code d''invitation invalide.' USING ERRCODE = '42501';
  END IF;

  -- Mêmes valeurs par défaut que l'ancien insert direct côté client
  -- (AuthContext.signup) : vma/group_id/phone laissés vides, vma_history à
  -- '[]', is_public à true (annuaire ouvert par défaut, cohérent avec le
  -- flux self-service existant avant ce chantier).
  INSERT INTO public.users (id, role, firstname, lastname, email, vma, vma_history, group_id, phone, is_public)
  VALUES (
    (SELECT auth.uid()),
    'athlete',
    register_profile.firstname,
    register_profile.lastname,
    register_profile.email,
    NULL,
    '[]'::jsonb,
    NULL,
    NULL,
    true
  );
END;
$$;

-- 42501 (insufficient_privilege) -> HTTP 403 côté PostgREST, message FR renvoyé
-- tel quel par supabase-js (`error.message`), même traitement que les autres
-- exceptions métier de ce trigger/de ces fonctions (cf. 20260730160000).
--
-- Anonyme exclu : `auth.uid()` doit être non-nul pour que l'INSERT réussisse
-- (la colonne `id` de `users` est NOT NULL et sans DEFAULT). Un appel `anon`
-- lèverait donc une erreur NOT NULL après avoir consommé un essai de code
-- (inutilement bruyant). Signup (`supabase.auth.signUp`) crée déjà une session
-- authentifiée avant cet appel (confirmation email désactivée sur ce projet,
-- comportement inchangé par ce chantier), donc l'appelant réel est toujours
-- `authenticated` en usage normal ; le REVOKE ci-dessous ferme le chemin direct.
REVOKE ALL ON FUNCTION public.register_profile(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text, text) TO authenticated;

-- ============================================================================
-- 3. Policy INSERT de `users` : perd sa branche self-service
-- ============================================================================
-- L'insertion de son propre profil passe désormais par register_profile
-- (SECURITY DEFINER, donc pas soumis à la RLS). La policy fusionnée par
-- 20260730140000 ("Users or coaches can insert user profiles",
-- `((select auth.uid()) = id) OR (EXISTS (... role = 'coach'))`) redevient
-- coach-only : seule la branche B (coach) est conservée, reprise MOT POUR MOT
-- depuis 20260730140000 (même forme `(select auth.uid())`, pour ne pas
-- réintroduire l'advisor auth_rls_initplan que cette migration avait corrigé).
-- Renommée pour ne plus prétendre couvrir "users" : le flux self-service
-- restant est register_profile, pas cette policy.
--
-- `addUser` (DataContext, ajout d'un athlète par un coach) continue de
-- fonctionner à l'identique : il insère via le client `supabase` authentifié
-- en tant que COACH (pas le client éphémère, qui ne sert qu'au signUp
-- Supabase Auth), donc la branche coach ci-dessous s'applique sans changement.
DROP POLICY IF EXISTS "Users or coaches can insert user profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Coaches can insert users" ON public.users;
DROP POLICY IF EXISTS "Coaches can insert user profiles" ON public.users;
CREATE POLICY "Coaches can insert user profiles" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u
             WHERE u.id = (select auth.uid()) AND u.role = 'coach')
  );

-- Hors périmètre, vérifié et volontairement non traité :
--   - La policy UPDATE de `users` ("Users or coaches can update user
--     profiles") garde sa branche self-service : un athlète modifie bien son
--     propre profil après inscription (VMA affichée, is_public, etc. via
--     DataContext.patchUser). Seul l'INSERT initial passe désormais par le
--     RPC ; ce chantier ne touche pas à l'UPDATE.
--   - `club_settings.invite_code` reste lisible par toute la policy SELECT
--     existante ("Anyone can read club settings", USING (true) pour
--     `authenticated`) : un athlète déjà inscrit peut donc lire le code en
--     clair via l'API. Accepté : c'est un secret À PARTAGER (le club le
--     communique lui-même aux nouveaux membres), pas un secret à protéger
--     d'un membre déjà dans la place.
