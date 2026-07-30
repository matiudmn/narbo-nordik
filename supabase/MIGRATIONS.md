# Base de données — source de vérité & migrations

> Régularisation suite à l'audit sécurité (revue Sprints S1+S3, PR #1).

## TL;DR

La **source de vérité unique** des migrations est le dossier
**`supabase/migrations/`** (migrations CLI Supabase horodatées).
Un `supabase db reset` reconstruit toute la base depuis zéro, de façon
déterministe.

Les anciens fichiers SQL **à la racine** (`supabase-schema.sql`,
`supabase-migration-phase2…6.sql`, `supabase-migration-session-nordiks.sql`,
`supabase-migration-restrict-notifications.sql`) sont **historiques / dépréciés**.
Ils décrivent l'état d'origine appliqué à la main, mais **ne sont plus la
référence** : ils sont désormais consolidés dans le baseline
`supabase/migrations/20260307000000_baseline.sql`.

## Pourquoi cette régularisation

L'audit a signalé que la base de prod « divergeait » des fichiers SQL
(ex. `sessions.is_personal`, `session_type` à 7 valeurs). En réalité ces
éléments **étaient bien versionnés**, mais dans `supabase/migrations/` —
un dossier que la doc (CLAUDE.md) ne mentionnait pas. Le vrai problème :
**deux systèmes de migration en parallèle**, dont **aucun ne reconstruisait la
base seul** :

- le dossier CLI `supabase/migrations/` fait des `ALTER TABLE` sur des tables
  qui n'étaient créées que par les fichiers racine → un `db reset` échouait
  faute de **baseline** ;
