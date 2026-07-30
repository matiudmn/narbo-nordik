-- Statut super-admin sur public.users : colonne dédiée, plus de dérivation par email.
--
-- FAILLE (préexistante, confirmée par arbitrage). Côté client, `isSuperAdmin`
-- valait `user.email === SUPER_ADMIN_EMAIL` (AuthContext). Or `users.email` est
-- une colonne comme une autre : la policy UPDATE ne restreint aucune colonne,
-- seulement la ligne visée (cf. 20260730160000, même mécanisme). N'importe quel
-- athlète pouvait donc :
--
--   PATCH /rest/v1/users?id=eq.<son-id>   {"email":"contact@nunc.me"}
--
-- et obtenir côté client l'impersonation ainsi que la visibilité staff (Header,
-- AthletesTab, useUniversalSearch), sans jamais toucher à `auth.users.email` ni
-- s'authentifier avec ce compte. Un simple PATCH de sa propre colonne suffisait.
--
-- CORRECTIF. Le statut devient une colonne dédiée (`is_super_admin`), jamais
-- dérivée d'une valeur que son propriétaire peut réécrire. Le trigger
-- `enforce_user_role_change` (20260730160000) est étendu pour figer, hors appels
-- service (auth.uid() IS NULL, seul canal par lequel passent les promotions) :
--
--   - `is_super_admin` : jamais modifiable par un flux client, à l'INSERT comme
--     à l'UPDATE, y compris par un coach. La policy laisse déjà un coach écrire
--     n'importe quelle ligne (cf. commentaire existant sur `role`), mais la
--     promotion super-admin ne doit passer que par le dashboard ou un appel
--     service, jamais par l'espace coach de l'application.
--   - `email` en UPDATE : aucun flux client légitime ne la modifie (grep fait
--     sur DataContext.patchUser : vma, is_public, phone, license_number,
--     birth_date, photo_url, group_id, notification_preferences, jamais email).
--     L'INSERT reste libre, il porte l'email d'inscription choisi par
--     l'utilisateur. Fermer l'UPDATE retire tout intérêt à rejouer la chaîne
--     ci-dessus même si `isSuperAdmin` redevenait un jour dérivé d'une colonne
--     modifiable.
--
-- Même choix de mécanisme que 20260730160000 (trigger BEFORE, ERRCODE 42501) et
-- pour les mêmes raisons : une policy RESTRICTIVE dupliquerait le EXISTS coach
-- sur INSERT et UPDATE, un REVOKE colonne par colonne réclame un GRANT manuel à
-- chaque évolution du schéma.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Seed du compte existant : seule ligne à porter le statut aujourd'hui.
UPDATE public.users SET is_super_admin = true WHERE email = 'contact@nunc.me';

CREATE OR REPLACE FUNCTION public.enforce_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Hors session d'un utilisateur final, auth.uid() est NULL : migrations,
  -- éditeur SQL du dashboard, service_role, Edge Functions à clé service. Ces
  -- appels restent libres, et c'est par eux que passent les promotions
  -- administratives (l'application n'expose aucun écran pour cela) ainsi que la
  -- création du tout premier coach sur une base reconstruite, où personne n'est
  -- encore coach. Un appelant anonyme ne peut pas se glisser ici : `anon` n'a
  -- aucune policy sur `users`, la RLS le rejette avant le trigger.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- `is_super_admin` : figé pour tout appelant client, avant même de savoir si
  -- l'appelant est coach. La policy laisse déjà un coach écrire n'importe
  -- quelle ligne (cf. plus bas), mais la promotion super-admin ne doit passer
  -- que par le dashboard ou un appel service (branche ci-dessus), jamais par
  -- l'espace coach de l'application.
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_super_admin IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Un compte ne peut pas être créé super-admin.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    RAISE EXCEPTION 'Le statut super-admin ne peut être modifié que depuis le dashboard.'
      USING ERRCODE = '42501';
  END IF;

  -- `email` : figé à l'UPDATE pour tout appelant client, coach compris. Aucun
  -- flux de l'application ne l'écrit ; seule l'inscription (INSERT) la pose.
  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'L''email ne peut pas être modifié depuis l''application.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.role INTO caller_role
  FROM public.users u
  WHERE u.id = (SELECT auth.uid());

  -- Un coach garde la main sur les rôles : la policy le laisse déjà écrire
  -- n'importe quelle ligne, lui refuser la colonne `role` ne protégerait rien.
  IF caller_role = 'coach' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- caller_role est NULL pendant l'inscription : l'appelant crée ici sa
    -- première ligne de profil. C'est le cas nominal, il doit rester athlète.
    IF NEW.role <> 'athlete' THEN
      RAISE EXCEPTION 'Un compte ne peut être créé qu''avec le rôle athlète.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Seul un coach peut modifier le rôle d''un membre.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Signature TRIGGER inchangée : le CREATE OR REPLACE ci-dessus conserve le
-- REVOKE EXECUTE et le trigger `on_user_role_change` posés par 20260730160000,
-- aucun n'a besoin d'être rejoué.

-- Hors périmètre, vérifié et volontairement non traité :
--   - La lecture des PII de `users` reste ouverte à tout membre authentifié
--     (policy SELECT USING true, cf. 20260730140000). Ce chantier ne change que
--     l'écriture ; la visibilité large en lecture est un chantier séparé.
