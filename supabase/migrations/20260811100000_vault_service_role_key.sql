-- ============================================================================
-- Clé service_role : sortie du clair, centralisation dans Supabase Vault
-- ----------------------------------------------------------------------------
-- CONTEXTE (état constaté en prod le 2026-08-11, projet jubvxfjxokeefhfmjhwl).
-- Le job cron `weekly-digest-monday` (jobid 1, `0 7 * * 1`) appelle la fonction
-- Edge `weekly-digest` avec la clé `service_role` ÉCRITE EN DUR dans son
-- en-tête Authorization. Constaté en base :
--   - `command like '%eyJ%'`            -> true  (JWT en clair)
--   - `command like '%current_setting%'` -> false (jamais passé au modèle GUC)
-- Le job est en place depuis le 2026-03-09 et il FONCTIONNE : `cron.job_run_details`
-- montre un `succeeded` chaque lundi, dont les 06, 13, 20, 27 juillet puis les
-- 03 et 10 août 2026. Il ne doit surtout pas être cassé.
--
-- Or `cron.job.command` est une colonne de table ordinaire : elle part dans les
-- sauvegardes, dans les exports de schéma, et se lit dans le SQL Editor du
-- dashboard. Une clé `service_role` contourne toute RLS (`rolbypassrls`), donc
-- sa lecture équivaut à un accès total à la base.
--
-- PIÈGE DE LECTURE, à retenir pour les prochains chantiers. La migration
-- 20260606120000 contient bien un bloc `unschedule` + `schedule` qui refait ce
-- job SANS secret (modèle GUC), et elle est marquée « appliquée ». Son bloc cron
-- n'a pourtant JAMAIS pris effet en prod : le job vivant porte toujours le
-- jobid 1, c'est-à-dire le job d'origine, antérieur au fichier (le motif
-- correspond à une adoption par `migration repair --status applied`, exactement
-- comme le baseline, cf. supabase/MIGRATIONS.md). Conclusion générale : le
-- contenu d'un fichier de migration marqué appliqué ne prouve pas l'état de la
-- production. Toujours vérifier en base.
--
-- ----------------------------------------------------------------------------
-- POURQUOI VAULT ET PAS `ALTER DATABASE ... SET app.settings.service_role_key`
-- ----------------------------------------------------------------------------
-- Le modèle GUC était la piste prévue par 20260606120000. Il est écarté, et la
-- présente migration le remplace pour les deux consommateurs. Trois raisons,
-- vérifiées sur cette base :
--
--   1. Un GUC personnalisé est de contexte USERSET : n'importe quel rôle
--      connecté peut le lire avec `current_setting('app.settings.service_role_key')`,
--      `anon` compris. Il suffit d'un seul `SECURITY DEFINER` bavard, ou d'une
--      fonction SQL exposée par PostgREST qui renvoie un `current_setting`, pour
--      exfiltrer la clé. Vault, lui, est doublement fermé côté client : ni
--      USAGE sur le schéma `vault`, ni SELECT sur `vault.decrypted_secrets`
--      pour `anon` et `authenticated` (constaté, cf. section 4).
--   2. `ALTER DATABASE ... SET` est un ordre DDL : la clé se retrouve en clair
--      dans les journaux de commandes et dans les sauvegardes logiques, et elle
--      s'affiche telle quelle dans `pg_db_role_setting`. On déplacerait le
--      secret d'une colonne lisible vers une autre.
--   3. Un GUC de base de données n'est lu qu'à l'ouverture de session. Le pool
--      PostgREST garde ses connexions ouvertes, donc poser le GUC ne suffit pas :
--      il faut attendre le recyclage du pool pour que le trigger voie la valeur.
--      Vault est relu à CHAQUE appel : aucun recyclage n'est nécessaire, l'effet
--      est immédiat.
--
-- ----------------------------------------------------------------------------
-- COMMENT LE SECRET ENTRE DANS VAULT SANS ÊTRE ÉCRIT NULLE PART
-- ----------------------------------------------------------------------------
-- La clé est DÉJÀ en base, dans `cron.job.command`. Ce fichier l'y récupère par
-- expression régulière et la range dans Vault. Elle ne transite donc ni par ce
-- dépôt, ni par un commit, ni par une commande à taper : personne n'a besoin de
-- la manipuler, et il n'y a rien de sensible à versionner. L'URL du projet
-- (qui n'est pas un secret) est extraite de la même commande, ce qui garde le
-- fichier indépendant de l'instance : il fonctionne tel quel sur une branche
-- Supabase ou une future instance de test.
--
-- ORDRE DES OPÉRATIONS, C'EST LE POINT CRITIQUE. Un job cassé est bien pire
-- qu'un secret mal rangé. Le job n'est donc réécrit qu'en DERNIER, une fois le
-- secret relu depuis Vault et vérifié conforme. Tout se joue dans un unique
-- bloc `DO` (section 2) : une exception y annule l'instruction entière, donc
-- l'écriture dans Vault comme la réécriture du job, indépendamment du fait que
-- `supabase db push` enveloppe déjà chaque fichier dans une transaction.
--
-- REJEU. Idempotent. Au deuxième passage, le secret est déjà dans Vault (rien
-- n'est recréé : `vault.secrets` porte un index UNIQUE sur `name`, un second
-- `create_secret` échouerait en 23505) et la commande du job est déjà la
-- commande cible, donc le job n'est pas retouché du tout.
--
-- BASE NEUVE (`supabase db reset`). Sur une base reconstruite, 20260606120000
-- s'exécute pour de bon et crée un `weekly-digest-monday` en version GUC : le
-- job existe, mais il ne porte AUCUNE clé, et Vault est vide. Il n'y a donc rien
-- à reprendre. Ce cas est traité explicitement par un `RAISE NOTICE` suivi d'un
-- `RETURN` : le reset passe, le job est laissé tel quel, et les e-mails restent
-- inertes en local exactement comme aujourd'hui. Faire échouer un reset ici
-- serait un faux positif, la migration n'a simplement rien à corriger.
--
-- CHANGEMENT FONCTIONNEL À CONNAÎTRE. La section 3 branche le trigger e-mail sur
-- Vault, ce qui l'ACTIVE : de vrais e-mails partiront, via Resend, vers de
-- vraies personnes. Détail de l'impact et garde-fous en tête de section 3.
--
-- APPLIQUEE EN PROD LE 2026-08-11 (db push lance par Matthieu).
-- ============================================================================


-- ============================================================================
-- 1. Le lecteur de secrets
-- ============================================================================
-- Point d'accès unique à Vault pour toute la base : un seul endroit à auditer,
-- au lieu d'un `vault.decrypted_secrets` recopié dans chaque appelant.
--
-- SECURITY DEFINER (propriétaire postgres, comme les autres fonctions de ce
-- dépôt) : `vault.decrypted_secrets` appartient à `supabase_admin` et n'est
-- lisible ni par `anon` ni par `authenticated`. C'est la fonction qui porte le
-- droit de lecture, pas l'appelant.
--
-- `SET search_path = ''` + noms qualifiés : même exigence que partout ailleurs
-- ici (correctif d'advisor `function_search_path_mutable` posé par
-- 20260730120000). Sur une fonction SECURITY DEFINER c'est doublement
-- important : sans lui, un appelant pourrait faire précéder le schéma `vault`
-- par un schéma à lui et détourner la lecture.
--
-- Le REVOKE ci-dessous est LOAD-BEARING, pas décoratif : la fonction vit dans
-- `public`, donc PostgREST l'exposerait en RPC (`/rest/v1/rpc/get_app_secret`)
-- si `authenticated` gardait EXECUTE. Elle est placée dans `public` par
-- cohérence avec les 8 autres fonctions sensibles du dépôt, toutes protégées de
-- la même façon depuis 20260514085447. Corollaire à garder en tête : un futur
-- `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public` rouvrirait cet accès.
--
-- Deux comportements pour un seul appelant possible à la fois :
--   - `p_required = false` (défaut) : renvoie NULL si le secret est absent.
--     C'est ce que veut le trigger e-mail, qui doit rester inerte et surtout
--     ne jamais faire échouer l'insertion d'une notification.
--   - `p_required = true` : lève une exception. C'est ce que veut le job cron,
--     dont l'échec doit être visible dans `cron.job_run_details` plutôt que de
--     partir en requête HTTP avec un en-tête Authorization vide (401 muet).
--     Cela reproduit la sévérité du `current_setting(...)` sans `missing_ok`
--     qu'utilisait le job côté GUC.
CREATE OR REPLACE FUNCTION public.get_app_secret(p_name text, p_required boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_value text;
BEGIN
  SELECT s.decrypted_secret INTO v_value
  FROM vault.decrypted_secrets s
  WHERE s.name = p_name;

  IF v_value IS NULL AND p_required THEN
    RAISE EXCEPTION 'Secret Vault « % » introuvable', p_name
      USING ERRCODE = 'no_data_found',
            HINT = 'Voir supabase/migrations/20260811100000_vault_service_role_key.sql';
  END IF;

  RETURN v_value;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_app_secret(text, boolean) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_app_secret(text, boolean) IS
  'Lecture d''un secret Vault. Reservee au trigger notify_email_on_insert et au job cron weekly-digest-monday. EXECUTE revoque pour anon/authenticated/PUBLIC.';


-- ============================================================================
-- 2. Reprise du secret depuis le job, puis réécriture du job
-- ============================================================================
-- Un seul bloc, donc une seule instruction, donc atomique : si quoi que ce soit
-- cloche, rien n'a bougé, et surtout pas le job.
DO $do$
DECLARE
  v_jobid           bigint;
  v_command_actuel  text;
  v_key_extraite    text;
  v_url_extraite    text;
  v_key_vault       text;
  v_url_vault       text;
  v_command_cible   text;
BEGIN
  -- La commande cible : strictement le même appel que la commande actuelle
  -- (même URL, mêmes en-têtes, même corps `{}`), la seule différence étant
  -- l'origine des deux valeurs. `jsonb_build_object` remplace le littéral jsonb
  -- d'origine parce qu'il faut désormais concaténer, c'est la forme qu'utilisent
  -- déjà 20260606120000 et le trigger e-mail. `p_required = true` sur les deux
  -- lectures : mieux vaut un job en erreur tracée qu'un appel HTTP silencieux.
  v_command_cible := $cmd$SELECT net.http_post(
    url := public.get_app_secret('supabase_url', true) || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_secret('service_role_key', true)
    ),
    body := '{}'::jsonb
  );$cmd$;

  SELECT j.jobid, j.command INTO v_jobid, v_command_actuel
  FROM cron.job j
  WHERE j.jobname = 'weekly-digest-monday';

  v_key_vault := public.get_app_secret('service_role_key');
  v_url_vault := public.get_app_secret('supabase_url');

  -- ---- 2.a Extraction -------------------------------------------------------
  -- Le JWT est capté sur sa forme complète (`eyJ` + trois segments base64url
  -- séparés par des points) et non sur « tout ce qui suit Bearer », pour ne pas
  -- ramasser la guillemet fermante ni un fragment tronqué. L'URL est captée sur
  -- la même commande, ce qui évite d'inscrire une référence de projet en dur.
  IF v_command_actuel IS NOT NULL THEN
    v_key_extraite := (regexp_match(
      v_command_actuel,
      'Bearer\s+(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)'
    ))[1];
    v_url_extraite := (regexp_match(
      v_command_actuel,
      '(https://[a-z0-9-]+\.supabase\.co)'
    ))[1];
  END IF;

  -- ---- 2.b Rien à reprendre : on sort proprement ----------------------------
  -- Base neuve après `db reset` (job en version GUC, Vault vide), instance de
  -- développement, ou prod déjà assainie par un passage précédent dont le
  -- secret aurait été retiré de Vault à la main. Dans les trois cas il n'y a
  -- aucune clé à sauver : lever une exception bloquerait `db reset` sans rien
  -- protéger. Le job reste tel quel, les e-mails restent inertes.
  IF v_key_extraite IS NULL AND v_key_vault IS NULL THEN
    RAISE NOTICE '[vault] Aucune cle service_role a reprendre (job absent ou sans secret, Vault vide). Job laisse inchange, e-mails inertes.';
    RETURN;
  END IF;

  -- ---- 2.c Incohérence : on refuse, sans avoir rien touché ------------------
  -- Une clé en clair a été trouvée mais pas l'URL qui va avec, alors que les
  -- deux sortent de la même chaîne. La commande n'a pas la forme attendue :
  -- on s'arrête plutôt que de fabriquer un job à l'URL inventée.
  IF v_key_extraite IS NOT NULL AND v_url_extraite IS NULL AND v_url_vault IS NULL THEN
    RAISE EXCEPTION 'Cle service_role reperee dans le job « weekly-digest-monday » mais URL du projet introuvable dans la meme commande : migration interrompue, job inchange.'
      USING HINT = 'Verifier la forme de cron.job.command avant de rejouer.';
  END IF;

  -- ---- 2.d Alimentation de Vault -------------------------------------------
  -- Conditionnée à l'absence : `vault.secrets` porte un index UNIQUE partiel sur
  -- `name`, donc un `create_secret` de trop lèverait 23505. Le rejeu ne duplique
  -- rien et ne réécrit rien.
  IF v_key_vault IS NULL THEN
    PERFORM vault.create_secret(
      v_key_extraite,
      'service_role_key',
      'Cle service_role. Reprise depuis cron.job.command le 2026-08-11 (migration 20260811100000). Lue par public.get_app_secret().'
    );
  END IF;

  IF v_url_vault IS NULL AND v_url_extraite IS NOT NULL THEN
    PERFORM vault.create_secret(
      v_url_extraite,
      'supabase_url',
      'URL du projet Supabase (non secrete, rangee ici pour un mecanisme de lecture unique). Reprise depuis cron.job.command le 2026-08-11.'
    );
  END IF;

  -- ---- 2.e Vérification avant de toucher au job ----------------------------
  -- On relit depuis Vault, on ne se fie pas au fait que l'INSERT n'ait pas
  -- protesté : c'est cette relecture qui prouve que le chemin complet
  -- (chiffrement, vue de déchiffrement, droits de la fonction) fonctionne. Tant
  -- qu'elle n'est pas passée, le job n'est pas touché.
  v_key_vault := public.get_app_secret('service_role_key');
  v_url_vault := public.get_app_secret('supabase_url');

  IF v_key_vault IS NULL OR v_key_vault !~ '^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Relecture du secret Vault « service_role_key » impossible ou malformee : migration interrompue, job inchange.';
  END IF;

  IF v_url_vault IS NULL THEN
    RAISE EXCEPTION 'Relecture du secret Vault « supabase_url » impossible : migration interrompue, job inchange.';
  END IF;

  -- Garde-fou contre une collision de nom : si un secret « service_role_key »
  -- préexistait avec une AUTRE valeur que celle du job, réécrire le job le
  -- ferait pointer sur une clé qui n'est pas celle qui fonctionne aujourd'hui.
  IF v_key_extraite IS NOT NULL AND v_key_vault <> v_key_extraite THEN
    RAISE EXCEPTION 'Le secret Vault « service_role_key » existe deja avec une valeur differente de celle du job : migration interrompue, job inchange.'
      USING HINT = 'Arbitrer manuellement quelle valeur conserver avant de rejouer.';
  END IF;

  -- ---- 2.f Réécriture du job ------------------------------------------------
  -- Seulement maintenant, et seulement si la commande diffère de la cible : au
  -- rejeu, la comparaison est vraie à l'identique et le job n'est pas retouché.
  -- Planification (`0 7 * * 1`) et fonction cible (`weekly-digest`) inchangées.
  --
  -- `unschedule` puis `schedule` : c'est le motif déjà employé par 20260606120000
  -- et 20260810140000, sans ambiguïté quelle que soit la version de pg_cron.
  -- Effet de bord assumé : le job repart avec un nouveau jobid, l'historique de
  -- `cron.job_run_details` antérieur reste rattaché au jobid 1.
  IF v_command_actuel IS DISTINCT FROM v_command_cible THEN
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule('weekly-digest-monday');
    END IF;

    PERFORM cron.schedule('weekly-digest-monday', '0 7 * * 1', v_command_cible);
    RAISE NOTICE '[vault] Job « weekly-digest-monday » reecrit : la cle est desormais lue dans Vault.';
  ELSE
    RAISE NOTICE '[vault] Job « weekly-digest-monday » deja branche sur Vault : inchange.';
  END IF;
END
$do$;


-- ============================================================================
-- 3. Trigger e-mail : Vault au lieu des GUC, ce qui l'ACTIVE
-- ============================================================================
-- Ce que fait ce remplacement : `notify_email_on_insert` lisait
-- `app.settings.supabase_url` et `app.settings.service_role_key` via
-- `current_setting(..., true)` et sortait en avance dès que l'un des deux était
-- absent. Ils n'ont jamais été posés sur cette base (vérifié : les deux
-- `current_setting` renvoient NULL), donc ce chemin était totalement inerte
-- depuis 20260606120000. Il devient actif.
--
-- IMPACT RÉEL, à avoir en tête avant `db push`. De vrais e-mails partiront vers
-- de vraies personnes, via Resend, pour les types NON présents dans la liste de
-- skip, c'est-à-dire :
--   - `vma_update` : nominatif, vers l'athlète concerné (65 au total depuis
--     l'ouverture, 1 sur les 90 derniers jours) ;
--   - `new_athlete` : vers les 2 coachs, à chaque inscription (type introduit
--     par 20260810140000, aucune occurrence à ce jour) ;
--   - `system` : rare (29 au total, aucune depuis juin).
-- Les gros volumes (`palmares`, 4761 lignes, et `new_session`, 1277) restent
-- dans la liste de skip et ne déclenchent aucun envoi.
--
-- AUCUN RATTRAPAGE RÉTROACTIF. Le trigger est `AFTER INSERT FOR EACH ROW` : il
-- ne voit que les nouvelles lignes. Les 6 136 notifications déjà en base ne
-- seront jamais rejouées, et `net.http_request_queue` est vide (0 ligne au
-- moment d'écrire ce fichier), donc aucun appel n'est en attente de départ.
--
-- COUPE-CIRCUIT, sans nouvelle migration : poser
-- `notification_preferences->'<type>'->>'email'` à `false` sur la ligne de
-- l'utilisateur (lu par la fonction Edge `send-notification-email`). Pour couper
-- tout net : `ALTER TABLE public.notifications DISABLE TRIGGER on_notification_insert_email;`
--
-- La liste de skip est reprise VERBATIM de la définition vivante en prod
-- (identique à 20260810140000) : ce fichier ne change que la source des deux
-- valeurs, rien d'autre.
--
-- PIÈGE DÉJÀ DOCUMENTÉ EN 20260810140000, toujours valable : `CREATE OR REPLACE
-- FUNCTION` réassigne toutes les propriétés sauf le propriétaire et les droits.
-- Le `SET search_path = ''` doit donc être re-déclaré ici, sinon on rouvre
-- l'advisor `function_search_path_mutable` refermé par 20260730120000. Les
-- REVOKE de 20260514085447 sur cette fonction, eux, survivent.
--
-- SEULE MODIFICATION DE STRUCTURE : les deux lectures passent du DECLARE au
-- corps, APRÈS le test de la liste de skip. Un `current_setting` était gratuit,
-- une lecture Vault ne l'est pas (jointure plus déchiffrement), et l'initialiseur
-- du DECLARE s'exécutait à CHAQUE insertion de notification, y compris pour les
-- milliers de `palmares` et `new_session` qui sortent à la ligne suivante. Le
-- secret n'est désormais déchiffré que lorsqu'un e-mail va réellement partir.
CREATE OR REPLACE FUNCTION public.notify_email_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NEW.type IN ('weekly_digest', 'palmares', 'new_session', 'reaction', 'vma_missing') THEN
    RETURN NEW;
  END IF;

  -- Lecture non stricte : si les secrets ne sont pas là (base neuve, instance de
  -- développement), on ne tente rien et surtout on ne fait pas échouer
  -- l'insertion de la notification. Même sûreté par défaut qu'avec les GUC.
  v_url := public.get_app_secret('supabase_url');
  v_key := public.get_app_secret('service_role_key');

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('record', jsonb_build_object(
      'id', NEW.id, 'user_id', NEW.user_id, 'type', NEW.type,
      'title', NEW.title, 'body', NEW.body, 'link', NEW.link
    ))
  );
  RETURN NEW;
