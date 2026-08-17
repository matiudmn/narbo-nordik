-- Modèle « membres du club » : identité (members) + adhésion par saison
-- (membership_seasons), partagé entre l'app running/trail et le futur
-- formulaire d'adhésion du site Next.js.
--
-- ============================================================================
-- POURQUOI UNE TABLE À PART DE `users`
-- ============================================================================
-- `public.users` est la table des COMPTES de l'app : sa clé primaire EST
-- `auth.users(id)` (baseline), donc un profil n'existe pas sans compte auth.
-- Or le club a deux sections et un adhérent doit pouvoir exister SANS compte :
--   - la marche nordique n'est pas dans l'app (un marcheur ne s'y connectera
--     jamais) ;
--   - le formulaire d'adhésion du site enregistre un dossier AVANT, et parfois
--     SANS, création de compte ;
--   - le bureau saisit aussi des fiches papier.
-- `members` porte donc l'identité de l'adhérent, avec un lien OPTIONNEL vers
-- `auth.users` (`user_id`, nullable), noué après coup par
-- `public.link_member_to_user()` (section 5). On ne touche pas à `users`.
--
-- ============================================================================
-- POURQUOI DEUX TABLES
-- ============================================================================
-- L'identité d'un adhérent est stable, l'adhésion se renouvelle CHAQUE saison
-- et le tee-shirt n'est offert que tous les 5 ans : garder l'historique impose
-- de séparer « qui » (members, une ligne par personne, pour toujours) de
-- « quoi cette année » (membership_seasons, une ligne par personne ET par
-- saison, UNIQUE (member_id, season)). Le tee-shirt offert se lit alors dans
-- l'historique (`tshirt_included` des saisons précédentes) au lieu d'être un
-- compteur à maintenir.
--
-- ============================================================================
-- QUI ÉCRIT
-- ============================================================================
-- Le formulaire public du site Next.js écrit CÔTÉ SERVEUR avec la clé
-- `service_role` (route/action serveur), jamais depuis le navigateur : aucune
-- policy n'est donc posée pour `anon`, et `service_role` contourne la RLS
-- nativement (même modèle que `session_analyses`, entrée 36). Les coachs et le
-- super-admin peuvent insérer et mettre à jour depuis l'app (saisie d'un
-- dossier papier, validation d'une adhésion). Un athlète ne voit QUE sa propre
-- ligne, jamais celle d'un autre membre.
--
-- ============================================================================
-- SAISON 2026-2027, TARIFS DE RÉFÉRENCE (contexte, PAS de logique en base)
-- ============================================================================
-- Running/Trail 180 € (tee-shirt technique inclus, offert pour toute
-- inscription avant le 1er octobre) ; Marche Nordique 135 € (licence Santé) ou
-- 155 € (licence Compétition) ; réduction famille de 10 € par membre
-- supplémentaire. Le paiement en ligne n'existe pas encore (Stripe plus tard) :
-- `payment_status` reste 'pending' et `payment_method` enregistre le mode de
-- règlement DÉCLARÉ. Les montants sont CALCULÉS PAR L'APPELANT et stockés en
-- centimes (`amount_due_cents`) : la base n'embarque aucun barème, un tarif qui
-- change de saison ne réécrit donc pas l'historique.
--
-- Migration additive et idempotente (CREATE TABLE/INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP POLICY/TRIGGER IF EXISTS avant CREATE).
-- Aucune table existante n'est modifiée.


