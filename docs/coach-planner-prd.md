# PRD v3 — Coach Toolkit Narbo Nordik

**Auteurs** : Matthieu Daumain (consultant) · validation produit David Nunez (coach)
**Date** : 28 mai 2026
**Version** : 3.0 (intègre les échanges WA des 25-26 mai 2026 et les 3 fichiers réels de David)
**Statut** : Direction produit confirmée par David sur 4 points sur 8 · maquettes envoyées · attente questions Q5-Q8 + RDV IRL
**Sauvegarde v2** : `~/Documents/CLAUDE/backups/coach-planner-prd-v2-*.md`

---

## 1. Contexte

### Le problème observé

En mai 2026, David Nunez (coach trail Narbo Nordik, 1 des 2 coachs actifs du club, encadre 47 athlètes répartis en 3 groupes) a renoncé à saisir son plan d'entraînement dans la PWA Narbo Nordik et a envoyé un tableau Excel par WhatsApp.

La donnée le confirme : sa production de séances coach est passée de **70-71 séances/mois en mars-avril** à **11 séances en mai** (−84%). Côté athlètes l'effet d'entraînement se voit aussi : sessions personnelles passées de 33 (mars) à 9 (mai).

L'app est en train de perdre son cas d'usage. Il faut résoudre la friction coach en priorité.

### Validation directe par David (25-26 mai 2026)

À la lecture des premières propositions (PRD v2 — Workout Builder type Garmin, Week Planner matrice), David a rejeté :

> "Il faut pas 50 options simple, pas de template ou de pré-truc à utiliser ce n'est pas la peine."
>
> "Mon problème principal c'est que je ne vois pas ce qu'on a fait dans le passé clairement."
>
> "Ça me prend beaucoup trop de temps de créer une séance de cette façon."
>
> "Avec Excel ça me prend 1 min."
>
> "Ça fait 15 ans que je fais comme ça."

Et donné la solution :

> "Il faudrait un copié-collé d'Excel et garder le reste."
>
> "J'ai besoin d'une vision d'ensemble qui me permet de voir où on en est, reprendre un truc sur plusieurs semaines ou plusieurs mois, copier-coller adapter rapidement."
>
> "Modulable, qu'on puisse retoucher."

→ Le PRD v2 est obsolète à 80%. Cette v3 reflète **la direction validée par David**.

---

## 2. Ce qu'on a appris de David

### Sa méthode réelle (15 ans de pratique)

1. **Travail à l'écrit / Excel D'ABORD**, l'app n'est qu'un véhicule de diffusion
2. **Construit en remontant l'objectif** : course finale → 2 semaines d'affûtage → bloc de charge max → réduction → prépa spécifique → prépa générale
3. **Cycles de 2-3 mois** selon l'objectif
4. **Modifie constamment** : météo, athlète qui veut rejoindre un autre groupe, blessure
5. **Garde tout en mémoire dans un dossier** (mental + fichiers) — pas de vue produit unifiée aujourd'hui

### Les 3 fichiers réels qu'il nous a partagés

| Fichier | Format | Structure | Période | Usage |
|---|---|---|---|---|
| **Tableau hebdo club** (semaine 21) | Excel TSV, 6 colonnes | matrice jours × groupes | 25-31 mai 2026 | Planning hebdo régulier |
| **PLAN Antoine Marathon Mont-Blanc** | Word, narratif | sections "SEMAINE N" + jours | 9 mars → 26 juin 2026 (16 sem) | Prépa objectif individuel |
| **plan_pierre_dugue** | Excel, 2 colonnes | Date \| Séance | 15 déc 2025 → 24 jan 2026 (22 séances) | Format minimaliste |
| **Plan_Detaille_Trail_Jusqu_Ventoux** | Excel, 5 colonnes | Semaine \| Date \| Jour \| Type \| Contenu | 14 jan → 28 mars 2026 (11 sem) | **Format canonique selon David** |

### Découvertes clés

#### Découverte 1 — Le format canonique est connu (5 colonnes Ventoux)

David l'a explicitement nommé : *"Le format de base c'est ça, après je peux le rendre plus jolie pour que la personne puisse mieux comprendre mais la base copié-collé ça"*.

C'est le **template Excel officiel** qu'on lui proposera dans l'app à terme.

#### Découverte 2 — David classe lui-même les séances par "Type"

Dans la colonne 4 du format canonique, il écrit "VMA courte", "Seuil progressif", "Côtes longues", etc. Il a déjà ~30 sous-types qui se regroupent en **7 macro-catégories** :

| Macro-type | Couleur | Sous-types observés dans ses plans |
|---|---|---|
| **VMA** | Rouge | VMA courte, VMA longue |
| **Seuil** | Orange | Seuil, Seuil progressif, Seuil vallonné, Seuil léger |
| **Côtes** | Marron | Côtes courtes, Côtes longues, Côtes + descente |
| **Sortie longue** | Vert foncé | SL, SL finish, SL trail D+, SL + enchaînement, SL pic charge, SL contrôlée |
| **Spécifique** | Bleu | Spécifique trail, Spécifique soutenu, Allure course, Tempo trail |
| **Récup / Affûtage** | Gris | Récup, Activation, Allégé, Rappel intensité, Rappel allure, Rappel court, Reprise douce |
| **Course / Test** | Jaune | Trail de Bize, Trail de Fontfroide, France Trail Ventoux |

