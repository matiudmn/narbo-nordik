-- Escalade de privilège sur public.users : verrouillage de la colonne `role`.
--
-- FAILLE (préexistante, confirmée sur Postgres réel avant écriture de ce
-- fichier). Les policies d'écriture de `users` contraignent la LIGNE visée,
-- jamais les COLONNES écrites. Dans le dépôt comme en prod, l'expression est la
-- même : « (select auth.uid()) = id OR l'appelant est coach ». Un athlète passe
-- donc le premier membre pour SA PROPRE ligne, quelles que soient les colonnes
-- qu'il écrit, `role` comprise. D'où la chaîne complète, en deux requêtes
-- PostgREST et sans aucun outil particulier :
--
--   1. PATCH /rest/v1/users?id=eq.<son-id>   {"role":"coach"}   -> 1 ligne
--      La ligne est la sienne : le premier membre du OR est vrai.
--   2. il est désormais coach, donc le EXISTS(... role='coach') est vrai pour
--      TOUTE ligne.
--      PATCH /rest/v1/users?id=eq.<id-d-un-autre>                -> 1 ligne
--      Écriture libre sur le profil de n'importe quel membre du club, et accès
--      à l'espace coach de l'application.
--
-- Le même trou existe à l'INSERT : la policy d'inscription vérifie
-- `(select auth.uid()) = id` et laisse choisir `role`. Une inscription toute
-- neuve peut donc se déclarer coach directement, sans même passer par l'étape 1.
--
-- ANTÉRIORITÉ. Ce n'est pas une régression de 20260730140000 (fusion des
-- policies) ni de 20260730120000 (durcissement advisors) : la faille vient du
-- baseline 20260307000000, et les deux migrations du 30/07 ont conservé
-- l'expression à l'identique. Elle est donc exploitable en prod aujourd'hui, où
-- ces deux migrations sont appliquées (registre distant relu le 30/07).
-- C'est aussi pourquoi le correctif ci-dessous ne touche à aucune policy : il
-- ferme la faille de façon identique sur l'état pré-fusion et sur l'état
-- post-fusion, les deux ayant été rejoués sur un Postgres réel.
--
-- CHOIX DU MÉCANISME. Trois options étaient sur la table :
--   (a) policy RESTRICTIVE sur l'UPDATE. Une restrictive se combine en AND avec
--       les permissives, donc elle ferme bien la porte. Mais elle ne couvre pas
--       l'INSERT (pas de ligne OLD à comparer), il faudrait donc deux policies
--       et y redupliquer le EXISTS coach. Surtout, ce EXISTS interroge `users`
--       depuis une policy sur `users` : 20260730140000 documente déjà que cette
--       construction ne tient que parce que la policy SELECT est USING (true).
--       Ajouter une dépendance de plus à cette condition fragile est un mauvais
--       échange.
--   (b) REVOKE UPDATE (role) puis GRANT colonne par colonne. Le plus court à
--       écrire, mais PostgREST renvoie alors un refus de permission opaque, et
--       surtout toute colonne ajoutée ensuite à `users` devra recevoir son GRANT
--       à la main sous peine de casser silencieusement une écriture légitime.
--   (c) trigger BEFORE, retenu ici. Couvre INSERT et UPDATE dans un seul objet,
--       renvoie un message explicite (le `signup` de AuthContext remonte
--       `insertError.message` tel quel à l'écran), ne dépend d'aucune policy, et
--       n'impose aucune maintenance quand le schéma de `users` évoluera.
--
-- Le trigger est SECURITY DEFINER : appartenant à `postgres`, propriétaire de la
-- table et sans FORCE ROW LEVEL SECURITY sur celle-ci, sa lecture de `users`
-- n'est pas soumise à la RLS. La recherche du rôle de l'appelant ne peut donc ni
-- récurser sur les policies, ni être faussée par un futur resserrement du SELECT.

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

-- 42501 (insufficient_privilege) est traduit en HTTP 403 par PostgREST, au lieu
-- du 500 qu'aurait produit le code générique P0001 de RAISE EXCEPTION.

-- Même traitement que les autres fonctions sensibles (cf. 20260514085447) : rien
-- ne justifie de laisser anon/authenticated l'appeler directement. Cela
-- n'empêche pas le trigger de se déclencher, PostgreSQL vérifiant le droit
-- EXECUTE à la création du trigger et non à chaque ligne. Le trigger
-- on_profile_deleted, dont la fonction est révoquée depuis 20260514085447, se
-- déclenche bien pour un athlète qui supprime son compte (Profile.tsx).
REVOKE EXECUTE ON FUNCTION public.enforce_user_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_user_role_change ON public.users;
CREATE TRIGGER on_user_role_change
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_change();

-- Hors périmètre, vérifié et volontairement non traité :
--   - Déplacer sa ligne vers un autre `id` (UPDATE users SET id = ...) est déjà
--     refusé : faute de WITH CHECK explicite, la policy UPDATE réutilise son
--     USING comme WITH CHECK, et la ligne d'arrivée doit donc encore appartenir
--     à l'appelant. Testé sur Postgres réel, avant et après ce fichier.
--   - `users.email` reste modifiable par son propriétaire et ne suit pas
--     auth.users.email : une désynchronisation est possible. C'est un défaut de
--     cohérence, pas une escalade de privilège, et le corriger touche au flux de
--     changement d'email. À traiter séparément.