-- ============================================================================
-- 1. Fonction d'horodatage `updated_at`
-- ============================================================================
-- Le dépôt n'en a aucune (vérifié : `club_settings.updated_at` et l'ancienne
-- `strava_connections.updated_at` avaient un DEFAULT mais jamais de trigger de
-- mise à jour). On la crée ici, générique, pour les deux tables ci-dessous.
--
-- `SET search_path = ''` : exigence de tout le dépôt depuis l'entrée 26
-- (advisor `function_search_path_mutable`). Le corps ne référence aucune table,
-- la fonction reste donc valide avec un search_path vide.
--
-- `REVOKE EXECUTE` : motif de l'entrée 13, déjà appliqué à une fonction de
-- trigger dans ce dépôt (`notify_new_session`, entrée 39). Le déclenchement
-- d'un trigger ne vérifie pas le privilège EXECUTE de l'appelant, seule la
-- création du trigger le fait : les écritures des athlètes/coachs ne sont donc
-- pas cassées par ce REVOKE (comportement constaté en prod sur
-- `notify_new_session`).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 2. public.members : l'identité de l'adhérent
-- ============================================================================
-- NOT NULL posés sur ce qui est indispensable pour éditer une licence FFA et
-- recontacter la personne (nom, prénom, date de naissance, sexe, e-mail,
-- section). Adresse, nationalité et téléphone restent nullables : une reprise
-- de l'historique ou une fiche papier incomplète ne doit pas être rejetée par
-- la base, le formulaire web les rendra obligatoires de son côté.
--
-- Nommage `firstname` / `lastname` sans séparateur : convention de `users`
-- (baseline), reprise telle quelle pour que les deux tables se lisent pareil.
--
-- `section` est ici la section PRINCIPALE (celle qui route le dossier vers le
-- bon référent du bureau). La section réellement souscrite pour une saison
-- donnée vit sur `membership_seasons` : un adhérent peut changer de section
-- d'une saison à l'autre sans qu'on perde l'historique.
CREATE TABLE IF NOT EXISTS public.members (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lien OPTIONNEL vers le compte de l'app. NULL pour un marcheur nordique ou
  -- un dossier déposé avant création du compte. UNIQUE : un compte auth ne
  -- peut être rattaché qu'à un seul dossier d'adhérent. ON DELETE SET NULL :
  -- la suppression d'un compte app (RGPD, edge function `delete-account`) ne
  -- doit PAS effacer le dossier d'adhésion, qui a sa propre finalité
  -- (comptabilité du club, licence fédérale) et sa propre durée de vie.
  user_id             UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  firstname           TEXT NOT NULL,
  lastname            TEXT NOT NULL,
  birth_date          DATE NOT NULL,
  sex                 TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  nationality         TEXT,

  address_street      TEXT,
  address_postal_code TEXT,
  address_city        TEXT,

  email               TEXT NOT NULL,
  phone               TEXT,

  section             TEXT NOT NULL CHECK (section IN ('marche_nordique', 'running_trail')),

  family_group        TEXT,
  notes               TEXT,

  source              TEXT NOT NULL DEFAULT 'web_form'
                        CHECK (source IN ('web_form', 'paper', 'app', 'import')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L'E-MAIL SEUL N'EST VOLONTAIREMENT PAS UNIQUE (arbitrage du bureau,
-- 2026-08-17). Une famille qui adhère ensemble (réduction de 10 € par membre
-- supplémentaire) partage très souvent une seule adresse, en particulier quand
-- il y a des mineurs : bloquer ce cas à l'inscription reviendrait à refuser un
-- cas d'usage réel et récurrent du club.
--
-- L'unicité porte donc sur le TRIPLET e-mail + nom + prénom, tous les trois
-- insensibles à la casse. Ce qu'on empêche reste le vrai doublon (deux fois la
-- même personne, « Jean.Dupont@… » et « jean.dupont@… ») ; ce qu'on autorise,
-- c'est deux personnes DIFFÉRENTES sous la même adresse. Le regroupement
-- familial se lit en plus dans `family_group` (texte libre), qui reste
-- purement indicatif.
--
-- CONTRAT POUR LE FORMULAIRE WEB (à respecter côté serveur Next) : la clé de
-- recherche d'un membre existant est le TRIPLET
-- lower(email) + lower(lastname) + lower(firstname), JAMAIS l'e-mail seul. Un
-- upsert sur l'e-mail seul écraserait le dossier d'un autre membre du foyer.
--
-- Le DROP ci-dessous retire l'index de la première version de ce fichier
-- (UNIQUE sur `lower(email)` seul). Sans lui, un rejeu sur une base où cette
-- version aurait déjà tourné garderait l'ancienne contrainte et continuerait à
-- refuser les familles, en silence.
DROP INDEX IF EXISTS public.members_email_lower_key;

CREATE UNIQUE INDEX IF NOT EXISTS members_email_name_key
  ON public.members (lower(email), lower(lastname), lower(firstname));

-- Index de recherche, NON unique : rattachement par e-mail
-- (`link_member_to_user`), recherche du bureau, regroupement d'un foyer.
CREATE INDEX IF NOT EXISTS idx_members_email_lower
  ON public.members (lower(email));

DROP TRIGGER IF EXISTS set_members_updated_at ON public.members;
CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.members IS
  'Adherents du club (2 sections). Independante de public.users : un adherent existe sans compte app. Le lien vers un compte est optionnel (user_id) et se noue via public.link_member_to_user().';
COMMENT ON COLUMN public.members.user_id IS
  'Compte app rattache, NULL tant qu''il n''y en a pas (marche nordique, dossier papier, adhesion anterieure a la creation du compte).';
COMMENT ON COLUMN public.members.section IS
  'Section principale de l''adherent. La section souscrite pour une saison donnee est sur membership_seasons.section.';
COMMENT ON COLUMN public.members.family_group IS
  'Rattachement familial en texte libre (nom du foyer ou du membre principal). Sert a appliquer la reduction famille de 10 EUR par membre supplementaire ; aucune contrainte en base. Les membres d''un meme foyer peuvent partager une seule adresse e-mail : l''unicite porte sur email + nom + prenom, pas sur l''email seul.';
COMMENT ON COLUMN public.members.source IS
  'Canal de saisie du dossier : web_form (formulaire du site, ecrit par le serveur Next en service_role), paper (fiche papier saisie par le bureau), app, import (reprise de donnees).';
COMMENT ON COLUMN public.members.notes IS
  'Notes libres du bureau. Contenu potentiellement sensible : lisible uniquement par les coachs et le super-admin (aucune policy ne l''expose a l''adherent lui-meme au-dela de sa propre ligne).';


-- ============================================================================
-- 3. public.membership_seasons : l'adhésion, une ligne par saison
-- ============================================================================
-- `season` au format '2026-2027' (regex, pas d'année isolée : une saison
-- sportive est à cheval sur deux années civiles).
--
-- `activities` en text[] plutôt qu'en colonnes booléennes : la liste des
-- activités indicatives est amenée à bouger d'une saison à l'autre, et un
-- tableau se filtre sans ALTER TABLE. Contrainte d'inclusion pour garder des
-- valeurs propres malgré la souplesse du type.
--
-- Tee-shirt : le couple modèle/taille est vérifié ENSEMBLE (les tailles femme
-- Erima vont de 34 à 48 par pas de 2, les tailles homme sont S à XXL), sinon
-- une taille '38' pourrait être enregistrée sur un modèle homme.
--
-- Montants en CENTIMES et en entier : jamais de flottant sur de la monnaie.
CREATE TABLE IF NOT EXISTS public.membership_seasons (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id                 UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  season                    TEXT NOT NULL CHECK (season ~ '^[0-9]{4}-[0-9]{4}$'),
  section                   TEXT NOT NULL
                              CHECK (section IN ('marche_nordique', 'running_trail')),

  -- Licence FFA. Pertinent surtout en marche nordique (Sante 135 EUR /
  -- Competition 155 EUR) ; laisse NULL quand le club ne le distingue pas.
  license_type              TEXT CHECK (license_type IN ('sante', 'competition')),

  activities                TEXT[] NOT NULL DEFAULT '{}'
                              CHECK (activities <@ ARRAY[
                                'marche_nordique', 'trail', 'renforcement_musculaire'
                              ]::text[]),

  tshirt_model              TEXT CHECK (tshirt_model IN ('homme', 'femme')),
  tshirt_size               TEXT,
  tshirt_included           BOOLEAN NOT NULL DEFAULT false,

  membership_type           TEXT NOT NULL
                              CHECK (membership_type IN (
                                'nouveau', 'renouvellement', 'renouvellement_ffa_direct'
                              )),

  amount_due_cents          INTEGER NOT NULL CHECK (amount_due_cents >= 0),
  family_discount_cents     INTEGER NOT NULL DEFAULT 0 CHECK (family_discount_cents >= 0),

  payment_status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
  payment_method            TEXT CHECK (payment_method IN ('virement', 'cheque', 'especes', 'en_ligne')),
  paid_at                   TIMESTAMPTZ,
  stripe_payment_intent_id  TEXT,

  rules_accepted_at         TIMESTAMPTZ NOT NULL,
  gdpr_consent_at           TIMESTAMPTZ NOT NULL,
  ce_certificate_requested  BOOLEAN NOT NULL DEFAULT false,

  status                    TEXT NOT NULL DEFAULT 'submitted'
                              CHECK (status IN ('submitted', 'validated', 'rejected')),
  validated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at              TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT membership_seasons_member_season_key UNIQUE (member_id, season),

  CONSTRAINT membership_seasons_tshirt_size_check CHECK (
    tshirt_size IS NULL
    OR (tshirt_model = 'femme' AND tshirt_size IN ('34','36','38','40','42','44','46','48'))
    OR (tshirt_model = 'homme' AND tshirt_size IN ('S','M','L','XL','XXL'))
  )
);

DROP TRIGGER IF EXISTS set_membership_seasons_updated_at ON public.membership_seasons;
CREATE TRIGGER set_membership_seasons_updated_at
  BEFORE UPDATE ON public.membership_seasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.membership_seasons IS
  'Une adhesion pour une saison donnee (UNIQUE member_id + season). Separee de members parce que l''adhesion se renouvelle chaque saison et que le tee-shirt n''est offert que tous les 5 ans : l''historique se lit ici.';
COMMENT ON COLUMN public.membership_seasons.season IS
  'Saison sportive au format AAAA-AAAA, ex. 2026-2027.';
COMMENT ON COLUMN public.membership_seasons.membership_type IS
  'nouveau = premiere adhesion ; renouvellement = renouvellement complet gere par le club ; renouvellement_ffa_direct = l''adherent a deja renouvele sa licence sur le site de la FFA et ne regle ici que la cotisation club.';
COMMENT ON COLUMN public.membership_seasons.tshirt_included IS
  'true quand le tee-shirt technique est OFFERT sur cette adhesion (inscription avant le 1er octobre, ou tour des 5 ans). false = tee-shirt non fourni cette saison. Sert d''historique pour savoir quand le prochain est du.';
COMMENT ON COLUMN public.membership_seasons.tshirt_size IS
  'Taille coherente avec tshirt_model : 34 a 48 (pas de 2) pour le modele femme Erima, S/M/L/XL/XXL pour le modele homme.';
COMMENT ON COLUMN public.membership_seasons.activities IS
  'Activites indicatives declarees (marche_nordique, trail, renforcement_musculaire), multi-valuees. Declaratif : ne conditionne aucun droit.';
COMMENT ON COLUMN public.membership_seasons.amount_due_cents IS
  'Montant du en CENTIMES d''euro (180 EUR = 18000), reduction famille DEJA deduite. Calcule par l''appelant : aucun bareme n''est code en base, un changement de tarif ne reecrit donc pas l''historique.';
COMMENT ON COLUMN public.membership_seasons.family_discount_cents IS
  'Part de reduction famille appliquee, en CENTIMES (10 EUR = 1000 par membre supplementaire). Conservee a titre de trace ; elle est deja soustraite de amount_due_cents.';
COMMENT ON COLUMN public.membership_seasons.payment_status IS
  'pending par defaut : le paiement en ligne n''existe pas encore. payment_method enregistre le mode de reglement DECLARE.';
COMMENT ON COLUMN public.membership_seasons.stripe_payment_intent_id IS
  'Reserve au futur encaissement Stripe. Toujours NULL tant que le paiement en ligne n''est pas branche.';
COMMENT ON COLUMN public.membership_seasons.rules_accepted_at IS
  'Horodatage de l''acceptation du reglement interieur. Obligatoire : la preuve du consentement est la DATE, pas un booleen.';
COMMENT ON COLUMN public.membership_seasons.gdpr_consent_at IS
  'Horodatage du consentement RGPD (traitement des donnees personnelles). Obligatoire, meme raison que rules_accepted_at.';
COMMENT ON COLUMN public.membership_seasons.ce_certificate_requested IS
  'L''adherent demande une attestation de cotisation (comite d''entreprise).';
COMMENT ON COLUMN public.membership_seasons.status IS
  'Cycle de vie du dossier cote bureau : submitted (recu) -> validated / rejected. Independant de payment_status.';


-- ============================================================================
-- 4. Index
-- ============================================================================
-- Les index de `members` (UNIQUE sur le triplet e-mail + nom + prenom, et
-- index de recherche sur lower(email)) sont poses en section 2, au plus pres
-- de la decision metier qui les motive.
-- Les deux index de cle etrangere ci-dessous evitent de reintroduire l'advisor
-- `unindexed_foreign_keys` corrige par l'entree 26.
CREATE INDEX IF NOT EXISTS idx_membership_seasons_member
  ON public.membership_seasons (member_id);
CREATE INDEX IF NOT EXISTS idx_membership_seasons_validated_by
  ON public.membership_seasons (validated_by);

-- Vues de travail du bureau : la liste d'une saison par section, les impayes,
-- et la pile des dossiers a valider.
CREATE INDEX IF NOT EXISTS idx_membership_seasons_season_section
  ON public.membership_seasons (season, section);
CREATE INDEX IF NOT EXISTS idx_membership_seasons_payment_status
  ON public.membership_seasons (payment_status);
CREATE INDEX IF NOT EXISTS idx_membership_seasons_status
  ON public.membership_seasons (status);

CREATE INDEX IF NOT EXISTS idx_members_section
  ON public.members (section);


-- ============================================================================
-- 5. link_member_to_user() : rattacher un dossier au compte qui vient de naître
-- ============================================================================
-- Appelée par un utilisateur authentifié (typiquement juste après
-- `register_profile`, à la création du compte d'un traileur). Elle rattache le
-- dossier d'adhésion dont l'e-mail correspond à celui du compte auth.
--
-- `SECURITY DEFINER` : l'appelant n'a aucun droit d'UPDATE sur `members`
-- (seuls les coachs en ont, section 6) et ne peut pas lire `auth.users`.
-- La fonction ne prend AUCUN paramètre : l'appelant ne choisit ni le compte
-- (`auth.uid()`) ni l'e-mail (relu dans `auth.users`), il ne peut donc pas
-- s'approprier le dossier de quelqu'un d'autre en passant un e-mail arbitraire.
--
-- Idempotente : si un dossier est déjà rattaché à ce compte, on le renvoie
-- sans rien écrire. Sans ce court-circuit, un second appel violerait le UNIQUE
-- sur `user_id`.
--
-- RATTACHEMENT SEULEMENT SI NON AMBIGU. Depuis que l'e-mail seul n'est plus
-- unique (section 2, cas des familles), plusieurs dossiers peuvent partager
-- l'adresse du compte qui appelle. La fonction ne devine pas lequel est le bon
-- (rien, dans un compte auth, ne dit s'il appartient au parent ou à l'enfant) :
-- elle exige EXACTEMENT UN dossier non rattaché sur cet e-mail. À 0 comme à 2
-- et plus, elle ne touche à rien et renvoie NULL, et c'est au bureau de faire
-- le lien à la main (UPDATE de `members.user_id` par un coach, autorisé par la
-- policy UPDATE de la section 6).
--
-- Renvoyer NULL n'est donc PAS une erreur, et couvre trois situations que
-- l'app doit traiter pareil (« pas encore de dossier rattaché », jamais comme
-- un échec) : aucun dossier saisi, e-mail partagé par une famille, ou compte
-- sans e-mail.
--
-- Cas résiduel documenté : dans un foyer de deux membres sur la même adresse,
-- si le premier est déjà rattaché, le second compte créé trouvera un unique
-- dossier libre et s'y rattachera. C'est le comportement voulu (il ne reste
-- qu'un candidat), mais il suppose que le premier rattachement était le bon.
CREATE OR REPLACE FUNCTION public.link_member_to_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_email     text;
  v_member_id uuid;
  v_matches   integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id INTO v_member_id
  FROM public.members m
  WHERE m.user_id = v_uid;

  IF v_member_id IS NOT NULL THEN
    RETURN v_member_id;
  END IF;

  SELECT au.email INTO v_email
  FROM auth.users au
  WHERE au.id = v_uid;

  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_matches
  FROM public.members m
  WHERE m.user_id IS NULL
    AND lower(m.email) = lower(btrim(v_email));

  IF v_matches <> 1 THEN
    RETURN NULL;
  END IF;

  UPDATE public.members m
  SET user_id = v_uid
  WHERE m.user_id IS NULL
    AND lower(m.email) = lower(btrim(v_email))
  RETURNING m.id INTO v_member_id;

  RETURN v_member_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.link_member_to_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_member_to_user() TO authenticated;

COMMENT ON FUNCTION public.link_member_to_user() IS
  'Rattache au compte appelant (auth.uid()) le dossier members dont lower(email) correspond a celui du compte et dont user_id est NULL, UNIQUEMENT s''il y en a exactement un. Une famille partageant une meme adresse e-mail donne plusieurs candidats : la fonction ne tranche pas, ne modifie rien et renvoie NULL, a charge pour le bureau (coach) de faire le rattachement a la main. Renvoie aussi NULL quand aucun dossier ne correspond ; NULL n''est jamais une erreur. Idempotente. EXECUTE revoque pour anon.';


-- ============================================================================
-- 6. RLS
-- ============================================================================
-- Critère « bureau » repris MOT POUR MOT de `get_users_for_coach`
-- (20260731120000) et de `import_sessions_bulk` (20260816200000) :
--   EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid())
--           AND (role = 'coach' OR is_super_admin = true))
-- Forme `(select auth.uid())` partout : l'advisor `auth_rls_initplan` a été
-- corrigé sur tout le dépôt par l'entrée 26, on ne le réintroduit pas.
--
-- UNE SEULE policy PERMISSIVE PAR ACTION, branches en OR (motif de l'entrée
-- 27, `multiple_permissive_policies`) : deux policies SELECT distinctes
-- (« soi-même » et « bureau ») feraient réévaluer les deux expressions sur
-- chaque ligne.
--
-- Pas de policy INSERT/DELETE pour `authenticated` hors bureau, pas de policy
-- du tout pour `anon` : une fois la RLS activée, l'absence de policy vaut
-- refus total (deny-by-default). Le formulaire du site passe par le serveur
-- Next en `service_role`, qui contourne la RLS.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_seasons ENABLE ROW LEVEL SECURITY;

