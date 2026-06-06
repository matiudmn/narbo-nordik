# PRD, Compte-rendu de séance : métriques, gamification et IA (post-Strava)

Projet : Narbo Nordik (PWA club course à pied / trail, Narbonne)
Date : 2026-06-06
Statut : audit consolidé, prêt pour arbitrage et phasage
Sources : audit multi-angles (data Strava, produit, UX, gamification, architecture), recherche Whoop/IA, tour de l'app en conditions réelles (Chrome, session coach).

---

## 1. Résumé exécutif

Strava n'a ouvert son API que pour 10 utilisateurs et impose un abonnement payant : l'intégration n'est pas viable pour un club. On la retire. Mais avant de couper, on capitalise sur ce qu'elle apportait (les chiffres de séance) et on en profite pour traiter un second sujet connexe : le retour de séance, où les athlètes laissent déjà des commentaires drôles et sympas au coach, mérite de devenir le moment le plus engageant de l'app.

Les deux sujets ne font qu'un : ils portent sur le même objet, la séance réalisée. La stratégie consiste à fusionner saisie de métriques (manuelle ou par capture d'écran analysée), retour de sensations et couche sociale/ludique en une seule expérience de compte-rendu, augmentée d'une couche d'IA (inspirée de Whoop, mais sans capteur ni promesse de santé) côté athlète et côté coach.

Principe directeur santé : on récompense le fait de raconter sa séance et la régularité, jamais la performance brute (vitesse, distance, dénivelé). C'est le moment idéal pour retirer Strava sans réintroduire sa pire mécanique, le classement au kilométrage.

---

## 2. Contexte et déclencheurs

### 2.1 Retrait subi de Strava
L'intégration est câblée en profondeur : 17 fichiers front, 3 edge functions (`strava-api`, `strava-auth`, `strava-cron`), 2 tables (`strava_connections`, `strava_activities`), 2 fonctions RPC, 1 cron, le champ `users.strava_id`, et des blocs d'affichage sur Home, Profil, fiche athlète, annuaire, aide, détail de séance. L'API gratuite plafonne à 10 utilisateurs autorisés, le passage à l'échelle est payant.

Nuance importante (mémoire projet) : 80 % du club utilise Garmin/Coros, et l'usage Strava est de 50/50. La donnée fine venait donc déjà de la montre, Strava n'étant qu'un relais, et l'intégration ne couvrait qu'une moitié du club dans la limite de 10 slots. La valeur réellement perdue est plus faible qu'il n'y paraît, mais elle est concentrée sur les athlètes orientés data, qu'il ne faut pas froisser.

### 2.2 Signal d'engagement déjà observé
Le triptyque objectif atteint / sensations / feedback texte existe et est rempli. Le coach lit déjà des retours du type « 2nd bloc une petite surchauffe due au soleil ». Ce comportement spontané et gratuit est un point de contact émotionnel : il suffit de lui donner une scène.

### 2.3 Inspiration Whoop
Whoop repose sur deux couches : un capteur biométrique continu (non transposable chez nous) et une couche IA conversationnelle (Whoop Coach, récaps quotidiens/hebdo/mensuels, ton motivant personnalisé) qui, elle, est transposable avec nos données déclaratives et l'API Claude (brique déjà prévue au backlog). On reprend le récit et l'encouragement, pas le hardware ni les allégations santé.

---

## 3. Vision et principes directeurs

Vision : faire du compte-rendu de séance le moment le plus gratifiant de l'app, un geste de quelques secondes qui capture l'effort (chiffres et ressenti) et déclenche de la reconnaissance humaine, pour donner envie de recommencer.

Principes :
1. 1-tap d'abord, le reste est bonus. Valider une séance reste instantané. Métriques, OCR, social et IA sont des couches optionnelles qui ne bloquent jamais.
2. La donnée sert l'humain, pas le classement. Les chiffres nourrissent le suivi coach et la progression perso, jamais un classement public par défaut. Coopération avant compétition.
3. Le fun est un moyen, l'assiduité est la fin. On amplifie le plaisir parce qu'il augmente le taux de compte-rendu et le lien.
4. Possession et portabilité des données. Tout ce qui entre (manuel, OCR, futur provider natif) est stocké et structuré dans Supabase.
5. Inclusif par défaut. Le dernier du groupe et l'enfant de 9 ans reçoivent autant de reconnaissance que le plus rapide.
6. IA encadrée. L'IA explique, encourage et synthétise. Elle ne diagnostique pas, ne donne pas de conseil médical, et toute sortie vers un athlète au nom du coach passe par une validation humaine.

