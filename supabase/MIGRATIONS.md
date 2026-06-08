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
| 13 | `20260514120000_session_templates.sql` | table `session_templates` + 10 seeds |
| 14 | `20260606120000_notifications_email_and_crons.sql` | infra emails + crons (phase3/4/6) portée **sans secret** (GUC) |

## Reconstruire la base depuis zéro (instance neuve / test)

```bash
supabase link --project-ref <ref-de-l-instance>
supabase db reset            # applique baseline puis toutes les migrations CLI
```

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

## Dérives « dashboard » détectées via advisors et régularisées

Quatre policies présentes en prod mais dans **aucun** fichier SQL (ni racine, ni
CLI) — confirmant l'hypothèse de l'audit. Régularisées dans le baseline :

| Table | Constat live | Traitement dans le baseline |
|---|---|---|
| `users` | policy INSERT `Users can insert their own profile` (nécessaire à l'inscription) | **Ajoutée** : `WITH CHECK (auth.uid() = id)` (déduit de `AuthContext.signup`) |
| `notifications` | `System can insert notifications` renommée `Authenticated can insert notifications` | **Nom aligné** (effet identique `WITH CHECK (true)`, voulu — cf. ci-dessous) |
| `exit_feedbacks` | INSERT renommée `Users can insert their own feedback` | **Nom aligné** (`WITH CHECK (true)` ; table anonyme, l'app insère `{reason, comment}`) |
| `exit_feedbacks` | SELECT renommée `Users can read their own feedback` | **Conservé coach-only** (définition live inconnue ; voir sécurité) |

## Points de sécurité à trancher (advisors)

Relevés par `get_advisors(security)` — **non modifiés** ici (hors périmètre ou
by-design), à arbitrer :

- **`exit_feedbacks` SELECT** : prod expose une policy `Users can read their own
  feedback` de définition inconnue. La table est **anonyme** (pas de `user_id`) ;
  si le `USING` live est permissif, les motifs de départ sont **sur-exposés**.
  → dumper la définition (requête ci-dessous) et confirmer une lecture coach-only.
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