-- ---- members ---------------------------------------------------------------
DROP POLICY IF EXISTS "Members readable by owner or club staff" ON public.members;
CREATE POLICY "Members readable by owner or club staff" ON public.members
  FOR SELECT TO authenticated
  USING (
    members.user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );

-- Écriture réservée au bureau : un athlète ne corrige PAS lui-même son dossier
-- d'adhésion (nom, date de naissance, montant dû, consentements horodatés sont
-- des pièces administratives). Il passe par un coach, ou par son profil app
-- (`users`), qui est une autre table.
DROP POLICY IF EXISTS "Club staff insert members" ON public.members;
CREATE POLICY "Club staff insert members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff update members" ON public.members;
CREATE POLICY "Club staff update members" ON public.members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );

-- ---- membership_seasons ----------------------------------------------------
DROP POLICY IF EXISTS "Membership seasons readable by owner or club staff" ON public.membership_seasons;
CREATE POLICY "Membership seasons readable by owner or club staff" ON public.membership_seasons
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
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff insert membership seasons" ON public.membership_seasons;
CREATE POLICY "Club staff insert membership seasons" ON public.membership_seasons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Club staff update membership seasons" ON public.membership_seasons;
CREATE POLICY "Club staff update membership seasons" ON public.membership_seasons
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid())
        AND (u.role = 'coach' OR u.is_super_admin = true)
    )
  );