---

## 4. Personas et jobs-to-be-done

### Athlète amateur (coeur de cible)
Adulte, court ou fait du trail pour le plaisir et la progression, majoritairement équipé Garmin/Coros, niveau et régularité variables.
- Assiduité : marquer sa séance faite en un geste, voir sa régularité reconnue.
- Expression : raconter sa séance vite et avec fun, se défouler, faire sourire le coach et les copains.
- Mémoire/progression : garder ses chiffres sans ressaisir ce que la montre a déjà mesuré.
- Reconnaissance : sentir que son effort est vu (réaction du coach, série, célébration).

### Coach David Nunez (coach et aussi pratiquant)
- Suivi : repérer en un coup d'oeil qui décroche ou va mal, pour rappeler les bonnes personnes.
- Lien : entretenir une relation chaleureuse à l'échelle, sans y passer ses soirées (réactions 1-tap plutôt que messages individuels).
- Animation : faire du club un endroit sympa où l'on revient.
- Garde-fou charge : toute action coach reste optionnelle et rapide, jamais une corvée obligatoire.

### Groupe enfants (à venir)
- Enfant : que ce soit un jeu, coloré, avec des récompenses visuelles, sans chiffres de perf ni comparaison.
- Parent : pouvoir superviser, données protégées (consentement parental, minimisation, RGPD mineurs).

---

## 5. État actuel (constaté en conditions réelles)

Tour de l'app effectué dans Chrome, session coach. Constats clés :

### 5.1 Deux surfaces de retour de séance, incohérentes
- `QuickSurveySheet` (bottom sheet, déclenché depuis Home ~1,8 s après le 1-tap "J'ai fait ma séance") : objectif (oui/partiel/non) et sensations (excellentes/bonnes/mauvaises) avec emoji, animation, célébration légère. Tokens propres. C'est la surface fun.
- Mini-survey inline dans `SessionDetail.tsx` : mêmes questions sans emoji, libellés en capitales, plus un textarea et une pièce jointe. Plus administratif, et couleurs Tailwind hardcodées (violation de la règle tokens du design system).

### 5.2 Le coach ne voit pas les sensations
Sur le Dashboard coach, la section "Derniers retours athlètes" ne liste que les validations ayant un feedback texte ou une pièce jointe, et n'affiche pas `objective_reached` ni `sensations`. La donnée est saisie et stockée, mais invisible côté coach. Les comptes-rendus sans texte ni photo sont absents. C'est le manque fonctionnel le plus criant : la gamification des sensations n'a aujourd'hui aucun débouché côté coach.

### 5.3 Métriques : trou depuis le retrait de Strava
Le modèle `SessionValidation` porte `feedback`, `attachment_path/type`, `objective_reached`, `sensations`, mais aucun champ de métrique chiffrée (distance, durée, FC, D+). Ces données venaient uniquement de Strava. C'est précisément le gap à combler.

### 5.4 Primitives de gamification dormantes
`StreakFlame` (série de semaines) et `ProgressRing` existent dans `src/components/ui/` mais ne sont branchés nulle part. `NordikButton` (réaction coeur) existe sur le palmarès et sur les séances perso. `VmaRecordCelebration` montre qu'on sait faire un vrai wow moment (gradient noir/cyan, trophée animé, RollingNumber, confetti, haptic) : ce soin n'existe que pour la VMA, jamais pour une séance ordinaire.

### 5.5 Dette à nettoyer dans le chantier
Couleurs Tailwind hardcodées dans `SessionDetail.tsx`, `Suivi.tsx`, `Profile.tsx` (bg-green/yellow/blue/red-100, etc.), à migrer vers les tokens success/warning/info/danger. Cohérence design globalement solide par ailleurs (noir/cyan, Framer Motion, primitives partagées).

---

## 6. Volet A, retrait de Strava et reprise des métriques

### 6.1 Ce que l'app récupérait vraiment
`athleteStats` (cumuls YTD/all-time), `recentActivities`, `hrZones`. La table `strava_activities` stocke distance, temps, allure, FC moy/max, D+, cadence, calories, suffer_score, device, `raw_payload`, et `matched_session_id` (lien réalisé/prévu). À noter : `suffer_score`, `max_speed`, `elapsed_time` sont stockés mais jamais affichés. La vraie valeur n'était pas les chiffres mais le lien réalisé/prévu.