→ La **classification automatique par mots-clés** marche sans intervention coach. Si elle se trompe, override 1 clic.

#### Découverte 3 — Le `|` est son séparateur naturel pour les phases

Dans une cellule, David écrit :
```
20' EF + éducatifs | 8–12 x 1' rapide / 1' récup | 10' retour au calme
```

→ Côté athlète, on rend chaque segment comme une **carte empilée** sans rien demander au coach. Le coach garde son écriture, l'athlète gagne en lisibilité.

#### Découverte 4 — Deux dimensions de planning, pas une

L'app doit gérer DEUX choses orthogonales :

1. **Plan club** : matrice jours × groupes (Essentiel / Intermédiaire / Renforcé) — c'est ce que tout le club fait
2. **Plans objectif** : 1 athlète (ou petit groupe) prépare un objectif spécifique (Marathon Mont-Blanc, Trail Ventoux, semi-marathon) sur N semaines avec sa propre logique de cycle

Aujourd'hui David les mélange dans le même Excel (colonne "Spéciaux" ou page séparée) ou utilise Word/PDF pour les plans objectif. Il a explicitement demandé qu'on supporte les deux formats.

#### Découverte 5 — Le bug Amandine (actif en production)

> "Quand ils ont une prépa spé ils voient aussi l'entraînement de base du club, du coup ils croient qu'ils devaient tout faire ou ils ne comprenaient pas la séance à faire (Amandine a buggé avec ça)"

Un athlète en prépa objectif voit aujourd'hui **deux séances par jour** (la sienne + celle du groupe) et se trompe. C'est probablement un facteur silencieux du désengagement coach + athlète sur mai 2026.

#### Découverte 6 — Modulabilité non négociable

> "Modifiable au dernier moment, j'adapte constamment suivant aussi la météo, il faut quelque chose de modulable qu'on peut retoucher."

L'import publie ne fige pas. Toute séance reste éditable après publication, avec notification push aux athlètes si modification.

---

## 3. Direction produit FINALE (v3)

Sur la base des 6 découvertes :

| Brique | Statut | Justification |
|---|---|---|
| **Import multi-format en lot** | **Parcours dominant** | Match Excel, friction zéro, support 4 formats |
| **Création manuelle d'une séance unique** | **Conservée et simplifiée** | Cas dernière minute, mobile, terrain |
| **Édition après publication** | **Native, sans friction** | Modulabilité (météo, blessure, etc.) |
| **Fiche athlète enrichie** | **Nouveau** | Le "dossier mental" de David, digitalisé |
| **Diagnostic de cohérence** | **Nouveau** | Vue automatique qu'il fait aujourd'hui à la main |
| **Plans objectif comme entité 1ère classe** | **Nouveau** | Bug Amandine + prépa individualisée |
| **Workout Builder Garmin-style** | **MORT** | Refusé explicitement par David |
| **Templates / bibliothèque** | **MORT v1** | Refusé explicitement par David |
| **Repeat blocks / target zones** | **MORT v1** | Texte libre suffit |
| **Audio attaché** | **Reporté v2** | Mentionné mais pas prioritaire |
| **Week Planner matrice** | **Repensé** | En consultation read-only, pas en édition |

### Le principe directeur

> **L'app accompagne le workflow Excel de David, ne le remplace jamais.**
>
> Le coach reste à 95% dans Excel. L'app sert à : diffuser proprement aux athlètes, consulter l'historique avec feedback, vérifier la cohérence des plans, gérer les prépas objectif individuelles, faire des ajustements de dernière minute.

---

## 4. La création manuelle est conservée (réponse à la question UX)

Trois parcours coexistent dans le produit, le coach choisit :

### Parcours A — Import en lot (parcours dominant)
**Quand** : il a son plan Excel prêt
**Combien de séances** : 5 à 200 d'un coup
**Temps cible** : < 2 min pour une semaine entière, < 10 min pour 16 semaines de prépa objectif

### Parcours B — Création manuelle d'une séance unique (parcours conservé)
**Quand** :
- Ajout dernière minute ("je rajoute une séance demain matin pour Antoine")
- Météo / blessure / changement de programme du jour
- Le coach est sur le terrain avec son téléphone
- Séance imprévue (stage week-end, sortie test)
- Tester une séance avant de l'intégrer au plan

**UX** : un form simplifié à 4 champs :
1. Date + heure
2. Cible (groupe OU athlète)
3. Type de séance (autocomplete depuis ses précédents types)
4. Contenu (texte libre, `|` détectés)