END;
$fn$;


-- ============================================================================
-- 4. Qui peut lire quoi, après cette migration
-- ============================================================================
-- Constaté en base le 2026-08-11, avant comme après (cette migration ne touche
-- à aucun de ces droits, elle s'appuie dessus) :
--
--   anon / authenticated : USAGE sur le schema `vault` -> false
--                          SELECT sur `vault.decrypted_secrets` -> false
--                          SELECT sur `vault.secrets` -> false
--                          EXECUTE sur `vault.create_secret` -> false
--     Deux verrous indépendants (le schéma et la vue), donc un rôle client ne
--     peut pas lire le secret directement.
--
--   anon / authenticated : EXECUTE sur `public.get_app_secret` -> révoqué en
--     section 1. C'est le verrou qui ferme le chemin indirect, celui qui compte
--     vraiment puisque la fonction est SECURITY DEFINER et vit dans le schéma
--     exposé par PostgREST. Sans EXECUTE, l'appel RPC répond 404/403 et la
--     fonction n'apparaît pas non plus dans les advisors
--     `*_security_definer_function_executable`.
--
--   postgres : lit `vault.decrypted_secrets` et exécute `vault.create_secret`.
--     C'est le rôle des migrations et celui sous lequel tourne le job cron,
--     et c'est le propriétaire de `get_app_secret` (donc EXECUTE conservé
--     malgré le REVOKE, qui ne retire jamais ses droits au propriétaire).
--
--   service_role : lit déjà `vault.decrypted_secrets` (droit par défaut de
--     Supabase, inchangé ici). Sans conséquence : ce rôle EST le porteur de la
--     clé, il ne peut rien apprendre qu'il ne détienne déjà.
--
-- Les deux appelants légitimes atteignent donc le secret, et eux seuls :
--   - le trigger `on_notification_insert_email`, via
--     `notify_email_on_insert` qui est SECURITY DEFINER et appartient à postgres ;
--   - le job cron `weekly-digest-monday`, qui s'exécute en tant que postgres.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle ne fait pas tourner la clé. Si l'on
-- considère qu'un secret resté en clair dans une table depuis mars 2026 est
-- compromis, la rotation se fait dans le dashboard Supabase, puis se propage ici
-- avec un seul `vault.update_secret(...)` : ni le job ni le trigger ne changent,
-- ils relisent Vault à chaque appel. C'est précisément ce que le modèle GUC ne
-- permettait pas sans recycler le pool PostgREST.
-- ============================================================================