### 6.2 Stratégie de reprise des insights

| Stratégie | Insights | Justification |
|---|---|---|
| Saisie manuelle (P0) | Distance, durée, allure (auto-calculée), D+, FC moy/max, RPE/ressenti. Au niveau profil (une fois) : zones FC, VMA (déjà présent), VO2max, records de référence. | Quelques chiffres simples suffisent à comparer réalisé et prévu. |
| OCR de capture (P1) | Très fiable : distance, durée, allure, D+, FC moy/max, calories. Partiel : temps par zone, splits, cadence. | Anti double-saisie pour les 80 % équipés Garmin/Coros. |
| Abandon | Relative Effort/Suffer (remplacé par un RPE 1-10), GAP, Fitness/Freshness, segments/KOM, kudos Strava, trace GPS, puissance, météo, vitesse max, temps écoulé, nom du device. | Propriétaire Strava, niche, ou non saisissable de façon fiable. |

Le `raw_payload` des activités déjà synchronisées permet de rapatrier en one-shot les activités déjà matchées vers le nouveau modèle, avant suppression. On capitalise réellement, puis on coupe.

### 6.3 Décision de modèle de données
Étendre `session_validations` (déjà 1:1 séance/athlète, RLS héritée), plutôt que créer une table `session_metrics`. Colonnes additives nullable : `distance_m`, `duration_s`, `elevation_m`, `avg_hr`, `max_hr`, `avg_cadence`, `metrics_source` ('manual' | 'ocr' | 'watch'). Allure non stockée (dérivée de distance/durée), ou colonne générée si tri SQL nécessaire. Contraintes de cohérence (bornes plausibles FC, distance, durée).

### 6.4 Décision sur `users.strava_id`
Le champ `users.strava_id` est un lien profil public saisi à la main, indépendant du module OAuth. Recommandation : le conserver (zéro coût, garde le lien social), ne retirer que le module d'intégration API. À arbitrer si l'on veut un retrait Strava total.

---

## 7. Volet B, compte-rendu gamifié

### 7.1 Parcours cible unifié
Un seul composant `SessionReportSheet` remplace les deux surfaces actuelles et supprime le délai de 1,8 s (le sheet monte juste après le tap). Machine à états en 5 temps, chacun sortable, rien de bloquant :

1. Réaction express : une rangée d'emojis-échelle (5 niveaux), sélection qui fait avancer automatiquement. Un lien "Juste valider" permet le vrai 1-tap (2-3 secondes).
2. Sensations enrichies : chips multi-sélection (jambes légères/lourdes, bon souffle, parti trop vite, etc.) plus une "punchline du jour" optionnelle (champ court, placeholders drôles) qui remplace le textarea froid. Conserve l'enum `sensations` existant pour ne pas casser le score de risque.
3. Métriques : deux chemins, capture (recommandée) ou saisie manuelle rapide, avec allure recalculée en direct. Tous les champs facultatifs.
4. Moment de récompense : célébration calibrée (`celebrate` subtle/normal/strong selon record ou série), chiffre héro animé (`RollingNumber`), `StreakFlame` qui s'incrémente, `ProgressRing` d'assiduité de la semaine, badge éventuel. Apparition en cascade.
5. Partage et retour : la séance devient une carte de feed pour le groupe et le coach, qui peut réagir en 1 tap.