**Mobile-friendly** (le coach peut être au stade quand il l'utilise).
Temps cible : < 30 secondes pour une séance simple.

### Parcours C — Duplication depuis l'historique (parcours rapide)
**Quand** : "On refait la séance VMA de mardi dernier, lundi prochain, pour les 3 groupes"

**UX** : depuis n'importe quelle séance passée dans la timeline, bouton "Reprendre cette séance" qui ouvre le form du parcours B pré-rempli, avec nouvelle date + nouvelle cible.

→ Ces trois parcours mènent à la **même table `sessions`** en base. Aucun mode caché, aucun parcours secondaire.

---

## 5. Architecture — Option 3 hybride simplifiée

```
┌──────────────────────┐
│  objectives          │  ◄── (NEW) Prépas spécifiques par athlète(s)
│  + objective_phases  │      avec phases (charge / allégée / affûtage / objectif)
└──────────┬───────────┘
           │ optionnel
           ▼
┌──────────────────────────────────┐
│  sessions                        │  ◄── Table unifiée
│  (text libre + macro_type +      │      Tous parcours convergent ici :
│   target_group OR target_athlete │      A) Import en lot
│   + objective_id NULLABLE)       │      B) Création manuelle
└──────────────────────────────────┘      C) Duplication
           │
           ▼
┌──────────────────────────┐
│  session_validations     │  ◄── EXISTANT, inchangé
│  (status + feedback +    │
│   sensations + commentaire│
│   libre)                 │
└──────────────────────────┘
```

**Conséquences positives** :
- Modèle data ultra-simple (3 tables + 1 existante)
- L'athlète continue de voir des `sessions` (zero changement de son UI)
- Matching Strava continue d'opérer (sessions.id)
- Pas de migration risquée des sessions existantes

---

## 6. Modèle de données

### 6.1. Table `sessions` (étendue)

La table `sessions` existante reçoit quelques colonnes nouvelles. Pas de migration destructive.

```sql
-- Migration phase 7 : enrichissement sessions + objectifs

ALTER TABLE sessions
  ADD COLUMN target_athlete_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN macro_type TEXT
    CHECK (macro_type IN ('vma','seuil','cotes','sl','spe','recup','course','other')),
  ADD COLUMN sub_type TEXT,                     -- "VMA courte", "Côtes longues"...
  ADD COLUMN content_text TEXT,                 -- texte libre tel que David écrit
  ADD COLUMN coach_notes TEXT,                  -- markdown libre privé coach
  ADD COLUMN objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  ADD COLUMN source TEXT DEFAULT 'manual'
    CHECK (source IN ('import_bulk','manual','duplicate'));

-- Le group_id existant reste, mais devient OPTIONNEL si target_athlete_id est utilisé.
-- Contrainte XOR sur la cible :
ALTER TABLE sessions ADD CONSTRAINT session_target_xor
  CHECK ((group_id IS NOT NULL AND target_athlete_id IS NULL)
      OR (group_id IS NULL AND target_athlete_id IS NOT NULL)
      OR (group_id IS NOT NULL AND target_athlete_id IS NOT NULL));
-- Note : on autorise les deux non-null pour permettre "groupe X mais override individuel"
-- → à confirmer avec David (Q nouvelle)

-- Migration data : pour les sessions existantes
UPDATE sessions SET
  content_text = COALESCE(description, title),
  source = 'manual',
  macro_type = 'other'
WHERE content_text IS NULL;
```

### 6.2. Table `objectives` (nouvelle)

```sql
CREATE TABLE objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES users(id) NOT NULL,
  name TEXT NOT NULL,                           -- "Marathon du Mont-Blanc 2026"
  race_date DATE NOT NULL,                      -- "2026-06-26"
  race_distance_km NUMERIC,                     -- 90
  race_elevation_m INT,                         -- 6000 (D+)
  race_location TEXT,                           -- "Chamonix"
  notes TEXT,                                   -- description libre coach
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  result_summary TEXT,                          -- post-course : "3h45, 87e/450, fini en forme"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_objectives_coach ON objectives(coach_id);
CREATE INDEX idx_objectives_status ON objectives(status);
```

### 6.3. Table `objective_athletes` (liaison N-N)

Un objectif peut concerner 1 athlète ou plusieurs.

```sql
CREATE TABLE objective_athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE NOT NULL,
  athlete_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(objective_id, athlete_id)
);

CREATE INDEX idx_objective_athletes_athlete ON objective_athletes(athlete_id);
```

### 6.4. Table `objective_phases` (nouvelle, optionnelle)

Pour les plans objectif, David peut taguer manuellement chaque semaine ("S5 = Pic charge", "S8 = Allégée", "S15 = Affûtage"). Optionnel : l'app peut aussi détecter automatiquement.

```sql
CREATE TABLE objective_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,                     -- début de la semaine ISO
  phase TEXT NOT NULL
    CHECK (phase IN ('reprise','developpement','charge','pic_charge','allegee','specifique','affutage','objectif')),
  volume_target_km INT,                         -- ≈ 60 km
  notes TEXT,
  UNIQUE(objective_id, week_start)
);
```

### 6.5. RLS

```sql
-- Objectives
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own objectives" ON objectives FOR ALL TO authenticated
  USING (coach_id = auth.uid());
CREATE POLICY "Athlete sees own objectives" ON objectives FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM objective_athletes oa
    WHERE oa.objective_id = id AND oa.athlete_id = auth.uid()
  ));

-- Objective_athletes : coach manage, athlete reads own
ALTER TABLE objective_athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages objective_athletes" ON objective_athletes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM objectives o WHERE o.id = objective_id AND o.coach_id = auth.uid()
  ));
CREATE POLICY "Athlete sees own assignments" ON objective_athletes FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

-- Objective_phases : héritent
ALTER TABLE objective_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own phases" ON objective_phases FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM objectives o WHERE o.id = objective_id AND o.coach_id = auth.uid()
  ));
```

### 6.6. Le fix bug Amandine — règle de priorité (côté lecture)

Pas de changement de schéma. C'est une règle applicative à la lecture côté athlète :

```sql
-- Vue applicative : sessions visibles par l'athlète
-- (à implémenter dans src/lib/athleteSessions.ts)
--
-- Pour un athlete_id donné, pour une période donnée :
-- 1. SI l'athlète a un objective avec status='active' qui couvre la date
--    → RETURN uniquement les sessions WHERE objective_id = obj.id AND target_athlete_id IN (oa.athlete_id)
-- 2. SINON
--    → RETURN les sessions WHERE group_id = athlete.group_id (séances club)
--
-- L'athlète peut explicitement activer un toggle "Voir aussi le programme du groupe"
-- pour reprendre la séance club ce jour-là.
```

---

## 7. Conventions

### 7.1. Allure (pace)

Stockée en secondes par kilomètre, formatée à l'affichage. Convention déjà documentée dans v2.

### 7.2. Couleurs macro-types (alignées sur le code app)

| Macro | Hex | Variable CSS |
|---|---|---|
| VMA | `#EF4444` | `--macro-vma` |
| Seuil | `#F59E0B` | `--macro-seuil` |
| Côtes | `#92400E` | `--macro-cotes` |
| Sortie longue | `#10B981` | `--macro-sl` |
| Spécifique | `#3B82F6` | `--macro-spe` |
| Récup / Affûtage | `#737373` | `--macro-recup` |
| Course / Test | `#EAB308` | `--macro-course` |

### 7.3. Classification automatique par mots-clés

```ts
function classifyMacroType(typeText: string, contentText: string): MacroType {
  const s = (typeText + ' ' + contentText).toLowerCase();
  if (/vma|fraction|fartlek/.test(s)) return 'vma';
  if (/seuil|sv1|sv2|tempo/.test(s)) return 'seuil';
  if (/côte|cote|montée|grimpe|moujan|mortitude/.test(s)) return 'cotes';
  if (/sortie longue|\bsl\b|long run|sortie nature|vallonn/.test(s)) return 'sl';
  if (/spécif|specif|allure (course|trail|object)/.test(s)) return 'spe';
  if (/récup|recup|allégé|rappel|reprise|activation|repos|renfo|gainage|ppg|vélo/.test(s)) return 'recup';
  if (/trail de|france trail|championnat|objectif|course test|marathon|ventoux|mont[- ]blanc/.test(s)) return 'course';
  return 'other';
}
```

### 7.4. Rendu visuel du `|`

Côté athlète : si le contenu d'une séance contient `|`, on split et on rend chaque segment dans une carte numérotée. Côté coach : on garde l'affichage texte brut dans la timeline historique pour respecter la convention d'écriture du coach.

---

## 8. Types TypeScript

```ts
// src/types/coach-toolkit.ts

export type MacroType = 'vma'|'seuil'|'cotes'|'sl'|'spe'|'recup'|'course'|'other';
export type SessionSource = 'import_bulk'|'manual'|'duplicate';
export type ObjectiveStatus = 'active'|'completed'|'cancelled';
export type ObjectivePhase = 'reprise'|'developpement'|'charge'|'pic_charge'|'allegee'|'specifique'|'affutage'|'objectif';

export interface SessionExtended {
  // Champs existants conservés
  id: string;
  date: string;
  title: string;
  session_type: SessionType;
  group_id: string | null;
  blocks: SessionBlock[];          // conservé pour rétrocompat / migration douce
  description: string | null;
  created_by: string;
  created_at: string;
  is_personal: boolean;

  // Nouveaux champs
  target_athlete_id: string | null;
  macro_type: MacroType | null;
  sub_type: string | null;          // "VMA courte", "Côtes longues"...
  content_text: string | null;      // texte libre canonique
  coach_notes: string | null;       // markdown privé coach
  objective_id: string | null;
  source: SessionSource;
}

export interface Objective {
  id: string;
  coach_id: string;
  name: string;
  race_date: string;
  race_distance_km: number | null;
  race_elevation_m: number | null;
  race_location: string | null;
  notes: string | null;
  status: ObjectiveStatus;
  result_summary: string | null;
  created_at: string;
  athletes: User[];                 // résolu via objective_athletes
  phases: ObjectivePhaseEntry[];    // résolu via objective_phases
}

export interface ObjectivePhaseEntry {
  id: string;
  objective_id: string;
  week_start: string;
  phase: ObjectivePhase;
  volume_target_km: number | null;
  notes: string | null;
}

// Pour le parser d'import
export type ImportFormat = 'canonical' | 'matrix' | 'simple' | 'word';

export interface ParsedImportSession {
  week?: string;
  date: string;
  day?: string;
  target_type: 'group' | 'athlete';
  target_id: string;                // group_id ou athlete_id
  sub_type?: string;
  content_text: string;
  macro_type: MacroType;
}
```

---

## 9. Architecture composants React

```
src/pages/coach/
├── Import.tsx                      -- conteneur import multi-format
├── Objectives.tsx                  -- liste des prépas objectif
├── ObjectiveDetail.tsx             -- édition d'un plan objectif
├── Coherence.tsx                   -- diagnostic de cohérence
├── AthleteList.tsx                 -- liste fiches athlète (existante, à étendre)
├── AthleteDetail.tsx               -- fiche athlète enrichie (existante, refondue)
├── SessionEditor.tsx               -- existant 915 lignes, à SIMPLIFIER drastiquement
└── QuickAddSession.tsx             -- (NEW) form mobile rapide

src/components/coach/import/
├── PasteZone.tsx                   -- textarea + détection format
├── FormatTabs.tsx                  -- onglets canonical / matrix / simple
├── ImportPreview.tsx               -- aperçu temps réel droit
├── SessionPreviewCard.tsx          -- carte d'une séance dans l'aperçu
└── BlockSplitRenderer.tsx          -- rendu des `|` en cartes empilées

src/components/coach/coherence/
├── MacroDistributionBar.tsx        -- barre horizontale 7 segments
├── WeeklyHistogram.tsx             -- empilé par semaine
├── CoherenceAlert.tsx              -- carte d'alerte (warn / info / ok)
├── PhaseTimeline.tsx               -- semaines avec phases détectées
└── TargetComparisonRow.tsx         -- "VMA : 29% / cible 25-30%"

src/components/coach/athlete/
├── AthleteHeader.tsx               -- profil + photo + actions
├── ObjectiveCard.tsx               -- carte noire objectif actuel
├── SessionTimeline.tsx             -- timeline historique avec feedback
├── FeedbackBubble.tsx              -- bulle de feedback athlète
├── CoachPrivateNotes.tsx           -- notes jaunes privées
├── AthleteStats30d.tsx             -- stats 30 derniers jours
└── PastRaces.tsx                   -- palmarès courses

src/lib/
├── importParser.ts                 -- parsing 4 formats → ParsedImportSession[]
├── macroClassifier.ts              -- regex classification
├── coherenceAnalyzer.ts            -- distribution + alertes + phases
├── athleteSessions.ts              -- résolution règle priorité objective vs club (fix Amandine)
└── objectiveBuilder.ts             -- CRUD objectives + phases
```

---

## 10. Feature 1 — Import multi-format (parcours dominant)

> Le parcours qui débloque le coach. Démo validée sur prototype.

### Critères d'acceptation

1. Le coach colle un Excel via Cmd-V. Pas d'upload de fichier nécessaire en v1 (drag-drop optionnel v2).
2. L'app détecte automatiquement parmi 4 formats :
   - **Plan structuré** (5 colonnes Ventoux) — canonique
   - **Matrice hebdo** (jours × groupes)
   - **Liste simple** (Date \| Séance)
   - **Word narratif** (sections "SEMAINE N" + jours nommés)
3. Aperçu temps réel à droite, classification par macro-type, < 50 ms de parsing pour 100 séances
4. Le `|` dans le contenu est détecté et l'aperçu montre les blocs empilés
5. Distribution par macro-type affichée en bas (chips + barre horizontale)
6. Bouton "Créer les N séances" → INSERT en lot + redirection vers Historique
7. **Le texte est gardé tel quel** en base. Aucune restructuration imposée.

### Wireframe (validé)

Voir `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-import-prototype-v2.html`.

### Estimation dev

- Parser 4 formats : 1.5 j
- Classification : 0.5 j
- UI aperçu + détection : 1 j
- INSERT en lot + tests : 0.5 j
- **Total : ~3.5 j**

---

## 11. Feature 2 — Création manuelle (parcours conservé, simplifié)

> Conserver la possibilité de créer une séance unique sans coller. Réponse à la question UX du 28 mai.

### Critères d'acceptation

1. Bouton **"+ Nouvelle séance"** présent en permanence dans le header coach (mobile + desktop)
2. Form à 4 champs maximum :
   - **Date + heure** (datepicker)
   - **Cible** (groupe ou athlète — radio + autocomplete)
   - **Type de séance** (autocomplete depuis ses précédents `sub_type`)
   - **Contenu** (textarea libre, hint "tu peux séparer les phases avec `|`")
3. Boutons "Annuler" / "Créer la séance" (raccourci Cmd-Enter)
4. Submission < 1 seconde, redirection vers la séance créée ou retour à la liste
5. **Mobile-first** : 100% utilisable sur téléphone sans pincer-zoomer

### Refactor à prévoir

L'actuel `SessionEditor.tsx` (915 lignes) couvre déjà cas du coach. Il doit être **drastiquement simplifié** :
- Retirer tout le bloc builder par étapes
- Retirer les zones d'allure / VMA % min-max (David ne les utilise pas)
- Garder uniquement les 4 champs ci-dessus
- Cible : 200 lignes max après refactor

### Estimation dev

- Form simplifié : 1 j
- Mobile responsive + tests : 0.5 j
- Refactor SessionEditor existant : 1.5 j
- **Total : ~3 j**

---

## 12. Feature 3 — Fix bug Amandine (priorité objectif vs groupe)

> Quick win critique. Résout un problème actif de confusion utilisateur.

### Critères d'acceptation

1. Côté athlète, si l'athlète appartient à un `objective` avec `status='active'` couvrant la date d'aujourd'hui (basé sur les `objective_phases` ou les sessions liées) :
   - **Afficher uniquement** les `sessions` où `objective_id = obj.id`
   - **Masquer** les `sessions` du groupe par défaut
2. Un **toggle subtil** "Voir aussi le programme du groupe" disponible dans son calendrier
3. Si toggle activé, les séances du groupe s'affichent avec un style **secondaire** (opacité 60%, badge "Programme groupe")
4. Côté coach : pas de changement, il voit tout
5. Notification à l'athlète quand il rejoint un nouveau plan objectif : "Tu as une prépa spécifique active. Tu verras uniquement ces séances. [Bouton En savoir plus]"

### Estimation dev

- Logique `athleteSessions.ts` : 0.5 j
- Toggle UI + style secondaire : 0.5 j
- Notification onboarding : 0.5 j
- Tests + RLS update : 0.5 j
- **Total : ~2 j**

→ **Sprintable indépendamment** des autres features. À pousser en premier si possible.

---

## 13. Feature 4 — Diagnostic de cohérence

> Vue qui automatise ce que David fait aujourd'hui mentalement en relisant son Excel.

### Critères d'acceptation

1. Filtre période : 2-3 sem / Cycle (8 sem) / 3 mois / Saison
2. Filtre cible : un athlète / un groupe / tous groupes
3. **7 compteurs en haut** : un par macro-type avec % et comparaison à la cible
4. **3 cartes d'alerte** automatiques :
   - **Sous-représenté** (rouge) si un macro-type < seuil
   - **Distribution OK** (vert) si tout est dans les fourchettes
   - **Logique de cycle respectée** (info) si phases bien réparties
5. **Histogramme empilé par semaine** : 7 segments colorés
6. **Comparaison cible vs réalité** : barres horizontales avec score
7. **Phases du cycle** : détection auto à partir du volume hebdo + types de séances
8. **Cibles configurables** par le coach (par type de plan : trail long / marathon route / cross / etc.)

### Wireframe (validé)

Voir `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-coherence-diagnostic.html`.

### Estimation dev

- Calcul distribution + agrégation : 1 j
- UI graphiques (sans lib externe, SVG natif) : 1.5 j
- Détection phases auto : 1 j
- Configurateur cibles : 1 j
- **Total : ~4.5 j**

---

## 14. Feature 5 — Fiche Athlète enrichie

> Le "dossier mental" de David, digitalisé. Visible en un écran.

### Critères d'acceptation

1. Header athlète : photo, nom, groupe, âge, années d'entraînement, VMA, FCmax, poids, taille, contact, Strava connecté
2. Carte **Objectif actuel** (sombre, accent cyan) : nom, J-X, progression du plan, volume cumulé, D+ cumulé, adhérence
3. **Stats 30 jours** : planifiées / faites / manquées / volume hebdo moyen + sensations moyennes (barre 3 segments)
4. **Notes coach privées** (zone jaune) : ajoutables, datées, **invisibles à l'athlète**
5. **Palmarès** : courses passées avec chrono + placement
6. **Timeline d'entraînement** à droite :
   - Groupée par semaine avec en-tête "Volume cible / Phase / X/Y faites"
   - Chaque séance : icône status (✓ done / ✗ missed / ~ partial / ○ pending) + macro-type + sous-type + chrono
   - **Feedback athlète intercalé** sous chaque séance avec sensations + objectif atteint + commentaire libre
7. **Suggestion IA en bas** (optionnel v2) basée sur le feedback ("Antoine a fait 6/8 reps, sa séance VMA du jour est bien placée pour valider")
8. Filtres timeline : 4 dernières sem / plan en cours / 3 mois / saison + toutes / faites / manquées / avec feedback
9. Navigation par flèches "← Athlète précédent / suivant →"

### Wireframe (validé)

Voir `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-fiche-athlete.html`.

### Estimation dev

- Header + stats : 1 j
- Timeline avec feedback : 2 j
- Notes coach privées + RLS : 0.5 j
- Objectif card + calculs : 1 j
- Palmarès (si data existe) : 0.5 j
- **Total : ~5 j**

---

## 15. Feature 6 — Édition après publication (modulabilité)

> Modulable, sans friction. Validé directement par David.

### Critères d'acceptation

1. Toute séance publiée reste éditable par le coach
2. Modification de :
   - Date + heure
   - Cible (groupe ↔ athlète)
   - Type / sous-type
   - Contenu texte
   - Notes coach privées
3. **Notification push aux athlètes concernés** si modification, message "Le coach a modifié ta séance de [date] : [résumé du changement]"
4. **Historique des modifications** (audit log, optionnel v2 mais conseillé)
5. **Annulation rapide d'une séance** ("repos forcé" — météo) en 1 clic, statut "cancelled" affiché clairement
6. **Duplication en 1 clic** vers une autre date / cible (cf. Feature parcours C)

### Estimation dev

- Édition CRUD : 1 j
- Notifications push : 1 j
- Annulation : 0.5 j
- Audit log v2 : reporté
- **Total : ~2.5 j**

---

## 16. Phasage de livraison

| Sprint | Durée | Livrable | Critère de succès |
|---|---|---|---|
| **S0** | 1 j | Migration SQL phase 7 (sessions étendue + objectives + phases + RLS) | Tests passent, sessions existantes inchangées |
| **S1** | 2 j | **Fix bug Amandine** (priorité objective vs groupe) | Athlète avec objectif voit uniquement sa prépa |
| **S2** | 3 j | **Création manuelle simplifiée** (refactor SessionEditor 915 lignes → 200) | David crée une séance en < 30 s sur mobile |
| **S3** | 3.5 j | **Import multi-format en lot** | David colle son Excel Ventoux, 33 séances créées |
| **S4** | 2.5 j | **Édition après publication + notifs push** | Modif d'une séance → athlète notifié |
| **S5** | 4.5 j | **Diagnostic de cohérence** + configurateur cibles | David ouvre l'écran, voit les déséquilibres |
| **S6** | 5 j | **Fiche athlète enrichie** + notes coach privées | David ouvre la fiche d'Antoine, voit tout |
| **S7** | 2 j | UAT + polish + bugs | David valide sur sa semaine réelle, ≥ 8/10 |
| **Total** | **~23.5 j dev** | | Reception : 4 semaines sans Excel envoyé par WA |

S1 + S2 peuvent partir en parallèle dès S0 fini. S3 dépend de S0+S2. S5 + S6 peuvent partir en parallèle après S3.

Ce phasage privilégie les **quick wins** (bug Amandine + création manuelle simplifiée) avant l'import. Si on a peu de bande passante, S1+S2+S3 suffisent à débloquer David fonctionnellement.

---

## 17. Métriques de succès

### Quantitatives (4 semaines après livraison complète)

| Métrique | Cible | Mesurable via |
|---|---|---|
| Sessions coach créées / mois | ≥ 60 (vs 11 en mai 2026) | DB |
| Excel envoyés par WA | 0 | conversation avec David |
| Temps de création d'une semaine | < 2 min via import | David auto-déclare |
| Bug Amandine récurrence | 0 plainte | David + athlètes |
| Athlètes actifs / mois (MAU) | ≥ 30 (vs 28 actuel) | DB |
| Sessions avec feedback athlète | ≥ 50% des sessions | DB |
| Notes coach privées créées | ≥ 1 par athlète actif sur 3 mois | DB |

### Qualitatives

- David planifie sa prochaine semaine **en direct devant nous** (test contextuel UAT)
- Aucune demande de retour à Excel
- David accepte de planifier 3 mois d'un coup dans l'app au moins 1 fois

---

## 18. Questions encore ouvertes pour David

### Validées avec David (25-26 mai)

| # | Question | Réponse David |
|---|---|---|
| 1 | Coller dans l'app vs uploader fichier ? | **Coller direct**, format 5 colonnes Ventoux |
| 2 | Respecter format actuel ? | **Oui**, et supporter aussi format objectif individuel |
| 3 | Saisie 3 mois d'un coup ou semaine par semaine ? | **Adapte constamment**, doit être modulable |
| 4 | Vue historique : athlète ou groupe ? | **Les deux**, mais surtout vue d'ensemble de cohérence par type de séance |

### Non répondues — à clore en RDV IRL

| # | Question | Pourquoi c'est important |
|---|---|---|
| 5 | Phases d'entraînement (affûtage / charge / spécifique / générale) : taguées par toi ou détectées auto ? | Pour le designer la vue Cohérence et les `objective_phases` |
| 6 | Athlètes "vieux" qui n'utilisent pas l'app : on travaille leur adoption ou on les laisse en WhatsApp ? | Pour décider d'un bouton "export semaine en image WA" |
| 7 | Export depuis l'app vers WhatsApp (image / texte) | Continuation du Q6 |
| 8 | Vue d'ensemble en mars (70 séances/mois) : tu utilisais quoi comme fichier maître ? | Pour réutiliser sa structure mentale |

### Nouvelles questions issues de l'analyse des 3 fichiers

| # | Question | Quand |
|---|---|---|
| 9 | Les types de séances que tu écris en col. 4 (VMA courte, Seuil progressif...) — c'est une liste figée ou tu en inventes ? Menu déroulant ou texte libre ? | Affecte le composant `SessionEditor` + parsing import |
| 10 | Cibles % par macro-type pour le diagnostic cohérence : configurable par toi ou figées par "type de plan" (trail long / marathon route / cross) ? | Affecte le composant `Coherence` |
| 11 | Notes coach privées (zone jaune fiche athlète) : utiles, ou tu préfères tout partagé avec l'athlète ? | Affecte RLS + UI |
| 12 | Feedback athlète intercalé dans timeline vs onglet séparé ? | Affecte UX `AthleteDetail` |
| 13 | Quand un athlète a une prépa objectif, qu'est-ce qu'il fait des jours sans séance objectif ? RENFO du club ou repos total ? | Affecte le fix bug Amandine |
| 14 | Si tu modifies une séance après publication, on notifie l'athlète automatiquement ou tu veux décider à chaque fois ? | Affecte UX modification |

---

## 19. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| David trouve l'import plus lent que prévu | Faible | Élevé | Démo + test contextuel UAT en S7 |
| Migration sessions casse des données | Faible | Élevé | Migration ADD COLUMN seulement, pas de DROP |
| Parsing Word narratif (Antoine) imparfait | Moyenne | Moyen | En v1 : on convertit pour lui en 5 colonnes Excel et on lui propose le bon template. Parser Word v2. |
| Classification macro-type imparfaite | Moyenne | Faible | Override 1 clic + apprentissage des overrides utilisateur |
| Bug Amandine fix introduit régression | Moyenne | Élevé | Tests d'intégration + flag de désactivation pour rollback |
| Fiche athlète trop chargée sur mobile | Moyenne | Moyen | Mobile-first design, sections collapsibles |
| David rejette encore la solution | Faible | Catastrophique | UAT itératif après chaque sprint, pas de big bang |

---

## 20. Décisions architecturales

### Stack confirmée (inchangée)

- Vite 7 + React 19 + TypeScript strict
- Tailwind CSS 4 + primitives `src/components/ui/`
- Supabase (auth + DB + Storage)
- date-fns
- Pas de lib graphique externe (SVG natif suffit pour l'histogramme)
- Pas de lib drag-drop nécessaire en v1 (drag-drop reporté v2)

### Patterns

- **Server state** : `DataContext` étendu avec `objectives`
- **Optimistic UI** sur édition de séance + ajout note privée
- **Autosave** : déjà existant, étendu au form simplifié
- **Realtime** : Supabase channel sur `objectives` + `sessions` pour MAJ fiche athlète en direct

### Choix techniques notables

1. **`sessions.blocks` JSONB conservé** mais devient optionnel. Le `content_text` libre devient le champ principal.
2. **Pas de migration destructive** : `sessions` est étendue par ADD COLUMN. Toutes les sessions existantes restent valides.
3. **Pas de table `workouts` séparée** (vs PRD v2). Un workout = une session. Simplification massive.
4. **`group_id` ET `target_athlete_id` peuvent coexister** sur une session — à valider en Q. Cela permet "séance pour le groupe X mais override individuel pour 2 athlètes".
5. **Classification macro-type au moment du save** (pas runtime à chaque load) — pour permettre l'override stable.

---

## 21. Backlog v2+ (hors scope v1)

- **Templates de cycles** (4 semaines : volume / qualité / récup / affûtage)
- **Bibliothèque de lieux** avec autocomplete + GPX (Moujan, Mortitude, Chapelle Auzils, etc.)
- **Génération IA** d'une séance à partir d'un objectif texte
- **Export FIT** vers Garmin Connect (pour les athlètes Garmin)
- **Export WhatsApp** : "exporter cette semaine en image" → coller dans WA
- **Audio attaché** à une séance (refusé / reporté par David, à reproposer plus tard)
- **Vue mobile coach complète** (édition + planning)
- **Audit log** des modifications de séance
- **Drag-drop** dans Coherence pour ré-ordonner les semaines
- **Notifications push intelligentes** : "Antoine n'a pas validé sa séance d'hier"
- **Parsing Word narratif** automatique (format Antoine MdMB)
- **Statistiques cross-athlètes** : qui répond bien à quel type de séance
- **Marketplace** des plans objectifs entre coachs

---

## 22. Annexe — Artefacts David (sources de vérité)

### Conversations WhatsApp clés

- **25 mai 2026** : rejet du Workout Builder Garmin, demande "copié-coller + vision d'ensemble + modulable"
- **26 mai 2026** : réponses aux questions 1-4, partage des 3 fichiers, méthode 15 ans, bug Amandine

### Fichiers reçus

| Fichier | Localisation | Format | Période |
|---|---|---|---|
| Tableau hebdo club semaine 21 | Capture WA | Excel TSV matrice | 25-31 mai 2026 |
| PLAN Antoine Marathon du Mont blanc | `~/Downloads/PLAN Antoine Marathon du Mont blanc.docx` | Word narratif | mars-juin 2026 |
| plan_pierre_dugue.xlsx | `~/Downloads/plan_pierre_dugue.xlsx` | Excel 2 colonnes | déc 2025 - jan 2026 |
| Plan_Detaille_Trail_Jusqu_Ventoux.xlsx | `~/Downloads/Plan_Detaille_Trail_Jusqu_Ventoux.xlsx` | **Excel 5 colonnes canonique** | jan-mars 2026 |

### Prototypes HTML envoyés à David (26-27 mai 2026)

| Prototype | Localisation | Statut WA |
|---|---|---|
| Import v2 | `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-import-prototype-v2.html` | Envoyé via screenshot |
| Diagnostic cohérence | `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-coherence-diagnostic.html` | Envoyé via screenshot |
| Fiche athlète Antoine | `~/.gstack/projects/matiudmn-narbo-nordik/designs/coach-fiche-athlete.html` | Envoyé via screenshot |

### Données quantifiées (au 25 mai 2026)

- 47 users (2 coachs dont David, 45 athlètes)
- 28 athlètes actifs sur 30j (60% MAU)
- 11 séances créées par David en mai 2026 (vs 70-71 en mars-avril)
- 574 validations done depuis lancement
- 15 athlètes connectés à Strava (33%)

### Top 12 athlètes engagés (validations 30j au 25 mai 2026)

| # | Nom | Groupe | Validations |
|---|---|---|---|
| 1 | Angélique Giraud | Renforcé | 50 |
| 2 | Anaïs Marre | Intermédiaire | 13 |
| 3 | Sylvain Gatti | Intermédiaire | 9 |
| 4 | Matthieu Daumain | Essentiel | 8 |
| 5 | Ambre Gimenez | Intermédiaire | 7 |
| 6 | Anthony Lopez | Renforcé | 7 |
| 7 | Frederick Grare | Renforcé | 6 |
| 8 | Antoine Torres | Renforcé | 6 |
| 9 | Marc Cadenet | Intermédiaire | 5 |
| 10 | Cédric Castan | Intermédiaire | 5 |
| 11 | Matthieu Saint-Blancat | Intermédiaire | 5 |
| 12 | David Houbadiem | Intermédiaire | 5 |

---

## 23. Prochaines étapes

1. **Validation par David en RDV IRL** (en attente de son créneau)
   - Clôture des Q5-Q8 + Q9-Q14
   - Validation des prototypes
   - Confirmation du phasage
2. **Migration SQL phase 7** (~1 j) prête à passer une fois validé
3. **Sprint S1 (Fix Amandine)** en premier — quick win, indépendant
4. **Régénération du PDF du PRD** pour David
5. **Optionnel** : déploiement Vercel des 3 prototypes pour qu'il puisse interagir avec depuis son téléphone

—

*Document à versionner. Source de vérité unique pour cette refonte. Toute modification = revue rapide + bump version.*
