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

> ⚠️ Au moment de cette régularisation, le diff direct contre le schéma réel
> (`list_tables` / `list_migrations`) n'a **pas pu être exécuté** (l'appel MCP
> de lecture projet exigeait une approbation non accordée dans la session). Le
> baseline reflète donc l'**historique des fichiers SQL** du repo, pas un dump
> live. À confirmer par un rebuild de branche avant usage en prod.

## Reste à faire (hors périmètre de cette régularisation)

L'**infra emails** (`notify_email_on_insert` + crons digests, fichiers racine
`phase3`/`phase6`) et le **cron de purge des préparations** (`phase4`) ne sont
**pas** dans la lignée canonique : ils contiennent des URLs/secrets propres à
l'environnement de prod (clé `service_role` en dur). Recommandation : les
porter en migration CLI en suivant le modèle **sans secret** déjà utilisé par
`20260317230000_strava_cron.sql` (`current_setting('app.settings.…')`) plutôt
que de réintroduire des secrets en clair. L'appli fonctionne sans (seuls les
emails / purges automatiques sont désactivés).