### 7.2 UX de l'OCR de capture
Upload guidé (capture montre/Strava), état d'analyse (la propre capture de l'athlète, dimmée, ligne de scan), confirmation avec champs pré-remplis et corrigeables (les champs détectés marqués, l'allure recalculée), échec gracieux (bascule sur saisie manuelle, jamais de perte de la validation déjà enregistrée). L'humain confirme toujours avant écriture.

### 7.3 Mécaniques de gamification (top 5 à lancer)
Cadre : autodétermination (autonomie, compétence, affiliation). On récompense le comportement (raconter sa séance) et la régularité, pas la perf.

1. Punchline de séance (impact haut, effort faible) : le coeur du côté drôle, se greffe dans le sheet, alimente tout le reste.
2. Réaction du coach et "Vu par le coach" (impact haut) : la récompense sociale la plus forte, avec réactions 1-tap pour que David tienne le rythme.
3. Réactions entre athlètes (impact haut) : réutilise le pattern Nordik existant, sans compteur public de classement.
4. Coup de coeur hebdo du coach (impact haut, effort faible) : encart Home en rotation pour l'inclusivité.
5. Streak d'assiduité hebdomadaire tolérant : par semaine (pas par jour), avec jokers repos, jamais cassé par de mauvaises sensations. Brancher la primitive `StreakFlame` existante.

Badges recommandés (orientés expérience, pas perf) : premier compte-rendu, premier trail, première sortie longue, retour après absence, régularité 4 semaines, bravé la tramontane/pluie/chaleur (plafonné si danger), lève-tôt, supporter (a réagi à 10 retours), honnêteté (a déclaré une séance non atteinte). À éviter absolument : badges de plus gros kilométrage, dénivelé ou vitesse.

### 7.4 Garde-fous gamification
- Aucun classement public km/D+/vitesse. Séries et stats personnelles (soi contre soi).
- Streak hebdomadaire, jokers repos, jamais cassé par de mauvaises sensations (sinon les gens mentent, ce qui pollue le signal de risque).
- Réactions positives uniquement (set fermé, pas de pouce bas).
- Opt-in social (respect du flag `is_public`). Sensations négatives et score de risque restent privés athlète/coach.
- Pas de points/XP partout (effet de sur-justification qui tue la motivation intrinsèque).
- Mode enfants : échelle simplifiée, punchlines pré-écrites, métriques masquées, récompenses généreuses, ton 100 % positif, zéro comparaison.

---

## 8. Volet C, intelligence artificielle (inspiration Whoop)

Distinction clé : la couche capteur de Whoop (VFC, sommeil, recovery, strain) n'est pas transposable (pas de bracelet). La couche IA (récit, pédagogie, encouragement, synthèse) l'est totalement avec nos données déclaratives et l'API Claude. Notre score de risque maison n'est pas un recovery score physiologique : il doit être présenté comme un indicateur d'engagement et de suivi, jamais comme une mesure de l'état du corps.

### 8.1 Côté athlète

| # | Fonctionnalité | Donnée | Modèle conseillé | Valeur | Effort | Risque |
|---|---|---|---|---|---|---|
| A1 | Récap hebdo personnalisé en langage naturel | Séances faites vs prévues, sensations, objectif, métriques | Haiku | H | S | Faible (injecter les chiffres calculés pour éviter l'hallucination) |
| A2 | Briefing du jour avant une séance | Séance du jour, objectif de prépa | Haiku | H | S | Faible |
| A3 | Explication en clair du plan/de la prépa | Structure de prépa, finalité | Sonnet | H | M | Pédagogique, jamais prescriptif |
| A8 | Aide à la rédaction du compte-rendu (punchline, mise en forme du ressenti) | Sensations cochées, bribes de texte | Haiku | M | S | Faible |
| A5 | Détection de signaux de fatigue/moral dans le texte libre | Texte libre des comptes-rendus | Sonnet | H | M | Élevé : orienter vers le coach, jamais diagnostiquer |
| A9 | OCR de capture montre, pré-remplissage des métriques | Image uploadée | Sonnet (vision) | H | M | Confirmation humaine obligatoire |

### 8.2 Côté coach

| # | Fonctionnalité | Donnée | Modèle conseillé | Valeur | Effort | Risque |
|---|---|---|---|---|---|---|
| C1 | Résumé auto des retours de la semaine par groupe | Comptes-rendus + sensations de tous | Sonnet (1 appel mutualisé) | H | M | Faible |
| C2 | Alertes fatigue/risque expliquées en langage naturel | Score de risque + historique | Sonnet | H | M | Signal d'engagement, le coach reste juge |
| C3 | Qui a besoin d'un coup de fil (priorisation) | Silence de feedback + sensations + irrégularité | Sonnet | H | M | Moyen |
| C4 | Brouillon de réponse personnalisée à un athlète | Dernier compte-rendu + historique | Sonnet | H | M | Human-in-the-loop strict |
| C6 | Synthèse avant une séance collective | Sensations récentes + présence | Sonnet | H | M | Moyen |

### 8.3 Garde-fous IA
- Pas de conseil médical ni de diagnostic (Whoop s'est fait épingler par la FDA ; un disclaimer ne suffit pas). Rester sur encouragement et pédagogie.
- Notre score de risque n'est pas un état de santé : wording prudent côté athlète, aide à la priorisation côté coach.
- Human-in-the-loop sur toute sortie vers un athlète au nom du coach.
- Détection de détresse = orientation vers le coach, jamais interprétation.
- Vie privée : anonymiser/minimiser avant appel API, fournisseur sans rétention ni entraînement (cas de l'API Anthropic par défaut), information et opt-out des athlètes.
- Coût maîtrisé : Haiku pour le volume, Sonnet pour le raisonnement, appels mutualisés et mis en cache, fréquence plafonnée.

### 8.4 Top 5 IA (valeur/effort/risque)
1. C1, résumé hebdo des retours du groupe (coach).
2. A1, récap hebdo perso de l'athlète.
3. A2, briefing du jour avant séance.
4. C3/C2, qui recontacter et alertes expliquées (coach).
5. A9, OCR de capture, pré-remplissage des métriques (débloque le post-Strava).

---

## 9. Architecture et données

### 9.1 Retrait de Strava
Migration de DROP idempotente : désactiver le cron `strava-daily-sync`, exporter/rapatrier les activités matchées, retirer le front (garder `tsc` vert à chaque étape, ordre : pages consommatrices puis ProfileTabs puis App puis hook puis composants puis types), supprimer les edge functions, droper fonctions RPC puis policies puis tables, retirer les secrets et `VITE_STRAVA_CLIENT_ID`, supprimer `public/strava/`. Conserver `users.strava_id` (sauf décision de retrait total). Risque principal : fenêtre de désync front/functions, mitigée en déployant le front sans Strava avant de supprimer les functions.

### 9.2 OCR de capture
Recommandation : Claude vision via edge function `ocr-screenshot`, image éphémère jamais stockée (vie privée by design, RGPD). Le besoin est de comprendre une mise en page Strava ou Garmin variable, pas de l'OCR brut, d'où un modèle multimodal plutôt que Tesseract (plan B zéro coût/zéro réseau, mais fragile). Flux : upload compressé, edge function vérifie le JWT, appelle Claude avec sortie JSON forcée et un score de confiance, retourne au client qui pré-remplit le formulaire, l'athlète confirme (`metrics_source = 'ocr'`). Rappel : nano-banana est de la génération d'image, pas de l'OCR.

### 9.3 Gamification
Réactions : réutiliser le pattern Nordik existant (table `validation_reactions`, RLS auteur = auth.uid, notification via le canal existant). Streaks et compteurs : vue SQL calculée à la volée (échelle d'un club de quelques dizaines d'athlètes), pas de table ni de matérialisation. Badges : tables `achievements` (catalogue) et `user_achievements` (attributions, `UNIQUE(user_id, achievement_id)`), attribution par cron quotidien ou edge function en service_role (un client ne s'auto-attribue pas un badge). Pas de triggers complexes.

### 9.4 Affichage coach des sensations (correctif rapide)
Le Dashboard doit afficher `objective_reached` et `sensations` dans les retours, et lister aussi les comptes-rendus sans texte. Petit changement à fort impact, déblocable indépendamment.

---

## 10. Plan de chantier phasé

| Phase | Contenu | Effort |
|---|---|---|
| P0 | Retrait Strava propre (export + rapatriement des activités matchées). Saisie manuelle de métriques (extension `session_validations`). Sensations enrichies (sans casser l'enum). Affichage coach des sensations. Unification des deux surfaces en `SessionReportSheet` et nettoyage des couleurs hardcodées. | Retrait M, saisie S, unification M |
| P1 | Streaks (brancher `StreakFlame`) et `ProgressRing`. Réactions/kudos coach et athlètes (réutiliser Nordik). Coup de coeur hebdo. OCR de capture (Claude vision). Premières features IA : C1 (résumé hebdo coach), A1 (récap hebdo athlète), A2 (briefing du jour). | M |
| P2 | Mur du club, badges thématiques, récap mensuel/saisonnier. Branchement multi-provider (Garmin/Coros) qui rendra la saisie auto. Features IA avancées (A5 détection signaux, C3/C4 priorisation et brouillons de réponse). | M+ |

Séquencement recommandé : 1) retrait Strava (+ export), 2) saisie manuelle (socle de données pour OCR et gamification), 3) gamification (réactions et streaks d'abord, badges ensuite), 4) OCR, 5) couche IA en s'appuyant sur les données accumulées.

---

## 11. Métriques de succès et garde-fous transverses

KPIs : pourcentage de séances avec compte-rendu, pourcentage de comptes-rendus riches (avec métriques), nombre de séries actives, taux de réaction coach, part d'athlètes ayant reçu au moins une réaction (couverture, pas volume), rétention à 4 et 12 semaines, qualité du signal de risque (part d'athlètes en alerte avec feedback exploitable). Baselines à figer avant déploiement (les validations existent déjà, donc mesurable rétroactivement).

Garde-fous transverses : pas de classement de performance, séries et stats personnelles, sensations négatives jamais pénalisées, opt-in social, charge coach optionnelle et en 1 tap, IA non médicale et human-in-the-loop, vie privée des captures et des ressentis (stockage privé ou non-stockage, information des athlètes), RGPD mineurs pour le groupe enfants.

---

## 12. Risques et dépendances

| Risque | Mitigation |
|---|---|
| Fiabilité OCR (layouts variés) | Pré-remplissage seulement, confirmation humaine, commencer par les layouts fréquents, fallback manuel. |
| Charge coach (réactions deviennent une corvée) | Actions 1-tap, jamais obligatoires, pas de compteur culpabilisant, mesurer le temps coach. |
| Vie privée des captures (carte GPS, domicile) | Ne pas stocker l'image OCR ; pièces jointes choisies restent privées ; pas de mur public sans recadrage/opt-in. |
| RGPD mineurs | Consentement parental, minimisation (pas de FC par défaut pour les enfants), pas de photos publiques, droit à l'effacement. |
| Coût IA | Haiku par défaut, Sonnet à la demande, appels mutualisés et cache, plafonds. |
| Allégations santé | Rester sur encouragement/pédagogie, jamais de diagnostic, wording prudent du score de risque. |
| Perception "on enlève Strava" | Livrer la saisie de métriques dans la même release que le retrait, communiquer le gain (chiffres possédés + social). |
| Régression du score de risque | Ne pas modifier l'enum sensations ; nouveaux champs additifs et nullable ; tester `risk.ts`. |

Dépendances : nouvelle migration dans `supabase/migrations/` (jamais à la racine, cf. `supabase/MIGRATIONS.md`) ; brique IA Claude du backlog (prérequis OCR et features IA) ; multi-provider Garmin/Coros (P2) ; canal de notifications existant (réutilisé pour réactions et réponses).

---

## 13. Annexe, fichiers de référence

- Saisie sensations : `src/components/athlete/QuickSurveySheet.tsx`, `src/pages/athlete/SessionDetail.tsx`, `src/pages/Home.tsx`, `src/components/PersonalSessionForm.tsx`.
- Vue coach des retours : `src/pages/coach/Dashboard.tsx`, `src/components/coach/RiskScoreCard.tsx`.
- Agrégats sensations : `src/pages/athlete/Suivi.tsx`.
- Gamification (primitives) : `src/components/ui/StreakFlame.tsx`, `src/components/ui/ProgressRing.tsx`, `src/components/NordikButton.tsx`, `src/components/athlete/VmaRecordCelebration.tsx`, `src/lib/motion.ts`.
- Score de risque : `src/lib/risk.ts`.
- Modèle de données : `src/types/index.ts` (`SessionValidation`, `ObjectiveReached`, `Sensations`).
- Strava à retirer : `src/hooks/useStrava.ts`, `src/components/strava/`, `src/pages/StravaCallback.tsx`, `src/pages/athlete/{Profile,SessionDetail,AthleteDetail,Directory}.tsx`, `src/pages/{Home,Help}.tsx`, `src/components/athlete/ProfileTabs.tsx`, `src/App.tsx`, `src/contexts/{DataContext,AuthContext}.tsx`, `src/pages/coach/AthletesTab.tsx`, `src/types/index.ts` ; edge functions `supabase/functions/strava-*` ; migrations `20260317200000`..`230000` ; `public/strava/` ; `VITE_STRAVA_CLIENT_ID`.
- Migrations cibles : extension `session_validations` (métriques), `validation_reactions`, `achievements` + `user_achievements`, vue `athlete_gamification_stats`, migration de retrait Strava. Toutes dans `supabase/migrations/`.

---

Fin du document.