- le chemin « racine » documenté (`supabase-schema.sql` + `phaseN`) ignorait
  **tout** ce qui a été ajouté via le CLI (is_personal, club_settings, strava,
  templates, champs d'enquête, labels palmarès, RLS perso, etc.).

Le **baseline** capture l'état pré-CLI : `baseline ➜ migrations CLI` rejoue
désormais l'historique réel et reconstruit la base complète.

## Lignée canonique (`supabase/migrations/`)

| Ordre | Fichier | Contenu |
|------|---------|---------|
| 0 | `20260307000000_baseline.sql` | **Baseline** : schéma + RLS + fonctions/triggers + bucket storage (consolide schema.sql + phase2/4/5 + session-nordiks + restrict-notifications) |
| 1 | `20260309133009_palmares_label_and_coach_rls.sql` | `race_results.is_label` + RLS coachs |
| 2 | `20260310100000_validation_survey_fields.sql` | `objective_reached`, `sensations` |
| 3 | `20260310110000_personal_sessions.sql` | `sessions.is_personal` |
| 4 | `20260310120000_personal_sessions_rls.sql` | RLS séances perso (athlètes) |
| 5 | `20260310140000_session_type_check.sql` | `session_type` ➜ 6 valeurs |
| 6 | `20260310150000_club_settings.sql` | table `club_settings` + seed |
| 7 | `20260316100000_palmares_comment_and_auto_session.sql` | `race_results.comment` + `session_type` ➜ **7 valeurs** (`course`) |
| 8 | `20260317100000_allure_zones_refactor.sql` | migration de données (blocs `endurance`/`am` ➜ `ef`) |
| 9 | `20260317200000_strava_integration.sql` | tables `strava_connections` / `strava_activities` + RLS |
| 10 | `20260317210000_strava_activities_update_policy.sql` | RLS update activités |
| 11 | `20260317220000_strava_match_functions.sql` | RPC match/unmatch |
| 12 | `20260317230000_strava_cron.sql` | extensions + cron sync Strava |
| 13 | `20260514085447_security_hardening.sql` | matérialisation d'un durcissement dashboard non capturé : `REVOKE EXECUTE` sur fonctions sensibles (`delete_auth_user`, `notify_*`, match/unmatch Strava) + policy insertion notifications |
| 14 | `20260514120000_session_templates.sql` | table `session_templates` + 10 seeds |
| 15 | `20260606120000_notifications_email_and_crons.sql` | infra emails + crons (phase3/4/6) portée **sans secret** (GUC) |
| 16 | `20260606130000_session_metrics_fields.sql` | `session_validations` : colonnes métriques de séance (distance, durée, D+, FC, cadence, source) + bornes de cohérence |
| 17 | `20260606140000_strava_export_backfill.sql` | archive `_archive_strava_activities` + backfill des métriques de compte-rendu depuis les activités Strava déjà matchées |
| 18 | `20260606150000_remove_strava.sql` | retrait total de Strava (DESTRUCTIF) : cron, RPC, policies, tables `strava_connections`/`strava_activities`, colonne `users.strava_id` |
| 19 | `20260606160000_security_metrics_fixes.sql` | RLS sur `_archive_strava_activities` (non héritée du `CREATE TABLE AS`), `WITH CHECK` manquant sur l'UPDATE de `session_validations`, borne `duration_s` élargie (150h, ultra-trails) |
| 20 | `20260606170000_validation_reactions.sql` | table `validation_reactions` (kudos sur un compte-rendu) + RLS |
| 21 | `20260606180000_club_featured_validation.sql` | `club_settings` : `featured_validation_id` + `featured_at` (coup de coeur du coach) |
| 22 | `20260606190000_reaction_notif_and_policy_fixes.sql` | type `reaction` dans `notifications` (exclu de l'email transactionnel) + `WITH CHECK` sur l'UPDATE de `club_settings` |
| 23 | `20260606200000_validation_rpe.sql` | `session_validations.rpe` (ressenti d'effort 1-10 de l'athlète) |
| 24 | `20260608100000_sessions_personal_read_rls.sql` | durcissement RLS : lecture des séances perso (`sessions.is_personal`) limitée au créateur et aux coachs |
| 25 | `20260608110000_session_rpe.sql` | `sessions.session_rpe` (difficulté attendue de la séance, posée par le coach) |
| 26 | `20260730120000_security_perf_hardening.sql` | durcissement issu des advisors : `search_path` figé sur 2 fonctions, `increment_template_usage` retirée à anon, `WITH CHECK` resserré sur l'insert de `notifications`, SELECT du bucket `session-attachments` limité au dossier de l'utilisateur, 6 index de FK manquants, 44 policies encapsulées en `(select auth.uid())` (`auth_rls_initplan`) |
| 27 | `20260730140000_merge_policies_and_strava_archive.sql` | fin des advisors : fusion des policies permissives doublées (`sessions` INSERT/UPDATE/DELETE, `users` INSERT/UPDATE) en une policy par action, deny-all RESTRICTIVE explicite + clé primaire sur `_archive_strava_activities` |
| 28 | `20260730150000_exit_feedbacks_anonymous.sql` | `exit_feedbacks` : suppression de la colonne `user_id` (dérive dashboard), insertion rendue à l'app et lecture rendue aux coachs. Débloque `db reset` et remet l'enquête de sortie en service |

> **État réel en prod** (relu le 2026-07-30 en fin de journée via
> `supabase migration list --linked`) : les entrées **26 et 27 sont appliquées**,
> l'entrée **28 ne l'est pas** (rédigée sans écriture, en attente d'un
> `supabase db push` explicite après revue).
>
> Cette note a déjà dérivé une fois (elle donnait 27 comme non appliquée alors
> qu'un `db push` avait eu lieu) : **toujours revérifier avec
> `supabase migration list --linked`** avant de s'y fier ou de la modifier.

## Reconstruire la base depuis zéro (instance neuve / test)

```bash
supabase link --project-ref <ref-de-l-instance>
supabase db reset            # applique baseline puis toutes les migrations CLI
```

> ### ✅ `db reset` débloqué (dérive `exit_feedbacks` régularisée le 2026-07-30)
>
> Un `db reset` s'arrêtait sur l'entrée 26 (`20260730120000`), qui fait un
> `ALTER POLICY ... = user_id` sur `exit_feedbacks` alors que le dépôt ne
> déclarait ni la colonne `user_id`, ni la policy SELECT
> `"Users can read their own feedback"` (`42703` / `42704`). Les migrations
> suivantes n'étaient donc jamais jouées.
>
> La prod a été **lue réellement** le 2026-07-30 (voir « Comment lire la prod »
> ci-dessous) : la colonne existe bien (`uuid NOT NULL`, sans DEFAULT ni clé
> étrangère) et les deux policies portent les noms attendus. Le **baseline
> reflète désormais cet état constaté**, et l'entrée **28**
> (`20260730150000`) le corrige derrière. La chaîne
> `baseline ➜ 20260730120000 ➜ 20260730150000` a été rejouée sur un Postgres réel
> (PGlite, 10/10 vérifications) à partir des fichiers du dépôt.
>
> Le bloc `exit_feedbacks` du baseline est volontairement « cassé » (il reproduit
> la prod pré-correctif) : **ne pas le corriger sur place**, sinon l'entrée 26 ne
> rejoue plus.

## Adopter le baseline sur la base de PROD EXISTANTE

La prod **fonctionne déjà** : il ne faut **pas** rejouer le baseline, juste le
déclarer comme appliqué pour que le CLI ne tente pas de le lancer.

```bash
supabase link --project-ref jubvxfjxokeefhfmjhwl   # projet "Narbo_Nordik"
supabase migration repair --status applied 20260307000000
supabase migration list      # vérifier l'alignement local <-> remote
```

> Le baseline est **idempotent** (IF NOT EXISTS / CREATE OR REPLACE /
> DROP POLICY IF EXISTS) : même exécuté par erreur sur la prod, il est sans
> effet. **NE RIEN appliquer en prod sans validation préalable.**

## Valider avant toute action (recommandé)

Le plus sûr : prouver que `baseline ➜ migrations` reconstruit bien la base sur
une **branche jetable** (DB neuve, données de prod NON copiées) :

- Via MCP : `mcp__Supabase__create_branch` (puis `list_tables` sur la branche
  pour diff), ou
- Via CLI : `supabase db reset` sur une instance de test.

> **État de la vérification (06/2026).** Les outils MCP de lecture de **données**
> projet (`list_tables`, `list_migrations`, `execute_sql`, `generate_typescript_types`)
> sont restés **bloqués** (approbation non accordée). En revanche les **advisors**
> Supabase (`get_advisors` sécurité + perf) étaient accessibles et ont permis de
> recouper le live : **15 tables, 4 FKs, 6 index, fonctions et 46 policies**
> confirmés conformes au baseline + migrations. Le diff **colonne-par-colonne**
> et les **définitions exactes des policies** restent non récupérables par MCP —
> recoupés via `src/types/index.ts` + le comportement de l'app. **Validation
> finale recommandée** (gratuite, locale) : `supabase db reset` sur une instance
> de test, qui prouve que `baseline → migrations` reconstruit sans erreur.

## Comment lire la prod sans MCP, sans psql et sans Docker

Situation rencontrée en 06/2026 et 07/2026 : serveur MCP Supabase non connecté,
`psql`/`pg_dump` absents du poste, Docker non lancé (donc `db dump` et `db pull`
indisponibles). Trois lectures restent possibles, **en lecture seule** :

```bash
supabase gen types typescript --linked   # schéma distant complet
supabase inspect db table-stats --linked # tailles + nb de lignes estimé
supabase inspect db vacuum-stats --linked # lignes mortes, dernier vacuum/analyze
```

`gen types` est le plus utile : il donne colonnes, types, **nullabilité**
(`Row`), **présence d'un DEFAULT** (une colonne `NOT NULL` qui apparaît
optionnelle dans `Insert` a un DEFAULT) et les **clés étrangères**
(`Relationships`).

Complément côté PostgREST, avec la seule clé anon, pour sonder une colonne :

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/<table>?select=<colonne>&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

`42703` = la colonne n'existe pas, `[]` = elle existe (toujours faire le
contrôle négatif avec un nom bidon). Un filtre `?<colonne>=eq.xxx` renvoie
`22P02` avec le **type** attendu, et `select=id,<table2>(id)` renvoie `PGRST200`
s'il n'y a **pas de FK**.

Ce qui reste **non lisible** par ces chemins : `pg_policies` (définitions des
policies) et `pg_trigger`. Pour valider du SQL de RLS, la parade utilisée est
**PGlite** (Postgres en WASM via npm) : on y rejoue les fichiers du dépôt et on
compare les comportements avant/après par persona.

## Dérives « dashboard » détectées via advisors et régularisées

Policies et colonnes présentes en prod mais dans **aucun** fichier SQL (ni
racine, ni CLI), confirmant l'hypothèse de l'audit. Régularisées dans le
baseline :

| Table | Constat live | Traitement dans le baseline |
|---|---|---|
| `users` | policy INSERT `Users can insert their own profile` (nécessaire à l'inscription) | **Ajoutée** : `WITH CHECK (auth.uid() = id)` (déduit de `AuthContext.signup`) |
| `notifications` | `System can insert notifications` renommée `Authenticated can insert notifications` | **Nom aligné** (effet identique `WITH CHECK (true)`, voulu — cf. ci-dessous) |
| `exit_feedbacks` | colonne `user_id` `uuid NOT NULL`, sans DEFAULT ni FK, dans aucun fichier SQL | **Déclarée** dans le baseline (état constaté), puis **supprimée** par l'entrée 28 |
| `exit_feedbacks` | INSERT renommée `Users can insert their own feedback`, `WITH CHECK (auth.uid() = user_id)` | **Reflétée** dans le baseline, puis remplacée par l'entrée 28 |
| `exit_feedbacks` | SELECT nommée `Users can read their own feedback`, `USING (auth.uid() = user_id)` | **Reflétée** dans le baseline, puis rendue aux coachs par l'entrée 28 |

## Points de sécurité à trancher (advisors)

Relevés par `get_advisors(security)`. Le premier point est **tranché et corrigé**
(entrée 28) ; les suivants restent **non modifiés** (hors périmètre ou
by-design), à arbitrer :

- ~~**`exit_feedbacks` SELECT**~~ : **tranché le 2026-07-30**. La définition live
  est `USING ((select auth.uid()) = user_id)`, posée par l'entrée 26 : elle n'est
  **pas permissive**, les motifs de départ ne sont donc **pas** sur-exposés aux
  membres. Le défaut réel était l'inverse et plus grave : la table portait un
  `user_id NOT NULL` sans DEFAULT que l'app n'envoie pas
  (`src/pages/athlete/Profile.tsx:149`), donc **chaque réponse à l'enquête était
  rejetée en `42501` et perdue en silence** (l'erreur n'est pas testée avant la
  suppression du compte) ; et la lecture étant limitée à l'auteur, dont le compte
  venait d'être supprimé, **aucun coach ne pouvait lire quoi que ce soit**. En
  prod, `exit_feedbacks` n'a **jamais contenu une seule ligne** (0 ligne,
  0 ligne morte, jamais analysée). Corrigé par l'entrée 28 : table réellement
  anonyme, insertion rendue à l'app, lecture rendue aux coachs.
- **`notifications` INSERT `WITH CHECK (true)`** : permissif, mais **voulu** — le
  client insère des notifs pour d'autres users (nordik → propriétaire de séance).
  Durcir nécessiterait de revoir cette logique.
- **Fonctions `SECURITY DEFINER` exposées** à `anon`/`authenticated` :
  `increment_template_usage`, `match_strava_activity`, `unmatch_strava_activity`.
  Les RPC Strava vérifient `auth.uid()` ; `increment_template_usage` a aussi un
  `search_path` mutable. → `set search_path = ''` et/ou `revoke execute from anon`.
- **Bucket public `session-attachments`** avec SELECT large (listing possible).

> Dump des définitions exactes (à exécuter dans le SQL Editor si besoin de
> réconcilier au mot près) :
> ```sql
> select tablename, policyname, cmd, roles, qual, with_check
> from pg_policies where schemaname in ('public','storage') order by 1,2;
> ```

## Confidentialité / RLS par persona — décisions 2026-06-08

Nouvel audit : lecture ouverte (`SELECT USING (true)`) sur `users`, `sessions`,
`session_validations`, `race_results`. Comme `DataContext.fetchAll` charge tout
le club en mémoire avant de filtrer côté client (`lib/athleteSessions`,
`lib/search.getScopedEntities`), tout membre authentifié peut lire l'intégralité
de ces tables via un appel PostgREST direct. Le cloisonnement client est de
l'UX, pas une frontière de sécurité.

Périmètre arbitré. L'app est en **transparence club** (la plupart des pages de
consultation, `/club`, `/palmares`, `/directory/:id`, `/session/:id`, sont
partagées coach/athlète) :

