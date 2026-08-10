# Backlog Évolutions 2026 — Narbo Nordik

> **Document de référence.** Cadre l'ensemble des chantiers d'évolution de l'application PWA pour 2026 : intégrations multi-devices (Garmin, Coros, Suunto), synchronisation automatique, partage WhatsApp, upload photo, analyse IA Claude, UX double persona.
>
> **Auteur** : Matthieu Daumain — **Dernière maj** : 2026-05-23 — **Statut** : V1 à valider

---

> ### État au 10/08/2026
>
> - **C6 (upload photo / screenshot validation)** : LIVRÉ, avec OCR en plus du scope initial.
> - **C8 (Bridge WhatsApp)** : LIVRÉ (architecture client, 3 surfaces dont Palmarès).
> - **C7 (IA, analyse de séance)** : LIVRÉ EN VERSION MISTRAL (verdict par validation via la fonction `analyze-validation`, décision RGPD : pas d'Anthropic).
> - **C9 (UX double persona)** : LIVRÉ (Disclosure + SessionDetail/Profile/Suivi).
> - **C1, C2, C4, C5** (refacto multi-provider, Coros, Suunto, sync auto) : ABANDONNÉS. Strava a été supprimé le 06/06 et l'OCR (cf. C6) couvre le besoin.
> - **C3 (Garmin Connect)** : ABANDONNÉ (décision Matthieu du 10/08). La candidature n'a jamais été déposée.
>
> Le corps du document ci-dessous n'est pas réécrit (valeur historique) ; seuls les titres de chantier portent désormais un préfixe `[LIVRÉ]`, `[LIVRÉ MISTRAL]` ou `[ABANDONNÉ]`.

---

## Sommaire

1. [Vision & contexte](#1-vision--contexte)
2. [État de l'existant](#2-état-de-lexistant)
3. [Roadmap consolidée](#3-roadmap-consolidée)
4. [Spec détaillée par chantier](#4-spec-détaillée-par-chantier)
   - [C1. Refacto multi-provider](#c1--refacto-multi-provider)
   - [C2. Coros API native](#c2--coros-api-native)
   - [C3. Garmin Connect (partenariat + intégration)](#c3--garmin-connect-partenariat--intégration)
   - [C4. Suunto API native](#c4--suunto-api-native)
   - [C5. Sync automatique à l'ouverture](#c5--sync-automatique-à-louverture)
   - [C6. Upload photo / screenshot validation](#c6--upload-photo--screenshot-validation)
   - [C7. IA Claude — analyse de séance](#c7--ia-claude--analyse-de-séance)
   - [C8. Bridge WhatsApp — partage social](#c8--bridge-whatsapp--partage-social)
   - [C9. UX double persona — simple vs data-friendly](#c9--ux-double-persona--simple-vs-data-friendly)
5. [Annexes](#5-annexes)
   - [A1. Brief de candidature Garmin Developer Program](#a1--brief-de-candidature-garmin-developer-program)
   - [A2. Glossaire](#a2--glossaire)
   - [A3. Liens utiles](#a3--liens-utiles)
   - [A4. Decision log](#a4--decision-log)

---

## 1. Vision & contexte

### 1.1 Mission du produit

Narbo Nordik est une application PWA dédiée à la section **running / trail** du club Narbo Nordik (Narbonne). Elle sert trois usages :

- **Coachs** : programmer des séances, suivre les athlètes, analyser les progressions.
- **Athlètes** : consulter le programme, valider les séances, partager palmarès, suivre sa VMA et ses statistiques.
- **Club** : créer du lien social (palmarès, nordiks, annuaire) et offrir un service moderne aux licenciés.

### 1.2 Personas cibles

| Persona | Description | Besoins clés | Aversions |
|---|---|---|---|
| **Antoine — coureur simple** | 45 ans, court 3x/sem en loisir, possède une Garmin Forerunner 55. N'utilise pas Strava. | Voir le prochain entraînement, valider sa séance en 2 clics, savoir où et quand on court. | Surcharge de chiffres, dashboards complexes, lecture obligatoire de graphiques. |
| **Camille — coureuse data-friendly** | 32 ans, compétitrice trail, Coros Apex 2 Pro, utilise Strava Premium. | Suivi FC par zone, dérive cardiaque, écart au plan, comparaison historique, export. | Données simplifiées à l'extrême qui masquent le détail. |
| **Marc — coach** | 55 ans, entraîneur fédéral, programme les séances depuis son téléphone. | Vue d'ensemble du groupe, taux de validation, retours qualitatifs, partage WhatsApp rapide. | Process lourd, multi-clics pour publier une séance. |

### 1.3 Problèmes adressés en 2026

| # | Problème | Impact | Chantier(s) |
|---|---|---|---|
| P1 | 50% des coureurs n'utilisent pas Strava → aucune donnée native dans l'app | Matching séance, palmarès auto, analyse IA, stats coach inopérants pour la moitié du club | [C1](#c1--refacto-multi-provider), [C2](#c2--coros-api-native), [C3](#c3--garmin-connect-partenariat--intégration), [C4](#c4--suunto-api-native) |
| P2 | Synchronisation Strava demande un clic manuel dans les réglages | Friction, oublis fréquents, perception "appli pas à jour" | [C5](#c5--sync-automatique-à-louverture) |
| P3 | Pas de preuve visuelle des séances faites hors data | Validation peu engageante pour Antoine, modération coach impossible | [C6](#c6--upload-photo--screenshot-validation) |
| P4 | Analyse de séance limitée à des chiffres bruts, pas de feedback qualitatif | Camille n'a pas son "verdict" auto, Antoine ne sait pas si sa séance était bonne | [C7](#c7--ia-claude--analyse-de-séance) |
| P5 | Partage des palmarès / séances coach se fait à la main hors app | Pas de viralité, coach doit recopier le programme dans WhatsApp | [C8](#c8--bridge-whatsapp--partage-social) |
| P6 | Antoine et Camille voient la même UI → l'un est noyé, l'autre frustré | Adoption inégale | [C9](#c9--ux-double-persona--simple-vs-data-friendly) |

### 1.4 Principes directeurs

1. **Mobile-first PWA**. Tout doit fonctionner sur iPhone/Android en mode debout, 1 main, gants en hiver.
2. **Performance > exhaustivité**. < 2s de boot, < 500ms d'interaction, données calculées côté serveur quand possible.
3. **Progressive disclosure**. Toujours montrer le minimum vital ; le détail s'ouvre à la demande.
4. **Tokens sémantiques only**. Jamais de hex ni de Tailwind couleur en dur. Voir `CLAUDE.md`.
5. **Coût IA maîtrisé**. Cap mensuel défini par chantier ; alertes Supabase si dépassement.
6. **Conformité RGPD**. OAuth uniquement (jamais de stockage de mots de passe constructeur), tokens chiffrés au repos, droit à l'oubli.
7. **Accessibilité AA**. Contrastes, focus visible, labels ARIA, navigation clavier.

---

## 2. État de l'existant

### 2.1 Stack technique (rappel)

| Couche | Techno | Version |
|---|---|---|
| Build | Vite | 7 |
| Framework | React | 19 (SPA, react-router-dom v7) |
| Langage | TypeScript (strict) | 5.x |
| UI | Tailwind CSS | 4 |
| Icônes | Lucide React | — |
| Backend | Supabase (Postgres + Auth + Edge Functions Deno) | — |
| Graphiques | Chart.js + react-chartjs-2 | — |
| Dates | date-fns | — |
| PWA | vite-plugin-pwa + Workbox | — |
| Déploiement | Vercel | — |

### 2.2 Intégration Strava — référence

L'intégration Strava est notre **modèle de référence** pour les futurs providers. Elle se compose de :

**Tables Postgres** (migration `20260317200000_strava_integration.sql`)

```sql
strava_connections (
  id, user_id, strava_athlete_id,
  access_token_encrypted, refresh_token_encrypted,
  token_expires_at, scope_granted,
  connected_at, is_active, updated_at
)

strava_activities (
  id, user_id, strava_activity_id,
  sport_type, name, distance_meters, moving_time_seconds,
  elapsed_time_seconds, average_speed, max_speed,
  average_heartrate, max_heartrate, average_cadence,
  total_elevation_gain, suffer_score, calories,
  device_name, start_date, start_date_local,
  matched_session_id, match_status, raw_payload, created_at
)
```

**Edge Functions Deno** (dans `supabase/functions/`)

- `strava-auth` — OAuth (exchange code, refresh token, disconnect)
- `strava-api` — Wrapper API Strava (status, athlete_stats, recent_activities, zones, sync)
- `strava-cron` — Job de synchronisation automatique (déclenché par cron Supabase)

**Hook React** : `src/hooks/useStrava.ts` (interface unifiée pour les composants).

**Matching séance** : fonction SQL dans `20260317220000_strava_match_functions.sql` qui rapproche `strava_activities.start_date_local` du `sessions.date` (tolérance horaire).

### 2.3 Schéma de données — tables existantes pertinentes

```
users                  ─ id, role (athlete|coach), firstname, lastname, vma, vma_history, ...
groups                 ─ id, name
sessions               ─ id, date, title, session_type, blocks (JSONB), target_distance, vma_percent_min/max
session_validations    ─ id, session_id, user_id, status, feedback,
                          attachment_path, attachment_type,         ← DÉJÀ présent
                          objective_reached, sensations
race_results           ─ id, user_id, race_name, race_type, distance_km, date, time_duration, is_label, comment
race_nordiks           ─ id, race_id, user_id
session_nordiks        ─ id, session_id, user_id
club_settings          ─ allure_zones, race_paces (JSONB)
session_templates      ─ id, name, category, session_type, blocks
notifications          ─ id, user_id, type, title, body, link, read
strava_connections     ─ (cf. 2.2)
strava_activities      ─ (cf. 2.2)
```

> **Note importante** : `session_validations.attachment_path` et `attachment_type` existent déjà. Le chantier C6 (upload photo) est donc partiellement câblé côté schéma — il reste à créer le bucket Supabase Storage et l'UI.

### 2.4 Gaps identifiés

| # | Gap | Conséquence |
|---|---|---|
| G1 | Modèle Strava 1:1 dur (table `strava_connections` plutôt qu'un `device_connections` générique) | Dupliquer 3 fois la plomberie pour Garmin, Coros, Suunto |
| G2 | Pas de sync au boot, uniquement bouton manuel ou cron quotidien | UX peu réactive |
| G3 | Storage bucket pour validations absent | Champ `attachment_path` orphelin |
| G4 | Pas d'intégration LLM | Pas d'analyse qualitative possible |
| G5 | Pas de génération d'images OG dynamiques | Pas de partage social avec preview riche |
| G6 | UI flat, pas de progressive disclosure | Cible mal Antoine et Camille simultanément |

---

## 3. Roadmap consolidée

### 3.1 Tableau de priorité

| # | Chantier | Effort | Pré-requis | Priorité | Démarrable |
|---|---|---|---|---|---|
| **C1** | Refacto multi-provider | 1 j | — | **P0** | Immédiat |
| **C2** | Coros API native | 1-2 sem | C1 | **P0** | Après C1 |
| **C3** | Garmin partenariat + intégration | 4-8 sem délai + 1 sem dev | Demande Garmin déposée | **P0** | Demande aujourd'hui, dev après approbation |
| **C5** | Sync auto à l'ouverture | 0,5 j | C1 | **P0** | Après C1 |
| **C6** | Upload photo / screenshot | 0,5 j | — | **P1** | Immédiat (parallèle de C1) |
| **C7** | IA Claude — analyse séance | 3-4 j | C1, idéalement C2 | **P1** | Après C2 |
| **C8** | Bridge WhatsApp | 2 j | C6 (pour les images OG), C7 (pour le texte analyse) | **P2** | Après C7 |
| **C4** | Suunto API native | 1 sem | C1 | **P2** | En finition |
| **C9** | UX double persona | 2-3 j (transverse) | Aucun bloquant, mais bénéfique après C7 | **P1** | En continu |

### 3.2 Dépendances (graphe simplifié)

```
C1 (refacto multi-provider)
 ├─→ C2 (Coros)
 │    └─→ C7 (IA Claude) ──→ C8 (WhatsApp)
 ├─→ C3 (Garmin) [après approbation partenariat]
 ├─→ C4 (Suunto)
 └─→ C5 (sync auto)

C6 (upload photo) ──→ C8 (WhatsApp images)

C9 (UX double persona) — transverse, en continu
```

### 3.3 Timeline indicative (best-case, hors aléas)

```
S22 (cette semaine) │ Dépôt candidature Garmin · Démarrage C1
S23                 │ C1 livré · Démarrage C2 (Coros) · C5 livré · C6 livré
S24-S25             │ C2 livré · Démarrage C7 (IA Claude)
S26-S27             │ C7 livré · Démarrage C8 (WhatsApp)
S28                 │ C8 livré · Démarrage C4 (Suunto)
S29-S30             │ C4 livré
S30+                │ Réception approbation Garmin (estimée) → développement C3 (1 sem)
En continu          │ C9 (UX double persona) appliquée progressivement
```

> **NB** : ces durées sont des estimations dev seul, sans inclure tests utilisateurs, QA approfondie, ni les éventuels retours du partenariat Garmin.

### 3.4 Budget IA mensuel estimé (chantier C7)

Hypothèse : 30 athlètes × 4 séances/sem × 4 sem = **480 analyses/mois**.

| Scénario | Modèle | Coût unitaire | Coût mensuel |
|---|---|---|---|
| Standard (par défaut) | Haiku 4.5 avec prompt caching | ~0,002 € | ~1 €/mois |
| Approfondi (à la demande) | Sonnet 4.6, 20% des analyses | ~0,03 € | ~3 €/mois |
| **Total estimé** | | | **~4-5 €/mois** |

Cap mensuel suggéré : **10 €/mois** (alerte Supabase + désactivation auto si dépassé).

---

## 4. Spec détaillée par chantier

---

### C1 — [ABANDONNÉ] Refacto multi-provider

#### Objectif & valeur
Remplacer le modèle Strava-spécifique par une abstraction `device_connections` / `device_activities` réutilisable pour tous les providers (Strava, Coros, Garmin, Suunto, Polar, etc.). Diviser par 3 l'effort de chaque future intégration.

#### Scope IN
- Création des tables génériques `device_connections` et `device_activities`.
- Migration des données existantes `strava_connections` → `device_connections` (provider='strava').
- Refacto des Edge Functions en mode "provider plug-in" (factorisation OAuth, sync, refresh).
- Hook React générique `useDeviceConnection(provider)` remplaçant `useStrava`.
- Compatibilité ascendante : les composants existants continuent de fonctionner.

#### Scope OUT
- Pas de nouvelle intégration provider dans ce chantier (C2/C3/C4 suivent).
- Pas de changement UI visible pour l'utilisateur.

#### Architecture cible

```
supabase/functions/
  _shared/                          ← nouveau dossier
    provider-interface.ts           ← interface ProviderAdapter
    encryption.ts                   ← chiffrement tokens (déjà existant, factorisé)
    matching.ts                     ← logique de matching activité ↔ session (généralisée)
  providers/
    strava.ts                       ← implémentation ProviderAdapter pour Strava
    coros.ts                        ← (C2)
    garmin.ts                       ← (C3)
    suunto.ts                       ← (C4)
  device-auth/                      ← remplace strava-auth (multi-provider)
  device-api/                       ← remplace strava-api
  device-cron/                      ← remplace strava-cron
```

#### Modèle de données

```sql
-- Migration: 20260524100000_multi_provider_refactor.sql

CREATE TYPE device_provider AS ENUM ('strava', 'coros', 'garmin', 'suunto', 'polar');

CREATE TABLE device_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  provider device_provider NOT NULL,
  provider_athlete_id TEXT NOT NULL,        -- string pour couvrir tous les providers
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,             -- NULL pour providers sans refresh
  token_expires_at TIMESTAMPTZ,
  scope_granted TEXT,
  provider_metadata JSONB DEFAULT '{}'::jsonb,  -- ex: webhook_id, push_endpoint
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE device_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  provider device_provider NOT NULL,
  provider_activity_id TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  name TEXT,
  distance_meters REAL,
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  average_speed REAL,
  max_speed REAL,
  average_heartrate REAL,
  max_heartrate REAL,
  average_cadence REAL,
  average_power REAL,                       -- running power (Coros, Stryd)
  normalized_power REAL,
  total_elevation_gain REAL,
  suffer_score REAL,                        -- Strava
  training_load REAL,                       -- Garmin / Coros
  recovery_time_hours INTEGER,              -- Garmin
  vo2max_estimate REAL,                     -- Garmin / Coros
  calories INTEGER,
  device_name TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  start_date_local TIMESTAMPTZ NOT NULL,
  matched_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('auto_matched', 'manual', 'unmatched')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, provider_activity_id)
);

CREATE INDEX idx_device_connections_user_provider ON device_connections(user_id, provider);
CREATE INDEX idx_device_activities_user ON device_activities(user_id);
CREATE INDEX idx_device_activities_date ON device_activities(start_date_local);
CREATE INDEX idx_device_activities_session ON device_activities(matched_session_id);

-- RLS identique au schéma Strava existant
ALTER TABLE device_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_activities ENABLE ROW LEVEL SECURITY;
-- ... (policies user_id=auth.uid() + coaches see all)

-- Vue de compatibilité ascendante
CREATE VIEW strava_connections AS
  SELECT * FROM device_connections WHERE provider = 'strava';
CREATE VIEW strava_activities AS
  SELECT * FROM device_activities WHERE provider = 'strava';
```

#### Surface API — interface ProviderAdapter

```typescript
// supabase/functions/_shared/provider-interface.ts

export interface ProviderAdapter {
  readonly name: 'strava' | 'coros' | 'garmin' | 'suunto' | 'polar';

  // OAuth
  buildAuthorizeUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ProviderTokens>;
  refreshTokens(refreshToken: string): Promise<ProviderTokens>;
  revoke(accessToken: string): Promise<void>;

  // Data fetch
  fetchAthleteProfile(accessToken: string): Promise<ProviderAthlete>;
  fetchRecentActivities(accessToken: string, since?: Date): Promise<NormalizedActivity[]>;
  fetchActivityDetail(accessToken: string, activityId: string): Promise<NormalizedActivity>;

  // Webhook (optionnel selon provider)
  registerWebhook?(accessToken: string, callbackUrl: string): Promise<string>;
  parseWebhookEvent?(payload: unknown): Promise<WebhookEvent>;
}

export interface NormalizedActivity {
  provider_activity_id: string;
  sport_type: string;
  name: string | null;
  distance_meters: number | null;
  moving_time_seconds: number | null;
  // ... tous les champs de device_activities
  raw_payload: unknown;
}
```

#### Hook React générique

```typescript
// src/hooks/useDeviceConnection.ts

type Provider = 'strava' | 'coros' | 'garmin' | 'suunto' | 'polar';

export function useDeviceConnection(provider: Provider, targetUserId?: string) {
  // Mêmes méthodes que useStrava actuel mais provider-aware
  // checkConnection, connect(code), disconnect, syncActivities, etc.
}

// Hook composite pour l'UI Profil
export function useAllDeviceConnections() {
  const strava = useDeviceConnection('strava');
  const coros = useDeviceConnection('coros');
  const garmin = useDeviceConnection('garmin');
  const suunto = useDeviceConnection('suunto');
  return { strava, coros, garmin, suunto };
}
```

#### UX (inchangée dans ce chantier)
Aucun changement visible. Le composant Profil continue d'afficher Strava ; les autres providers viendront dans C2/C3/C4.

#### Effort estimé
**1 journée** (refacto + migration + tests régression Strava).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Régression sur l'intégration Strava existante | Moyenne | Élevé | Vues SQL de compat + tests E2E avant merge + feature flag de rollback |
| Migration des tokens chiffrés casse | Faible | Élevé | Migration `INSERT INTO device_connections SELECT ... FROM strava_connections` testée sur branche Supabase |

#### Critères d'acceptation
- [ ] Tables `device_connections` et `device_activities` créées et peuplées avec les données Strava existantes.
- [ ] Vues `strava_connections` et `strava_activities` fonctionnelles (compat ascendante).
- [ ] Edge functions `device-auth`, `device-api`, `device-cron` opérationnelles pour Strava (parité fonctionnelle).
- [ ] Hook `useStrava` continue de fonctionner (utilise désormais `useDeviceConnection('strava')` en interne).
- [ ] Aucune régression UI signalée.

#### KPIs
- Temps moyen pour ajouter un nouveau provider après refacto : < 5 jours dev.

---

### C2 — [ABANDONNÉ] Coros API native

#### Objectif & valeur
Permettre aux athlètes utilisateurs de Coros (Apex, Pace, Vertix...) de connecter leur compte directement à Narbo Nordik, sans passer par Strava. Couvre ~25% du club selon l'estimation actuelle.

#### Scope IN
- Implémentation de `ProviderAdapter` Coros (OAuth + fetch activités).
- UI Profil → bouton "Connecter Coros" + statut + déconnexion.
- Page callback `/coros/callback`.
- Synchronisation auto via `device-cron` (toutes les heures pour les utilisateurs connectés).
- Mapping running power et training load (champs spécifiques Coros).
- Webhook Coros pour push instantané des activités (si dispo selon Coros API).

#### Scope OUT
- Pas de mapping des plans d'entraînement Coros (lecture seule activités).
- Pas de support des activités multi-sport composées.

#### Pré-requis
- Compte développeur Coros (`https://opendev.coros.com`) — création gratuite, self-service.
- Client ID + Client Secret obtenus dans le dashboard Coros.
- Redirect URI déclarée dans le dashboard Coros : `https://[app-domain]/coros/callback`.
- Secrets ajoutés à Supabase : `COROS_CLIENT_ID`, `COROS_CLIENT_SECRET`.

#### Architecture

```
supabase/functions/providers/coros.ts        ← implémente ProviderAdapter
src/pages/CorosCallback.tsx                  ← analogue StravaCallback
src/components/devices/                      ← nouveau dossier
  DeviceConnectionsPanel.tsx                 ← panneau unifié Strava + Coros + Garmin + Suunto
```

#### Endpoints Coros utilisés

| Endpoint | Usage |
|---|---|
| `POST /oauth2/accesstoken` | OAuth exchange + refresh |
| `GET /v2/coros/sport/list` | Liste des activités de l'utilisateur |
| `GET /v2/coros/sport/detail/query` | Détail d'une activité |
| `POST /v2/coros/webhook/register` | Enregistrement webhook (push activités) |

#### Mapping champs Coros → `device_activities`

| Coros field | NarboNordik field | Notes |
|---|---|---|
| `mode` | `sport_type` | running, trail, cycling, etc. |
| `distance` (en mètres) | `distance_meters` | direct |
| `duration` (sec) | `moving_time_seconds` | direct |
| `avgPower` | `average_power` | running power (nouveauté vs Strava) |
| `avgHr` | `average_heartrate` | direct |
| `maxHr` | `max_heartrate` | direct |
| `avgSpeed` | `average_speed` | direct |
| `trainingLoad` | `training_load` | spécifique Coros |
| `vo2max` | `vo2max_estimate` | spécifique Coros |
| `startTime` | `start_date` / `start_date_local` | ISO 8601 |
| `device` | `device_name` | ex: "COROS APEX 2 Pro" |

#### UX

**Profil athlète → onglet "Mes appareils"** :
```
┌────────────────────────────────────────┐
│  Mes appareils                         │
│                                        │
│  [icône Strava]   Strava               │
│  Connecté · dernière sync il y a 5min  │
│                          [Déconnecter] │
│                                        │
│  [icône Coros]    Coros                │
│  Non connecté                          │
│                          [Connecter →] │
│                                        │
│  [icône Garmin]   Garmin Connect       │
│  Bientôt disponible                    │
│                                        │
│  [icône Suunto]   Suunto               │
│  Non connecté                          │
│                          [Connecter →] │
└────────────────────────────────────────┘
```

#### Effort estimé
**1 à 2 semaines** (incluant la création du compte développeur Coros, la lecture de la doc, l'implémentation, les tests sur 2-3 athlètes pilotes).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| API Coros moins documentée que Strava, edge cases | Moyenne | Moyen | Tests sur 3 athlètes pilotes avant rollout club |
| Rate limit Coros plus strict | Faible | Moyen | Throttling côté Edge Function + cache 5 min |
| Webhook non dispo dans tier gratuit | Moyenne | Faible | Fallback sur sync polling (toutes les heures) |

#### Critères d'acceptation
- [ ] Un athlète peut connecter son compte Coros en moins de 3 clics depuis le profil.
- [ ] Les activités Coros remontent dans la liste unifiée d'activités.
- [ ] Matching auto séance ↔ activité Coros fonctionnel.
- [ ] Déconnexion révoque proprement le token chez Coros.
- [ ] Token refresh automatique avant expiration.

#### KPIs
- % d'athlètes Coros connectés / total athlètes Coros déclarés : > 60% à 1 mois.
- Latence sync moyenne : < 30s après fin d'activité (avec webhook) ou < 1h (polling).

---

### C3 — [ABANDONNÉ] Garmin Connect (partenariat + intégration)

#### Objectif & valeur
Couvrir la part dominante des coureurs équipés Garmin (~50% du club) qui n'utilisent pas Strava. Permet d'ingérer les activités, la VO2max, le training load, les zones FC.

#### Scope IN
- Dépôt de candidature au **Garmin Connect Developer Program** (Health API + Activity API).
- Une fois approuvé : implémentation `ProviderAdapter` Garmin (OAuth 1.0a + Push Service).
- UI Profil → bouton "Connecter Garmin".
- Push Service Garmin → endpoint webhook Supabase qui reçoit les activités en temps réel.

#### Scope OUT
- Pas de Connect IQ App (au-delà du périmètre cloud).
- Pas de support FIT file direct upload (uniquement via API).

#### Pré-requis & déblocage
**Étape 1 (immédiate)** : Déposer la candidature. Voir [Annexe A1](#a1--brief-de-candidature-garmin-developer-program) pour le brief prêt à copier-coller.

**Étape 2 (après approbation, 4-8 sem typique)** :
- Réception des clés OAuth 1.0a (Consumer Key + Consumer Secret).
- Provisioning du Push Service (URL callback à configurer).
- Secrets Supabase : `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`.

#### Architecture

OAuth 1.0a (différent de OAuth 2.0 utilisé par Strava/Coros) :

```
1. App → Garmin: Request Token   (GET https://connectapi.garmin.com/oauth-service/oauth/request_token)
2. User → Garmin authorize page  (https://connect.garmin.com/oauthConfirm)
3. Garmin → App: callback avec oauth_token + oauth_verifier
4. App → Garmin: Access Token    (GET .../oauth/access_token)
5. App stocke (access_token, access_token_secret) — pas d'expiration sur Garmin
```

Push Service :
```
Garmin → POST https://[supabase-url]/functions/v1/garmin-webhook
Body: { activities: [{ summaryId, activityId, ... }] }
```

#### Modèle de données complémentaire

Aucune nouvelle table — les champs Garmin spécifiques (`vo2max_estimate`, `recovery_time_hours`, `training_load`) sont déjà prévus dans `device_activities` (voir [C1](#c1--refacto-multi-provider)).

#### UX
Identique à Coros (cf. [C2](#c2--coros-api-native)). Une carte "Garmin Connect" dans le panneau Mes appareils.

#### Effort estimé
- **Démarche partenariat** : 1-2h pour préparer et soumettre, puis 4-8 semaines de délai.
- **Développement** : 1 semaine une fois les clés reçues.

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Candidature refusée par Garmin (volumes faibles, app club) | Moyenne | Très élevé | Préparer dossier soigné (cf. A1), mettre en avant le caractère associatif + nombre d'utilisateurs réel + cas d'usage entraînement |
| Délai partenariat plus long que prévu | Élevée | Moyen | Démarrer C2/C4/C5/C6/C7 en parallèle pour ne pas bloquer |
| OAuth 1.0a complexe à implémenter | Faible | Faible | Bibliothèque Deno `oauth-1.0a` éprouvée |

#### Critères d'acceptation
- [ ] Candidature déposée avec confirmation reçue.
- [ ] (Post-approbation) Athlète peut connecter Garmin en < 3 clics.
- [ ] Push Service reçoit les activités sous 60s après fin de séance.
- [ ] VO2max, training load, recovery time correctement mappés.

#### KPIs
- Délai entre fin d'activité (montre) et apparition dans l'app : médian < 2 min.
- % d'athlètes Garmin connectés à 2 mois post-mise en ligne : > 50%.

---

### C4 — [ABANDONNÉ] Suunto API native

#### Objectif & valeur
Couvrir la minorité d'athlètes Suunto du club. Faible volume mais coût d'implémentation modéré grâce à la structure multi-provider de [C1](#c1--refacto-multi-provider).

#### Scope IN
- `ProviderAdapter` Suunto (OAuth 2.0).
- UI Profil → bouton "Connecter Suunto".
- Sync polling (Suunto webhook nécessite des permissions supplémentaires non urgentes).

#### Scope OUT
- Pas de Suunto App SDK (au-delà du cloud).

#### Pré-requis
- Compte développeur Suunto sur `https://www.suunto.com/partners/suuntoapp-for-developers/`.
- Client ID + Secret + redirect URI déclarée.
- Secrets Supabase : `SUUNTO_CLIENT_ID`, `SUUNTO_CLIENT_SECRET`.

#### Endpoints Suunto utilisés

| Endpoint | Usage |
|---|---|
| `https://cloudapi-oauth.suunto.com/oauth/token` | OAuth |
| `https://cloudapi.suunto.com/v2/workouts` | Liste workouts |
| `https://cloudapi.suunto.com/v2/workout/{id}` | Détail workout |

#### Effort estimé
**1 semaine** (similaire à Coros mais sans webhook).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Faible base utilisateurs → peu de tests réels | Moyenne | Faible | OK, low priority |

#### Critères d'acceptation
Identiques à Coros, transposés Suunto.

---

### C5 — [ABANDONNÉ] Sync automatique à l'ouverture

#### Objectif & valeur
Supprimer la friction "aller dans les réglages → cliquer actualiser". L'utilisateur ouvre l'app → ses séances du jour sont déjà là.

#### Scope IN
- Hook `useAutoSync()` déclenché au montage de `DataProvider` quand l'utilisateur est authentifié.
- Sync de **tous les providers connectés** en parallèle.
- Throttling : skip si dernière sync < 15 min.
- Skip si offline (`navigator.onLine === false`).
- Skip si onglet en background (`document.visibilityState === 'hidden'`).
- Toast discret : "Synchronisation..." → "2 nouvelles activités" ou silent si rien de nouveau.
- Garder le bouton manuel "Actualiser" dans le profil pour les cas edge (override throttle).

#### Scope OUT
- Pas de polling continu pendant la session (un seul sync au boot suffit).
- Pas de service worker background sync (PWA limitations iOS).

#### Architecture

```typescript
// src/hooks/useAutoSync.ts

export function useAutoSync() {
  const { user } = useAuth();
  const { strava, coros, garmin, suunto } = useAllDeviceConnections();
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    if (!navigator.onLine) return;
    if (document.visibilityState === 'hidden') return;

    const last = localStorage.getItem(`autoSync:${user.id}`);
    const lastDate = last ? new Date(last) : null;
    if (lastDate && Date.now() - lastDate.getTime() < 15 * 60 * 1000) return;

    const providers = [strava, coros, garmin, suunto].filter(p => p.connected);
    if (providers.length === 0) return;

    (async () => {
      toast.info('Synchronisation en cours...', { duration: 2000 });
      const results = await Promise.allSettled(
        providers.map(p => p.syncActivities())
      );
      const newCount = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);

      if (newCount > 0) {
        toast.success(`${newCount} nouvelle${newCount > 1 ? 's' : ''} activité${newCount > 1 ? 's' : ''}`);
      }
      localStorage.setItem(`autoSync:${user.id}`, new Date().toISOString());
    })();
  }, [user?.id]);
}
```

Intégration dans `DataContext.tsx` :
```typescript
function DataProvider({ children }) {
  useAutoSync();
  // ... reste du provider
}
```

#### UX

- **Cas 1** : 1ère ouverture du jour, 2 nouvelles activités → toast "Synchronisation..." (1s) puis "2 nouvelles activités" (3s).
- **Cas 2** : Réouverture < 15 min → rien (silent).
- **Cas 3** : Offline → rien, mais OfflineIndicator existant prend le relais.
- **Cas 4** : Aucun provider connecté → rien.

#### Effort estimé
**½ journée** (hook + intégration + tests).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Surcharge API providers si app très utilisée | Faible | Faible | Throttle 15 min + skip si offline/background |
| Toast intrusif | Moyenne | Faible | Durée 2-3s max, dismissable, jamais bloquant |

#### Critères d'acceptation
- [ ] Ouvrir l'app après >15 min d'absence déclenche un sync silencieux automatique.
- [ ] Le toast n'apparaît que s'il y a du nouveau ou si l'utilisateur le déclenche manuellement.
- [ ] Aucun sync ne se déclenche si offline ou en background tab.
- [ ] Le bouton "Actualiser" du profil reste fonctionnel et bypasse le throttle.

#### KPIs
- % d'ouvertures app suivies d'un sync auto réussi : > 95%.
- Temps moyen sync auto : < 5s.

---

### C6 — [LIVRÉ] Upload photo / screenshot validation

#### Objectif & valeur
Permettre aux athlètes (notamment Antoine, persona simple) de joindre une preuve visuelle à leur validation : screenshot de leur montre, photo du parcours, capture Strava si pas connecté.

**Bonne nouvelle** : la table `session_validations` contient déjà `attachment_path` et `attachment_type`. Schéma prêt, il manque le bucket et l'UI.

#### Scope IN
- Création du bucket Supabase Storage `session-proofs` (privé, RLS par `user_id`).
- Composant `ValidationPhotoUploader` avec compression côté client.
- Affichage thumbnail dans la fiche validation (athlète + coach).
- Lightbox plein écran au clic.
- Suppression possible par l'auteur (et le coach).
- Visibilité par défaut : **coach + auteur uniquement**. Toggle "Visible par le club" en option.

#### Scope OUT
- Pas de multi-photos (1 photo par validation).
- Pas de retouche / annotation.
- Pas de OCR (le screenshot n'est pas parsé pour extraire les data).

#### Architecture

**Storage bucket** :
```sql
-- Storage migration
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-proofs', 'session-proofs', false);

-- Policies
CREATE POLICY "Users upload own proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Coaches read all proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-proofs' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach')
  );

CREATE POLICY "Users delete own proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

Chemins : `session-proofs/{user_id}/{validation_id}.{ext}` — un dossier par utilisateur, fichier nommé par validation.

#### Composant React

```typescript
// src/components/validation/ValidationPhotoUploader.tsx

import imageCompression from 'browser-image-compression';

export function ValidationPhotoUploader({
  validationId,
  currentPath,
  onChange,
}: Props) {
  async function handleFile(file: File) {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
    const ext = compressed.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${validationId}.${ext}`;
    const { error } = await supabase.storage
      .from('session-proofs')
      .upload(path, compressed, { upsert: true });
    if (error) { toast.error('Upload échoué'); return; }
    await supabase
      .from('session_validations')
      .update({ attachment_path: path, attachment_type: compressed.type })
      .eq('id', validationId);
    onChange(path);
  }
  // ... UI: drop zone + camera input mobile + preview
}
```

Dependency à ajouter : `browser-image-compression` (~10KB).

#### UX

**Fiche validation athlète** :
```
✓ Séance validée
─────────────────────────────────────
[Ressenti: 😀 Bonnes sensations]
[Objectif: ✓ Atteint]
[Texte: "Bonne séance, jambes lourdes au 3e"]

📷 Joindre une photo
   [Bouton: Prendre une photo / Choisir un fichier]
```

Après upload :
```
📷 Ma preuve
   [Thumbnail 80x80]  [👁 Voir] [🗑 Supprimer]
   □ Visible par le club
```

#### Effort estimé
**½ journée** (bucket + composant + intégration validation + tests).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Fichiers trop lourds | Élevée | Moyen | Compression client obligatoire (max 1 MB, 1920px) |
| Photos sensibles partagées au club | Moyenne | Élevé | Default privé (coach + auteur) ; opt-in club explicite |
| Bucket non purgé après suppression validation | Moyenne | Faible | Trigger SQL `BEFORE DELETE ON session_validations` qui supprime le fichier storage |

#### Critères d'acceptation
- [ ] Bucket `session-proofs` créé avec RLS appropriées.
- [ ] Athlète peut uploader une photo à sa validation (caméra ou fichier).
- [ ] Photo compressée à < 1 MB avant upload.
- [ ] Coach voit la photo dans la fiche athlète.
- [ ] Athlète peut supprimer sa photo.
- [ ] Suppression de la validation purge le fichier.

#### KPIs
- % de validations avec photo : à mesurer après 1 mois (cible : >20%).
- Temps moyen upload : < 5s sur 4G.

---

### C7 — [LIVRÉ MISTRAL] IA Claude : analyse de séance

#### Objectif & valeur
Offrir un feedback qualitatif automatisé à chaque validation de séance, en croisant : plan coach, données de la montre, ressenti athlète, historique. Plus utile que des chiffres bruts.

#### Scope IN
- Edge Function `analyze-session` qui prend un `session_validation_id` et renvoie une analyse structurée.
- Modèle par défaut : **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).
- Modèle avancé à la demande : **Claude Sonnet 4.6** (`claude-sonnet-4-6`) — bouton "Analyse détaillée".
- **Prompt caching** sur le contexte stable (zones FC, VMA, historique 30j résumé).
- Stockage du résultat dans une nouvelle table `session_analyses` (cache, évite les re-paiements).
- Affichage UX double persona (cf. [C9](#c9--ux-double-persona--simple-vs-data-friendly)).
- Cap mensuel de coût et alerte Supabase.

#### Scope OUT
- Pas d'analyse temps réel pendant la séance (post-validation seulement).
- Pas de chatbot conversationnel (analyse one-shot uniquement, mais à voir en V2).
- Pas de génération vocale (texte uniquement).

#### Architecture

```
supabase/functions/
  analyze-session/
    index.ts             ← endpoint principal
    prompts.ts           ← templates de prompt
    schemas.ts           ← Zod schema du JSON retourné par Claude

src/hooks/useSessionAnalysis.ts
src/components/validation/AnalysisCard.tsx  ← UI résumé + accordéon
```

#### Modèle de données

```sql
-- Migration: 20260601100000_session_analyses.sql

CREATE TABLE session_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id UUID REFERENCES session_validations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  model TEXT NOT NULL,                 -- 'haiku-4.5' ou 'sonnet-4.6'
  verdict TEXT NOT NULL,               -- résumé court (1 phrase)
  emoji TEXT,                          -- 🎯 / 🔥 / 🌊 / ⚠️
  points_forts JSONB DEFAULT '[]',     -- string[]
  points_attention JSONB DEFAULT '[]', -- string[]
  recommandation TEXT,                 -- prochaine séance
  detailed_analysis TEXT,              -- markdown long (mode détaillé)
  input_tokens INTEGER,
  output_tokens INTEGER,
  cached_tokens INTEGER,
  cost_eur NUMERIC(10,6),
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_session_analyses_validation ON session_analyses(validation_id);

ALTER TABLE session_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own analyses"
  ON session_analyses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM session_validations sv
    WHERE sv.id = validation_id AND sv.user_id = auth.uid()
  ));

CREATE POLICY "Coaches read all analyses"
  ON session_analyses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'coach'));
```

#### Structure du prompt (avec caching)

**Partie cachable** (réutilisée pour toutes les analyses d'un athlète, ~1500 tokens) :
```
Tu es un coach assistant pour le club Narbo Nordik (running/trail).
Ton rôle est d'analyser la séance d'un athlète en croisant son ressenti,
les données de sa montre et le plan proposé par son coach.

CONTEXTE ATHLÈTE :
- Prénom : {firstname}
- VMA actuelle : {vma} km/h (mise à jour {vma_date})
- Historique VMA : {vma_history}
- Zones d'allure du club :
  • EF : 60-70% VMA
  • SV1 : 75-82% VMA
  • SV2 : 85-90% VMA
  • VMA : 95-105% VMA
  ... (depuis club_settings)
- 5 dernières séances (résumé) :
  {recent_sessions_summary}

PRINCIPES DE COACHING :
- Toujours bienveillant, tutoiement de rigueur.
- Vocabulaire technique mais accessible (ex: "ta FC moyenne en zone 2" plutôt que "ton lactate threshold").
- Pointer 1-2 points forts ET 1-2 points d'attention max.
- Recommandation prochaine séance : courte (1 phrase), actionnable.

FORMAT DE RÉPONSE : JSON strict suivant ce schéma :
{ verdict, emoji, points_forts[], points_attention[], recommandation, detailed_analysis }
```

**Partie variable** (par séance, ~500-1500 tokens) :
```
SÉANCE DU JOUR :
- Date : {date}
- Titre : {title}
- Type : {session_type}
- Plan proposé par le coach :
  {blocks_formatted}
- Cible : {target_distance}m à {vma_percent_min}-{vma_percent_max}% VMA

DONNÉES MONTRE ({provider}) :
- Distance : {distance_km} km
- Durée : {duration}
- Allure moyenne : {pace_avg}/km
- FC moyenne / max : {hr_avg} / {hr_max} bpm
- Dénivelé : {elevation}m
- Running power : {power_avg}W
{si Garmin: - Training load : {training_load}}
{si Coros: - VO2max estimé : {vo2max}}

RESSENTI ATHLÈTE :
- Objectif atteint : {objective_reached}
- Sensations : {sensations}
- Commentaire : {feedback}

Analyse cette séance et renvoie le JSON.
```

#### Schéma de sortie attendu

```typescript
const analysisSchema = z.object({
  verdict: z.string().max(140),           // 1 phrase
  emoji: z.string().max(4),
  points_forts: z.array(z.string()).max(2),
  points_attention: z.array(z.string()).max(2),
  recommandation: z.string().max(280),
  detailed_analysis: z.string(),          // markdown, mode Camille
});
```

#### Edge Function (squelette)

```typescript
// supabase/functions/analyze-session/index.ts
import Anthropic from 'npm:@anthropic-ai/sdk';

Deno.serve(async (req) => {
  const { validation_id, mode = 'standard' } = await req.json();

  // 1. Charge le contexte
  const ctx = await loadContext(validation_id);

  // 2. Cache hit ?
  const cached = await loadAnalysis(validation_id);
  if (cached && cached.model === modelFor(mode)) {
    return Response.json(cached);
  }

  // 3. Appel Claude avec prompt caching
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const model = mode === 'detailed'
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001';

  const message = await client.messages.create({
    model,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: buildCachedSystem(ctx.user, ctx.history),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: buildVariablePart(ctx.session, ctx.activity, ctx.validation) },
    ],
  });

  // 4. Parse + valide
  const parsed = analysisSchema.parse(JSON.parse(message.content[0].text));

  // 5. Stocke + calcule coût
  const cost = computeCost(message.usage, model);
  await saveAnalysis(validation_id, parsed, message.usage, cost, model);

  // 6. Check cap mensuel
  await checkMonthlyCap();

  return Response.json(parsed);
});
```

#### UX

**Vue par défaut (Antoine, mode simple)** :
```
✓ Séance validée

🎯 Belle séance, tu as bien tenu ton allure VMA !

💪 Points forts
  • FC moyenne pile dans la cible
  • Régularité sur les fractions

⚠️ À surveiller
  • Récup un peu trop courte sur le 4e bloc

📌 Prochaine séance
  Bois plus en début d'effort, ça t'évitera la dérive cardiaque.

[Voir l'analyse détaillée ▼]
```

**Vue détaillée (Camille, accordéon ouvert)** :
```
[Tout ce qui précède]

▾ Analyse détaillée
─────────────────────────────────────
Sur cette séance VMA courte (10×400m), tu as réalisé...
[paragraphe markdown généré par Sonnet 4.6 sur demande]

Comparaison avec plan :
| Bloc | Plan       | Réalisé    | Écart |
| 1    | 1:30/400m  | 1:28/400m  | -2s ✓ |
| 2    | 1:30/400m  | 1:29/400m  | -1s ✓ |
...

Dérive cardiaque : +4 bpm entre 1er et dernier bloc (acceptable < 5).
Power profile : pic à 320W sur le bloc 7, en zone neuromusculaire.
```

#### Coûts (rappel détaillé)

Prix Claude Haiku 4.5 (estimation 2026) :
- Input non cached : $0.80 / M tokens
- Input cached (read) : $0.08 / M tokens (90% off)
- Output : $4 / M tokens

Une analyse standard :
- ~1500 tokens cached (système athlète) → $0.000120
- ~700 tokens non-cached (séance) → $0.000560
- ~400 tokens output → $0.001600
- **Total : ~$0.0023 ≈ 0,002 €**

Analyse détaillée Sonnet 4.6 (~10x) : **~0,02 €**.

Pour 480 analyses/mois (30 ath × 4/sem × 4 sem) :
- 80% standard (Haiku) : ~0,80 €
- 20% détaillée (Sonnet) : ~2 €
- **Total mensuel : ~3 €** (très soutenable)

#### Garde-fous coût

```typescript
// Cap mensuel checké à chaque appel
async function checkMonthlyCap() {
  const { data } = await supabase
    .from('session_analyses')
    .select('cost_eur')
    .gte('generated_at', startOfMonth());
  const total = data?.reduce((s, r) => s + (r.cost_eur || 0), 0) || 0;
  if (total > MONTHLY_CAP_EUR) {
    throw new Error('Monthly cap reached');
  }
  if (total > MONTHLY_CAP_EUR * 0.8) {
    notifyAdmin('IA budget at 80%');
  }
}
```

#### Effort estimé
**3-4 jours** (Edge Function + prompts + UX + tests + monitoring coût).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Claude hallucine sur la donnée | Moyenne | Moyen | Schéma JSON strict + validation Zod + fallback "Analyse non disponible" |
| Coût dérape | Faible | Élevé | Cap mensuel hard + alerte 80% + Haiku par défaut |
| Latence > 5s | Moyenne | Moyen | Génération async + spinner discret, pas bloquant pour valider |
| Athlète sans data device → analyse pauvre | Élevée | Faible | Adapter le prompt : si pas de data device, focus sur ressenti et plan |

#### Critères d'acceptation
- [ ] Après validation, l'analyse apparaît en < 8s (Haiku).
- [ ] L'analyse est rejouée à partir du cache si rien n'a changé.
- [ ] Cap mensuel respecté, alerte à 80%.
- [ ] Schéma de sortie validé, jamais d'erreur de parsing en prod.
- [ ] Mode détaillé (Sonnet) disponible derrière un bouton.

#### KPIs
- % d'analyses générées avec succès / validations : > 95%.
- Satisfaction athlète (1 question post-analyse "Utile ?" 1-5) : moyenne > 3.5.
- Coût mensuel : < 10 €.

---

### C8 — [LIVRÉ] Bridge WhatsApp : partage social

#### Objectif & valeur
Permettre au coach de partager une séance programmée dans le groupe WhatsApp du club, et aux athlètes de partager leur palmarès ou leur séance validée sur WhatsApp.

**Contrainte technique** : il n'existe **pas d'API publique pour poster dans un groupe WhatsApp**. La WhatsApp Business Cloud API ne gère que les conversations 1:1 ou broadcasts opt-in, pas les groupes. Donc on utilise des deeplinks `whatsapp://` + image OG dynamique.

#### Scope IN
- Bouton "Partager sur WhatsApp" sur :
  - Fiche séance coach (programme du jour).
  - Fiche palmarès athlète (course terminée).
  - Fiche validation séance athlète (analyse IA en bonus).
- Génération d'une **image OG** dynamique via Edge Function (PNG composé serveur-side).
- Texte prérempli + URL deeplink `whatsapp://send?text=...`.
- Sur desktop, fallback `wa.me`.
- L'utilisateur choisit lui-même le groupe (pas d'auto-posting).

#### Scope OUT
- Pas d'envoi automatique (impossible techniquement et indésirable).
- Pas de WhatsApp Business API (coût élevé, complexité auth, et inutile pour ce use case).
- Pas de partage Telegram / Signal / Twitter (extension future).

#### Architecture

**Edge Function `share-card`** — génère un PNG :

```typescript
// supabase/functions/share-card/index.ts

import { ImageResponse } from 'jsr:@vercel/og';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type'); // 'session' | 'palmares' | 'analysis'
  const id = url.searchParams.get('id');

  const data = await loadDataFor(type, id);

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '60px',
          fontFamily: 'Inter',
        },
        children: [
          /* Logo Narbo Nordik */
          /* Titre selon type */
          /* Contenu principal (titre séance, distance, allure...) */
          /* Footer avec lien app */
        ],
      },
    },
    { width: 1200, height: 630 }
  );
});
```

**Composant React** :

```typescript
// src/components/share/ShareWhatsAppButton.tsx

export function ShareWhatsAppButton({ type, id, summary }: Props) {
  function handleShare() {
    const imageUrl = `${SUPABASE_URL}/functions/v1/share-card?type=${type}&id=${id}`;
    const appUrl = `${APP_URL}/${type}/${id}`;
    const text = `${summary}\n\n${appUrl}`;

    // iOS / Android natif
    if (isMobile()) {
      // Web Share API si supporté (image + texte)
      if (navigator.share && navigator.canShare?.({ files: [/* fetched image */] })) {
        shareWithImage(imageUrl, text);
      } else {
        window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
      }
    } else {
      // Desktop
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }
  return <Button onClick={handleShare}>Partager sur WhatsApp</Button>;
}
```

#### Templates de cards (3 types)

**Type 1 : Programme coach** (1200×630)
```
┌──────────────────────────────────────┐
│  [Logo Narbo Nordik]    NARBO NORDIK │
│                                       │
│  📅 MARDI 27 MAI · 18h30             │
│                                       │
│  10x400m VMA                          │
│  Stade des Arènes                     │
│                                       │
│  Échauffement + 10×400m à 105% VMA   │
│  R: 1' (jogging)                      │
│                                       │
│  ─────────────────────────            │
│  app.narbo-nordik.fr                  │
└──────────────────────────────────────┘
```

**Type 2 : Palmarès athlète** (1200×630)
```
┌──────────────────────────────────────┐
│  [Photo athlète]      NARBO NORDIK   │
│                                       │
│  🏆 NOUVEAU RECORD                   │
│                                       │
│  Marathon de Toulouse                 │
│  3h 12' 45"                           │
│                                       │
│  Camille D. · 42,2 km                 │
│  ─────────────────────────            │
│  Bravo ! Rejoignez le club           │
│  app.narbo-nordik.fr                  │
└──────────────────────────────────────┘
```

**Type 3 : Analyse séance IA** (1200×630)
```
┌──────────────────────────────────────┐
│                       NARBO NORDIK   │
│                                       │
│  ✅ SÉANCE VALIDÉE                   │
│                                       │
│  🎯 "Belle séance VMA"               │
│                                       │
│  10×400m · 12,3 km                    │
│  Allure 4'05/km · FC moy 168          │
│                                       │
│  ─────────────────────────            │
│  app.narbo-nordik.fr                  │
└──────────────────────────────────────┘
```

#### UX

Bouton placement :
- **Coach** : dans `SessionEditor`, après création/modification, bouton "Publier sur WhatsApp" en plus du Save.
- **Athlète palmarès** : sur la page Palmarès, bouton de partage à côté de chaque résultat.
- **Athlète validation** : après réception de l'analyse IA, CTA discret "Partager sur WhatsApp" sous l'analyse.

#### Effort estimé
**2 jours** (Edge Function génération image + 3 composants partage + tests sur iOS / Android / desktop).

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Web Share API capricieux sur iOS | Élevée | Faible | Fallback `whatsapp://send?text=...` toujours dispo |
| Image trop lourde (>500 KB) | Moyenne | Moyen | ImageResponse compressée WebP, CDN cache 1h |
| L'utilisateur ne sait pas quel groupe choisir | Faible | Faible | L'OS gère ça nativement, pas notre problème |

#### Critères d'acceptation
- [ ] Coach peut partager une séance vers WhatsApp en 2 clics.
- [ ] L'image preview apparaît correctement dans WhatsApp.
- [ ] Le lien dans le texte ouvre l'app/site Narbo Nordik.
- [ ] Fonctionne iOS + Android + desktop (avec fallback `wa.me`).

#### KPIs
- Nb de partages WhatsApp / semaine (instrumenté côté Edge Function via hit sur `share-card`).
- Taux de clic sur les liens partagés (Vercel Analytics).

---

### C9 — [LIVRÉ] UX double persona : simple vs data-friendly

#### Objectif & valeur
Faire en sorte qu'Antoine (simple) ne soit pas noyé et Camille (data-friendly) ne soit pas frustrée, **sans toggle de mode** (les users simples ne le trouveront jamais).

Approche : **progressive disclosure** systématique. Toujours montrer le minimum vital ; le détail s'ouvre à la demande.

#### Scope IN
- Audit des écrans clés et refonte progressive selon le pattern "résumé + accordéon".
- Composant `<Disclosure>` réutilisable.
- Écrans prioritaires :
  1. Fiche séance (vue athlète) → résumé en haut, blocks détaillés en accordéon.
  2. Validation post-séance → analyse résumé + détaillée (cf. [C7](#c7--ia-claude--analyse-de-séance)).
  3. Profil athlète → stats clés visibles, charts/historique en accordéon.
  4. Suivi → vue calendrier simple, courbes détaillées en accordéon.
- Adaptation des composants existants progressivement.

#### Scope OUT
- Pas de mode/thème "expert" toggleable.
- Pas de refonte visuelle complète, juste hiérarchisation.
- Pas de personnalisation par utilisateur (l'app s'adapte automatiquement).

#### Principes de design

1. **Résumé en haut, détails en bas** : la première vue d'un écran montre toujours ≤ 5 informations clés.
2. **Accordéons par défaut fermés** : "Voir les détails ▼" plutôt qu'un onglet ou un toggle.
3. **Pas de jargon dans la vue résumé** : "Bonne séance" plutôt que "RPE 7, TSS 65, dérive cardiaque 4 bpm".
4. **Chiffres avec contexte** : "168 bpm (dans ta zone 2)" plutôt que "168 bpm".
5. **Charts seulement dans les accordéons** : Antoine voit jamais un graphe, Camille les déplie.
6. **Une CTA principale par écran** : pas de boutons en compétition.

#### Composant `<Disclosure>`

```typescript
// src/components/ui/Disclosure.tsx

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  label = 'Voir les détails',
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-neutral-200 pt-3 mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
        aria-expanded={open}
      >
        {open ? <ChevronUp /> : <ChevronDown />}
        {open ? 'Masquer' : label}
      </button>
      {open && <div className="mt-3 animate-fade-in">{children}</div>}
    </div>
  );
}
```

#### Refonte écran par écran (exemples)

**SessionDetail (athlète) — actuel** :
```
[Titre + date]
[Description]
[Blocks détaillés en liste]
[Cible distance + VMA %]
[Bouton Valider]
```

**SessionDetail — V2** :
```
[Titre + date]
[Pictogramme type séance + 1 phrase de description]
[CTA: Valider la séance]
─── Voir les détails ▼ ───
  [Blocks détaillés]
  [Cible distance + VMA %]
  [Description complète]
  [Lieu + carte]
```

**Profil athlète — actuel** :
```
[Photo + nom]
[VMA + historique]
[Liste palmarès]
[Graph progression]
[Liste activités]
```

**Profil — V2** :
```
[Photo + nom + VMA actuelle (gros chiffre)]
[Tabs: Vue d'ensemble | Palmarès | Activités]

Vue d'ensemble :
  [3 stats clés : VMA, séances ce mois, distance ce mois]
  [Prochaine séance]
  ─── Mes graphiques ▼ ───
    [Charts progression VMA + volume]
  ─── Mes appareils ▼ ───
    [Strava / Coros / Garmin / Suunto]
```

#### Effort estimé
**2-3 jours** (audit + composant Disclosure + refonte des 4 écrans prioritaires).
Le reste (autres écrans) sera fait en continu, écran par écran.

#### Risques & mitigations
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Camille se plaint de devoir cliquer pour voir ses data | Moyenne | Moyen | Mémoriser l'état ouvert/fermé en localStorage : Camille déplie une fois, c'est toujours déplié pour elle |
| Antoine clique quand même par curiosité et s'effraie | Faible | Faible | Vocabulaire grand public dans les accordéons aussi |

#### Critères d'acceptation
- [ ] Composant `<Disclosure>` créé et documenté.
- [ ] SessionDetail, Validation post-séance, Profil, Suivi refactorés.
- [ ] L'état ouvert/fermé persisté en localStorage par utilisateur.
- [ ] Aucune information vitale cachée derrière un accordéon (validation, prochaine séance, etc. toujours visibles).

#### KPIs
- Time-to-action sur SessionDetail (clic Valider) : < 3s en médiane (cible Antoine).
- Taux de dépliage des accordéons : à mesurer ; cible 30-50% des sessions data-friendly.

---

## 5. Annexes

---

### A1 — Brief de candidature Garmin Developer Program

> **Document autonome dédié** : [garmin-application-brief.md](garmin-application-brief.md) — version définitive prête à copier-coller dans le formulaire Garmin, avec pre-flight checklist, cover email, decision log.
>
> **URL formulaire confirmée** : https://www.garmin.com/en-US/forms/developercontactus/
> **Email fallback** : connect-support@developer.garmin.com
> **Délai annoncé** : confirmation sous 2 jours ouvrés, intégration technique 1-4 semaines après approbation. **Gratuit**.

#### Informations club confirmées (source athle.fr)

| Champ | Valeur |
|---|---|
| Nom officiel | S/l Narbo Nordik Club |
| Code FFA | **011032** |
| Localisation | 21 Rue Paul Philoctete, 11100 Narbonne |
| Licenciés totaux | 144 (65H + 79F) |
| Cible app (runners) | ~50 licenciés running / trail |
| Labels FFA | Club Running (Argent), Club Forme/Santé (Or) |
| Président | Régis Champrose |
| Site club | https://narbonordikclub.wixsite.com/narbo-nordik-club |
| Site app | https://app.narbo-nordik.fr |
| Contact technique | Matthieu Daumain — matthieu@daumain.fr |

#### Pré-requis avant envoi candidature

- [x] Rédiger et publier la politique de confidentialité (URL `/legal/privacy`)
- [ ] Préparer 3-4 screenshots de l'app
- [ ] Préparer un mockup de l'intégration Garmin
- [ ] (Optionnel) Lettre de soutien signée du président du club
- [ ] Valider auprès du club l'utilisation du nom officiel et du code FFA

Le brief complet de candidature (sections 1-11 + cover email) est dans [garmin-application-brief.md](garmin-application-brief.md).

#### Description de l'application

**Nom** : Narbo Nordik

**Type** : Application web (PWA) pour la gestion sportive d'un club de running / trail.

**Description courte (140 caractères)** :
> Application club pour licenciés running/trail Narbo Nordik : programmes coach, validation séances, palmarès, suivi VMA.

**Description longue** :
> Narbo Nordik est une application web progressive (PWA) développée pour la section running et trail du club Narbo Nordik, basé à Narbonne (France). Elle permet aux coachs fédéraux du club de programmer les séances d'entraînement hebdomadaires, et aux athlètes licenciés (≈30 personnes) de consulter leur programme, valider leurs séances réalisées, suivre leur progression VMA, partager leurs palmarès de compétitions et leur historique d'entraînement.
>
> L'intégration Garmin Connect nous permettrait de récupérer automatiquement les activités de course à pied des athlètes équipés de montres Garmin, afin de :
> 1. Rapprocher automatiquement leur sortie réelle de la séance prévue par le coach (matching date/heure).
> 2. Restituer les métriques clés (distance, allure, fréquence cardiaque, VO2max estimée, training load) dans l'interface coach et athlète.
> 3. Générer un feedback qualitatif post-séance à partir de ces données (analyse écart au plan, dérive cardiaque, qualité d'exécution).
>
> Environ 50% de nos athlètes utilisent une montre Garmin sans synchroniser vers Strava, ce qui rend l'intégration native Garmin Connect indispensable pour offrir le même service à tous les licenciés. L'intégration Strava est déjà en production dans notre app pour les athlètes qui l'utilisent.

#### Use cases techniques

1. **OAuth** : permettre aux athlètes du club de connecter leur compte Garmin Connect depuis leur profil utilisateur, en mode lecture seule.
2. **Activities (Health API)** : ingérer les activités de course (Run, Trail Run) avec leurs métriques détaillées : distance, durée, allure, FC moyenne/max, dénivelé, calories, VO2max, training load.
3. **Push notifications (Push Service)** : recevoir les nouvelles activités en temps réel après synchronisation montre, pour proposer une validation rapide à l'athlète à son retour.
4. **Activity Details** : récupérer les laps / fractions pour analyse fine des séances de fractionné.

#### APIs demandées

- [x] Activity API
- [x] Health API
- [x] Push Service (webhook)
- [ ] Connect IQ App (non requis)
- [ ] Wellness API (non requis)
- [ ] Training API (non requis pour V1, pourrait être V2)

#### Volume prévisionnel

- **Utilisateurs** : ~30 athlètes licenciés au club (volume stable, croissance lente : +5 à 10 athlètes/an).
- **Requêtes API estimées** : ~3000 / mois (OAuth + sync activités + détails).
- **Pic d'activité** : mardis et jeudis soir (séances club), samedis matin (sorties longues).

#### Conformité & sécurité

- **Stockage des tokens** : access_token et access_token_secret chiffrés au repos (Postgres column-level encryption via Supabase Vault).
- **Authentification utilisateur** : Supabase Auth (email + OTP / OAuth Google).
- **Données stockées** : activités running uniquement, pas de données médicales / de sommeil / de stress (out of scope).
- **Conformité RGPD** : déclaration CNIL en cours, droit à l'oubli implémenté (suppression compte = purge intégrale).
- **Durée de conservation** : tant que l'athlète est licencié du club + 12 mois après désinscription.
- **Politique de confidentialité** : publiée sur https://app.narbo-nordik.fr/legal/privacy (route publique). Mentions légales : reste à rédiger.

#### Calendrier souhaité

- Approbation visée : Q3 2026 (idéalement avant la rentrée sportive de septembre).
- Mise en production : sous 2 semaines après réception des clés OAuth.

#### Pièces jointes recommandées (à préparer)

- [ ] Screenshots de l'app actuelle (Home, SessionDetail, Profil avec intégration Strava existante).
- [ ] Mockup de l'intégration Garmin envisagée (panneau "Mes appareils").
- [ ] Lettre de présentation du club (statuts association, nombre de licenciés FFA).
- [ ] Politique de confidentialité.

---

### A2 — Glossaire

| Terme | Définition |
|---|---|
| **VMA** | Vitesse Maximale Aérobie. Vitesse en km/h à laquelle un coureur consomme son maximum d'oxygène. Base du dimensionnement des séances. |
| **Zones d'allure** | Plages de vitesse calculées en % de VMA : EF (endurance fondamentale), SV1 (seuil 1), SV2 (seuil 2), VMA. |
| **Dérive cardiaque** | Augmentation progressive de la FC à intensité constante, signe de déshydratation ou de fatigue. |
| **Training Load** | Score de charge d'entraînement (Garmin/Coros), basé sur durée + intensité. |
| **VO2max** | Volume maximal d'oxygène consommable. Indicateur principal de la condition cardio. |
| **Running Power** | Puissance estimée en Watts par la montre (Coros, Stryd). Métrique d'effort indépendante du terrain. |
| **Nordik** | Like / endorsement social dans l'app (sur palmarès ou séance). |
| **Persona** | Profil utilisateur fictif représentatif (Antoine = simple, Camille = data-friendly, Marc = coach). |
| **PWA** | Progressive Web App. Application web installable, fonctionnant hors-ligne. |
| **RLS** | Row Level Security. Mécanisme Postgres/Supabase pour filtrer les lignes par utilisateur. |
| **Edge Function** | Fonction serverless Deno hébergée par Supabase. |
| **Prompt caching** | Mécanisme Anthropic permettant de réutiliser un long préfixe de prompt à coût réduit. |

### A3 — Liens utiles

#### APIs constructeurs
- **Strava API Reference** : https://developers.strava.com/docs/reference/
- **Coros Open API** : https://opendev.coros.com
- **Garmin Connect Developer Program** : https://developer.garmin.com/gc-developer-program/overview/
- **Suunto App API** : https://www.suunto.com/partners/suuntoapp-for-developers/
- **Polar Accelerate** : https://www.polar.com/accesslink-api/

#### Documentation Anthropic
- **Claude API docs** : https://docs.anthropic.com
- **Prompt caching** : https://docs.anthropic.com/claude/docs/prompt-caching
- **Modèles disponibles** : https://docs.anthropic.com/claude/docs/models-overview
- **Pricing** : https://www.anthropic.com/pricing

#### Bibliothèques évaluées
- `browser-image-compression` (C6) : https://www.npmjs.com/package/browser-image-compression
- `@vercel/og` (C8) : https://vercel.com/docs/functions/og-image-generation
- `oauth-1.0a` (C3, pour OAuth Garmin) : https://www.npmjs.com/package/oauth-1.0a

#### Internes Narbo Nordik
- Repo GitHub : (à compléter)
- Supabase project : (dashboard URL)
- Vercel project : (dashboard URL)
- CLAUDE.md : `/CLAUDE.md` (instructions projet)

### A4 — Decision log

| Date | Décision | Contexte / raison |
|---|---|---|
| 2026-05-23 | Architecture multi-provider générique (table `device_connections`) | Strava actuellement modèle 1:1, refacto nécessaire avant d'ajouter Coros/Garmin/Suunto |
| 2026-05-23 | WhatsApp Business API écartée | Pas de support des groupes WhatsApp, coût élevé, deeplinks suffisent pour le besoin |
| 2026-05-23 | Claude Haiku 4.5 par défaut, Sonnet 4.6 à la demande | Coût ~0,002 €/analyse en Haiku vs 0,02 € en Sonnet, suffisant pour 95% des cas |
| 2026-05-23 | Pas de toggle "mode simple / mode expert", progressive disclosure à la place | Users simples ne trouveraient jamais le toggle ; l'accordéon est self-explicit |
| 2026-05-23 | Bucket session-proofs privé par défaut, opt-in pour partage club | Photos peuvent contenir info perso (lieu, autre coureur visible) |
| | | |
| _Ajouter les décisions au fil de l'eau_ | | |

---

## Mise à jour de ce document

Ce backlog est un **document vivant**. Conventions :

- Toute décision structurelle est tracée dans [A4 — Decision log](#a4--decision-log).
- Les chantiers livrés sont marqués `[LIVRÉ — date]` en titre.
- Les chantiers en cours sont marqués `[EN COURS — depuis date]`.
- Les nouveaux chantiers s'ajoutent en suivant le même template (Objectif / Scope IN-OUT / Pré-requis / Architecture / Modèle / UX / Effort / Risques / Acceptation / KPIs).

**Pour démarrer le chantier C1** : ouvrir une branche `feat/multi-provider-refactor`, créer la migration `20260524100000_multi_provider_refactor.sql`, suivre la spec ci-dessus.
