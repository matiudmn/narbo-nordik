# Notes pour les futurs chantiers, Narbo Nordik

Idées capturées en cours de session, à creuser et spécifier plus tard.

## 1. Statut athlète : Actif / Pause blessure / Réactivation
Un athlète doit pouvoir indiquer lui-même qu'il est en pause (blessure, arrêt temporaire) puis en réactivation.

Objectif : ne pas pénaliser ses statistiques (assiduité, série) ni fausser le suivi coach (score de risque) pendant une pause assumée.

À creuser :
- Modèle : un statut sur le profil (actif / pause / réactivation) avec dates de début/fin de pause.
- Impact sur le score de risque (`src/lib/risk.ts`) : neutraliser les jours de pause dans le calcul d'inactivité et de feedback manquant.
- Impact sur la série d'assiduité (`src/lib/streak.ts`) : une pause déclarée ne casse pas la série (cohérent avec la tolérance déjà prévue, mais ici explicite et plus long).
- Côté coach : voir clairement qui est en pause (badge), distinguer "décroche" de "en pause assumée".
- Reprise valorisée plutôt que pénalisée (badge "De retour", ton bienveillant).

## 2. IA côté coach = gain de temps massif sur la collecte
L'intégration de l'IA côté coach doit faire de l'app un énorme gain de temps dans la récupération des données et des sensations des athlètes.

Objectif : le coach ne passe plus de temps à agréger/lire manuellement ; l'IA collecte, résume et hiérarchise.

À creuser (voir aussi le PRD compte-rendu, volet C) :
- Résumé automatique hebdomadaire des retours et sensations du groupe (1 appel mutualisé).
- Détection des signaux faibles (fatigue, baisse de moral) dans le texte libre.
- Priorisation : qui recontacter, alertes expliquées en langage naturel.
- Brouillon de réponse personnalisée (human-in-the-loop).
- OCR de capture pour pré-remplir les métriques (réduit la saisie).
- Synthèse avant une séance collective (état du groupe).
- Garde-fous : pas de conseil médical, vie privée des ressentis, coût maîtrisé (Haiku par défaut).