**Durci, fait.** Migration `20260608100000_sessions_personal_read_rls.sql` :
lecture des **séances perso** (`sessions.is_personal = true`) limitée au créateur
(`created_by = auth.uid()`) et aux coachs ; le programme club
(`is_personal = false`) reste lisible par tous. Appliqué et vérifié en prod le
2026-06-08 (simulation JWT : un athlète voit 0 séance perso d'autrui et tout le
club ; un coach voit tout). 113 séances perso de 24 athlètes protégées, 173
séances club inchangées. Aucun changement applicatif (le client filtrait déjà
via `filterSessionsForAthlete`). Advisors sécurité : aucun nouvel avertissement.

**Transparence club assumée, inchangé (voulu).**

- `race_results` : palmarès public au club (page "Palmarès du club", ClubProfile,
  fiches athlète). Pas de restriction en lecture.
- `session_validations` : lecture club conservée. Le `status` alimente
  l'assiduité affichée partout (Directory, ClubProfile, fiches) et le "Coup de
  coeur". Le **contenu** (feedback, ressenti, métriques, pièce jointe) reste donc
  techniquement lisible via API par tout membre.
- `users` : nom, VMA, groupe, téléphone, date de naissance, historique VMA sont
  club-visibles par design (Directory, fiches, contact WhatsApp).

**Backlog confidentialité, non fait.**

- *Palier 2, colonnes sensibles `users`* : `email`, `license_number`,
  `notification_preferences`, `strava_id` sont chargés chez tout client
  (`select('*')`) mais jamais montrés aux athlètes. Protection = niveau colonne
  (vue ou table `user_private` en lecture soi+coach) + helper `public.is_coach()`
  `SECURITY DEFINER` (sinon récursion RLS sur `users`). Impacte le client.
- *Palier 3, contenu des validations* : déplacer feedback/ressenti/métriques/
  pièce jointe dans une table restreinte (soi+coach), en gardant le `status`
  lisible pour l'assiduité.
- *`users.is_public`* : flag présent mais **appliqué nulle part** (ni UI ni DB) ;
  à brancher si une vraie confidentialité de l'annuaire est souhaitée.

## Fait : infra emails / crons (régularisée sans secret)

Portée dans `20260606120000_notifications_email_and_crons.sql` (modèle GUC de
`strava_cron`, pas de `service_role` en clair). Les anciens `phase3/4/6` racine
restent comme archive. L'appli fonctionne sans (emails/purges inactifs tant que
`app.settings.supabase_url` / `app.settings.service_role_key` ne sont pas définis).