-- ============================================================================
-- 7. Privilèges
-- ============================================================================
-- `anon` : REVOKE explicite. La RLS suffirait (aucune policy ne le vise), mais
-- le GRANT large hérité du provisioning Supabase par défaut serait un piège si
-- une policy `anon` était ajoutée un jour par erreur depuis le dashboard.
-- Deux verrous indépendants, même raisonnement que l'entrée 34.
--
-- `authenticated` : SELECT/INSERT/UPDATE sur les deux tables, les policies
-- ci-dessus filtrent. Pas de DELETE : la suppression d'un dossier d'adhésion
-- (RGPD ou erreur de saisie) reste une opération de service_role, faite en
-- conscience, jamais un geste d'app.
--
-- Aucune séquence : les deux clés primaires sont des uuid (gen_random_uuid()).
REVOKE ALL ON TABLE public.members FROM anon;
REVOKE ALL ON TABLE public.membership_seasons FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.membership_seasons TO authenticated;


-- ============================================================================
-- 8. Notification du bureau à l'arrivée d'une adhésion
-- ============================================================================
-- Même motif que `notify_email_on_insert` (entrée 38) : trigger AFTER INSERT →
-- `net.http_post` vers une Edge Function, secrets lus dans Vault via
-- `public.get_app_secret()`. Aucun secret dans ce fichier.
--
-- SÛR PAR DÉFAUT : lecture NON stricte des secrets (`p_required` laissé à
-- false). Sur une base neuve ou une instance de développement, où Vault ne
-- contient rien, la fonction sort sans rien tenter et surtout SANS FAIRE
-- ÉCHOUER l'insertion de l'adhésion. C'est ce qu'on veut : l'adhésion d'un
-- membre ne doit jamais être perdue parce que la notification est en panne.
--
-- Les deux lectures Vault sont dans le corps et non dans le DECLARE (motif de
-- l'entrée 38) : une lecture Vault est un déchiffrement, pas un
-- `current_setting` gratuit.
--
-- PRÉ-REQUIS D'EXPLOITATION : la fonction Edge `membership-notify` doit être
-- DÉPLOYÉE avant que ce trigger ne serve en prod. `net.http_post` (pg_net) est
-- ASYNCHRONE : il met la requête en file et rend la main immédiatement, donc un
-- 404 (fonction absente) N'ÉCHOUE PAS la transaction et ne remonte NULLE PART
-- côté appelant, l'échec est SILENCIEUX, visible seulement dans
-- `net._http_response`. C'est le même piège que le job `daily-session-digest`
-- de l'entrée 33, qui a frappé un 404 quotidien sans que personne le voie.
--
-- `pg_net` : extension déjà créée par l'entrée 15 (20260606120000), on ne la
-- recrée pas ici (un `CREATE EXTENSION` rejoué pourrait la poser dans un autre
-- schéma que celui installé en prod).
CREATE OR REPLACE FUNCTION public.notify_membership_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := public.get_app_secret('supabase_url');
  v_key := public.get_app_secret('service_role_key');

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/membership-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'membership_season_id', NEW.id,
      'member_id', NEW.member_id
    )
  );

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_membership_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_membership_season_insert ON public.membership_seasons;
CREATE TRIGGER on_membership_season_insert
  AFTER INSERT ON public.membership_seasons
  FOR EACH ROW EXECUTE FUNCTION public.notify_membership_submitted();

