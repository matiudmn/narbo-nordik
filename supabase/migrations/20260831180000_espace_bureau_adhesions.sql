-- Espace bureau des adhésions : statut « conseil d'administration »
-- (users.is_board), dossiers d'adhésion resserrés du staff sportif au bureau,
-- verrou « pas de validation sans règlement » et trace du montant encaissé.
--
-- CONTEXTE (demande de Matthieu du 2026-08-31, après l'échange avec le bureau
-- du même jour). Les 41 dossiers 2026-2027 sont en base (entrée 40) mais tout
-- le pilotage se fait encore dans un tableur hors app : pointage des règlements
-- contre le relevé bancaire, validation des dossiers, corrections de montants,
-- de licences et de tailles. L'app gagne un espace bureau (/bureau) réservé aux
-- quatre membres du conseil d'administration ; cette migration en pose le socle.
--
-- Migration additive et idempotente (ADD COLUMN IF NOT EXISTS, CREATE OR
-- REPLACE FUNCTION, DROP POLICY/TRIGGER IF EXISTS avant CREATE, seed gardé).


-- ============================================================================
-- 1. users.is_board : appartenance au conseil d'administration
-- ============================================================================
-- Booléen orthogonal à `role`, comme `is_super_admin` (entrée 31), et non un
-- troisième rôle : le CHECK role IN ('athlete','coach') structure l'app entière
-- (App.tsx, une vingtaine de policies), et un membre du CA reste par ailleurs
-- athlète (deux des quatre) ou coach (les deux autres). Un flag dédié cumule
-- les deux qualités sans rien casser.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_board boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_board IS
  'Membre du conseil d''administration : ouvre l''espace bureau (/bureau) et les policies members/membership_seasons. Orthogonal a role, comme is_super_admin. Promotion par canal service uniquement (cf. enforce_user_role_change).';

-- Le rôle authenticated lit cette colonne depuis les policies de la section 3
-- et depuis l'app : même exigence que pour `role` et `is_super_admin`, dont
-- l'entrée 34 documente qu'ils doivent rester GRANTés sous peine de casser les
-- EXISTS des policies. Non-PII : la composition du CA est publique au club
-- (élue en AG). GRANT colonne ADDITIF : il s'ajoute à la liste posée par
-- l'entrée 34 sans la rejouer.
GRANT SELECT (is_board) ON public.users TO authenticated;

-- Seed des quatre membres du conseil d'administration, désignés PAR ID
-- UNIQUEMENT (dépôt public : aucun nom ni e-mail ici ; correspondance
-- id/personne vérifiée en base le 2026-08-31, consignée hors dépôt). Garde
-- d'idempotence, et 0 ligne sur base neuve (`db reset`, les lignes `users`
-- naissent des inscriptions) : attendu, même motif que l'entrée 43.
UPDATE public.users SET is_board = true
WHERE id IN (
  '74b359dd-6310-4e97-9902-b1e81d3c155e',
  '19a77be0-0016-41ef-a064-6e2802c6f9f4',
  'cb2e6e4f-daf8-4948-a7bd-63e0cf7839f5',
  '01b386ae-e6e5-4430-955c-8a167d3434cb'
) AND is_board = false;


-- ============================================================================
-- 2. is_board figé côté client (extension du garde anti-escalade)
-- ============================================================================
-- Sans ce bloc, la policy UPDATE de `users` laisserait un athlète écrire SA
-- ligne, colonnes comprises, et s'auto-promouvoir au CA : exactement la faille
-- `role` / `is_super_admin` des entrées 29 et 31. Corps repris VERBATIM de
-- l'entrée 31, plus le bloc is_board calqué sur is_super_admin : jamais
-- modifiable par un flux client, à l'INSERT comme à l'UPDATE, coach compris.
-- Les promotions passent par la branche administrative (auth.uid() IS NULL).
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

  -- `is_board` : même verrou que `is_super_admin`, mêmes raisons. La
  -- composition du conseil d'administration ne se modifie que par canal
  -- service (branche auth.uid() IS NULL ci-dessus), jamais depuis un flux
  -- client, coach compris.
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_board IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Un compte ne peut pas être créé membre du conseil d''administration.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_board IS DISTINCT FROM OLD.is_board THEN
    RAISE EXCEPTION 'Le statut conseil d''administration ne peut être modifié que depuis le dashboard.'
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

-- Signature inchangée : le CREATE OR REPLACE conserve le REVOKE EXECUTE et le
-- trigger `on_user_role_change` posés par l'entrée 29, aucun n'a besoin d'être
-- rejoué.


-- ============================================================================
-- 3. Dossiers d'adhésion : du staff sportif au conseil d'administration
-- ============================================================================
-- Décision de Matthieu du 2026-08-31 : l'accès aux dossiers d'adhésion (PII de
-- tout le club, mineurs compris, plus les notes du bureau) passe du critère
-- « coach OU super-admin » (entrée 40) au critère « CA OU super-admin ». Les
-- coachs non membres du CA PERDENT lecture et écriture : c'est le point RGPD
-- assumé de l'entrée 43 qui se referme. Aucun impact applicatif : aucun écran
-- de l'app ne lisait ces tables avant l'espace bureau livré avec cette
-- migration. Le formulaire du site écrit en service_role, au-dessus de la
-- RLS : inchangé. Un athlète garde la lecture de sa propre ligne et de ses
-- propres adhésions.
--
-- Les policies changent de NOM (« club staff » mentirait désormais) : les
-- anciens noms de l'entrée 40 sont droppés explicitement, puis les nouveaux
-- posés. Toujours UNE policy permissive par action, forme `(select auth.uid())`
-- partout (pas de régression des advisors `auth_rls_initplan` et
-- `multiple_permissive_policies`, entrées 26 et 27).