COMMENT ON FUNCTION public.notify_membership_submitted() IS
  'Trigger AFTER INSERT sur membership_seasons : POST asynchrone (pg_net) vers la Edge Function membership-notify. Inerte si Vault ne contient pas supabase_url / service_role_key. EXECUTE revoque pour anon/authenticated/PUBLIC.';


-- ============================================================================
-- Hors périmètre, vérifié et volontairement non traité
-- ============================================================================
--   - `public.users` n'est PAS modifiée : pas de colonne `member_id` ajoutée.
--     Le lien se lit dans `members.user_id`, qui est du côté de la table neuve.
--     Toute colonne ajoutée à `users` partirait chez tous les coachs via
--     `get_users_for_coach()` qui fait `SELECT *` (même raisonnement que
--     l'entrée 37).
--   - Pas de cloisonnement colonne par colonne sur `members` (motif de
--     l'entrée 34) : le cloisonnement est ici au niveau de la LIGNE, un athlète
--     ne voit QUE la sienne, il n'y a donc pas de colonne PII à retirer d'une
--     lecture qui serait ouverte au club.
--   - Aucune reprise de données : les adhésions 2026-2027 déjà collectées sur
--     papier sont à importer séparément (source = 'paper' ou 'import').
--   - Aucun lien entre `membership_seasons.section = 'running_trail'` et
--     l'existence d'un compte app : un traileur peut adhérer sans jamais
--     installer la PWA.