-- ---- members ---------------------------------------------------------------
DROP POLICY IF EXISTS "Members readable by owner or club staff" ON public.members;
DROP POLICY IF EXISTS "Members readable by owner or board" ON public.members;
CREATE POLICY "Members readable by owner or board" ON public.members
  FOR SELECT TO authenticated
  USING (
    members.user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff insert members" ON public.members;
DROP POLICY IF EXISTS "Board insert members" ON public.members;
CREATE POLICY "Board insert members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff update members" ON public.members;
DROP POLICY IF EXISTS "Board update members" ON public.members;
CREATE POLICY "Board update members" ON public.members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );

-- ---- membership_seasons ----------------------------------------------------
DROP POLICY IF EXISTS "Membership seasons readable by owner or club staff" ON public.membership_seasons;
DROP POLICY IF EXISTS "Membership seasons readable by owner or board" ON public.membership_seasons;
CREATE POLICY "Membership seasons readable by owner or board" ON public.membership_seasons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = membership_seasons.member_id
        AND m.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff insert membership seasons" ON public.membership_seasons;
DROP POLICY IF EXISTS "Board insert membership seasons" ON public.membership_seasons;
CREATE POLICY "Board insert membership seasons" ON public.membership_seasons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff update membership seasons" ON public.membership_seasons;
DROP POLICY IF EXISTS "Board update membership seasons" ON public.membership_seasons;
CREATE POLICY "Board update membership seasons" ON public.membership_seasons
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.is_board = true OR u.is_super_admin = true)
    )
  );


-- ============================================================================
-- 4. membership_seasons.amount_paid_cents : trace de l'encaissé
-- ============================================================================
-- `payment_status = 'partial'` ne disait pas COMBIEN est arrivé, alors que le
-- bureau pointe les règlements contre le relevé bancaire et doit lire le reste
-- dû. Montant CUMULÉ constaté, en CENTIMES (même règle que amount_due_cents :
-- jamais de flottant sur de la monnaie). Il peut légitimement DÉPASSER
-- amount_due_cents (trop-perçu réel : un adhérent règle un supplément de
-- licence avant que le bureau corrige le montant dû) : aucune contrainte
-- croisée, le réel du club prime et l'écart se lit à l'écran.
ALTER TABLE public.membership_seasons
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0
    CHECK (amount_paid_cents >= 0);

COMMENT ON COLUMN public.membership_seasons.amount_paid_cents IS
  'Montant encaisse cumule constate par le bureau, en CENTIMES. 0 = rien recu. Peut depasser amount_due_cents (trop-percu reel). payment_status reste la source du workflow ; cette colonne est la trace comptable.';


-- ============================================================================
-- 5. Verrou : pas de validation sans règlement
-- ============================================================================
-- Règle du club (2026-08-28, déjà encodée dans l'e-mail bureau de
-- membership-notify) : un dossier ne se valide qu'une fois un règlement reçu,
-- MÊME PARTIEL. Le verrou est en base et pas seulement à l'écran : il vaut pour
-- tous les canaux (app, dashboard, service_role : un trigger se déclenche même
-- pour un rôle qui contourne la RLS). Conséquence assumée : un dossier validé
-- ne peut pas repasser en règlement 'pending'/'cancelled' sans être d'abord
-- repassé en 'submitted' (l'invariant tient en continu, pas seulement au
-- moment de la transition). Le formulaire du site insère toujours
-- status = 'submitted' : jamais concerné.
--
-- ERRCODE 23514 (check_violation) : PostgREST le traduit en 400 au lieu du 500
-- qu'aurait produit le P0001 générique (même motif que le 42501 de l'entrée 29).
-- Le message est montré tel quel par l'espace bureau : il est rédigé pour
-- l'écran.
CREATE OR REPLACE FUNCTION public.enforce_membership_validation_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.status = 'validated' AND NEW.payment_status NOT IN ('paid', 'partial') THEN
    RAISE EXCEPTION 'Un dossier ne peut pas être validé sans règlement (au moins partiel).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

-- Même traitement que les autres fonctions de trigger (motif de l'entrée 13) :
-- le déclenchement ne vérifie pas le privilège EXECUTE de l'appelant, seule la
-- création du trigger le fait.
REVOKE EXECUTE ON FUNCTION public.enforce_membership_validation_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_validation_payment ON public.membership_seasons;
CREATE TRIGGER enforce_validation_payment
  BEFORE INSERT OR UPDATE ON public.membership_seasons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_validation_payment();

COMMENT ON FUNCTION public.enforce_membership_validation_payment() IS
  'Regle du club (2026-08-28) : status ne peut valoir ''validated'' que si payment_status est ''paid'' ou ''partial''. S''applique a tous les canaux, service_role compris. ERRCODE 23514 -> 400 PostgREST.';


-- ============================================================================
-- Hors périmètre, vérifié et volontairement non traité
-- ============================================================================
--   - `get_users_for_coach()` et les policies d'entraînement inchangées : les
--     coachs gardent les PII des COMPTES de l'app (nécessaires au coaching) ;
--     seuls les DOSSIERS d'adhésion changent de mains.
--   - Pas de policy DELETE (entrée 40, service_role uniquement) : le doublon
--     connu de la saison 2026-2027 se traite en 'rejected', pas en suppression.
--   - Pas de colonne « qui a pointé le règlement » : validated_by trace la
--     décision de validation ; à quatre utilisateurs, updated_at suffit
--     aujourd'hui pour le pointage. À revoir si le bureau s'élargit.
--   - Aucun barème en base, comme à l'entrée 40 : le montant dû reste calculé
--     par l'appelant, l'espace bureau l'édite librement.
