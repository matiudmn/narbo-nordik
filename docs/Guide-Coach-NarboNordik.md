# Guide de l'espace coach

**Narbo Nordik Club, application running et trail**

À jour du 31 août 2026 (remplace le guide de mars 2026).

Ce guide s'adresse aux coachs de la section, en particulier si tu viens de recevoir l'accès coach : ton compte n'a pas changé, mais l'application, elle, ne se présente plus pareil. Voici le tour du propriétaire.

**Sommaire**

1. Tu es coach maintenant : ce qui change
2. La navigation en bref
3. Créer une séance
4. Importer un plan complet (Excel ou ChatGPT)
5. Suivre les athlètes
6. La fiche athlète : le point d'édition unique
7. Réglages du club
8. Palmarès
9. Ton entraînement continue
10. Prudence : tes nouveaux accès engagent
11. Besoin d'aide

## 1. Tu es coach maintenant : ce qui change

- Tu te connectes avec **le même compte** qu'avant. Si l'interface n'a pas basculé, recharge l'application (ou ferme-la et rouvre-la).
- La barre du bas change : **Mon entraîn.**, **Suivi**, **Club**, **Planning**, **Athletes**, **Réglages**. Ton profil reste accessible en touchant ton avatar en haut de l'écran.
- Tu peux créer et modifier des séances, gérer les fiches des athlètes, les groupes, les prépas et le palmarès. Exactement les mêmes droits que les autres coachs.
- Tu gardes ton entraînement personnel : accueil, validation de tes séances, suivi, palmarès (voir la section 9).
- Tu ne reçois plus les notifications « Nouvelle séance » (normal : c'est toi qui les crées) ni le digest hebdo. À la place, tu reçois « Nouvel athlète inscrit » et le rappel des VMA manquantes.
- Tu n'apparais plus dans la liste des athlètes de Réglages ni dans le tableau de bord coach : c'est normal, ces listes ne montrent que les athlètes.

## 2. La navigation en bref

| Onglet (mobile) | Ce que tu y fais |
|---|---|
| Mon entraîn. | Ton programme et tes validations, comme avant |
| Suivi | Le tableau de bord coach : indicateurs, retours des athlètes, alertes |
| Club | Le profil du club : effectif, VMA, participation |
| Planning | Créer, modifier, dupliquer les séances de la semaine |
| Athletes | L'annuaire, porte d'entrée vers les fiches |
| Réglages | Groupes, prépas, athlètes, allures |

Sur ordinateur, le menu latéral ajoute des raccourcis directs : **Historique**, **Import Excel**, **Export tableur**, **Prépas spé** et **Profil**.

La recherche (loupe en haut, ou Cmd+K / Ctrl+K sur ordinateur) trouve un athlète, une séance, un palmarès ou une page de l'app.

## 3. Créer une séance

Trois chemins selon le besoin.

### Saisie rapide (une séance ponctuelle)

Depuis le tableau de bord Suivi, bouton **Nouvelle séance**. Tu renseignes : date et heure, groupe(s) concerné(s) (ou **Tous**), type (Entraînement, Sortie longue, Récupération, Course), titre et lieu si tu veux, et le contenu en texte libre. Astuce : sépare les phases avec « | », elles s'affichent en étapes côté athlète. Termine par **Créer la séance**.

### Le Planning (l'éditeur complet)

Onglet **Planning**, bouton **Nouvelle séance**. Une fenêtre te propose trois départs : **Template** (la bibliothèque de séances du club), **Semaine S-1** (dupliquer une séance de la semaine passée) ou **Vide**.

Dans l'éditeur :

- construis le programme par blocs : **+ Échauffement**, **+ Travail**, **+ Retour**, **+ Récup** ; chaque bloc porte l'allure (zone de VMA), la durée, les répétitions et le repos ;
- le sélecteur **Preview** affiche les durées et allures calculées pour un athlète donné, selon sa VMA : l'app fait la conversion pour chacun, tu n'as rien à calculer ;
- ajoute des consignes et, si tu veux, un RPE cible (1 à 10) ;
- publie avec **Publier la séance au club**. Les athlètes concernés sont notifiés. Si tu coches plusieurs groupes, l'app crée une séance par groupe et le bouton devient **Publier N séances (une par groupe)**.

Une séance réussie peut rejoindre la bibliothèque : lien **Enregistrer aussi comme template**, elle devient réutilisable par tous les coachs.

Sur chaque carte de séance de la semaine : **Modifier**, **Dupliquer** (recharge le formulaire) et **Supprimer** (confirmation demandée, action définitive). Le bouton **Partager la semaine** génère une image du programme, pratique pour le groupe WhatsApp.

### L'import en lot (un plan complet d'un coup)

Voir la section suivante : dès que tu as plus de quelques séances à saisir, c'est le bon outil.

## 4. Importer un plan complet (Excel ou ChatGPT)

Onglet **Import Excel** (menu latéral) ou lien « Importer un plan Excel » du tableau de bord. Quatre formats :

| Onglet | Pour quoi |
|---|---|
| Saison complète (JSON) | Un plan généré avec ChatGPT, une version par groupe |
| Plan structuré | 5 colonnes : Semaine, Date, Jour, Type, Contenu |
| Matrice | Jours en lignes, groupes en colonnes : toute la saison d'un coup |
| Liste simple | Deux colonnes : Date + Séance |

À savoir :

- tu peux **coller** directement depuis Excel, **déposer un fichier** (.xlsx, .xls, .csv, .tsv, .txt, .json) ou utiliser **Charger un fichier** ;
- la colonne **HEURE** est facultative ; sans elle, 18:30 est appliquée ;
- sur l'onglet JSON, le bouton **Copier le prompt ChatGPT** te donne un prompt prêt à l'emploi, déjà rempli avec les vrais noms des groupes du club ;
- si un nom de groupe du fichier n'est pas reconnu, l'import se bloque et te demande la correspondance : rien ne part de travers en silence ;
- les doublons (même date, groupe et contenu) sont ignorés par défaut ;
- les athlètes reçoivent **une seule** notification « Programme mis à jour », pas une par séance.

Un fichier Excel exemple du format Matrice existe : demande-le à David ou Matthieu.

## 5. Suivre les athlètes

### Le tableau de bord (onglet Suivi)

- Trois indicateurs : **Réalisation semaine**, **Séances cette semaine**, **Membres**.
- **Résumé de la semaine** : le bouton **Générer** produit une synthèse des retours des athlètes.
- **Athlètes à rappeler** : les athlètes silencieux depuis un moment, avec leur téléphone, pour un petit message.
- **Derniers retours athlètes** : les comptes rendus de séance (objectif, sensations, commentaire, photo). Tu peux y réagir, et le bouton **Coup de coeur** met un retour en avant sur l'accueil de tout le club.

### Le suivi mensuel

La page **Suivi** propose deux vues : **Suivi athletes** (les validations de tout le club, mois par mois) et **Mon suivi** (les tiennes). Attention à ne pas confondre : dans la barre du bas, l'onglet « Suivi » ouvre le tableau de bord ; cette page-ci se retrouve par la recherche, en tapant « Mon suivi ».

### Les notifications

La cloche en haut de l'écran signale les nouvelles inscriptions et les rappels de VMA manquante. La page ne garde que ce qu'il te reste à traiter : ouvrir une notification la marque comme lue et l'envoie dans le bloc replié **Déjà lues** en bas de page. Le bouton **Tout marquer comme lu** vide la liste d'un coup.

### Historique et export

**Historique** : toutes les séances d'un mois passé, avec participations. **Export tableur** : choisis une période et des groupes, puis **Télécharger** ; le fichier CSV s'ouvre dans Excel.

## 6. La fiche athlète : le point d'édition unique

Tout ce qui concerne un athlète se règle au même endroit : sa fiche.

- Chemin : **Athletes** (annuaire) > la fiche du coureur > **Modifier la fiche**. Ou **Réglages** > onglet **Athlètes**. Ou la recherche.
- Tu y règles : la **VMA** (avec la raison : test piste, estimation...), la **date de naissance** (la catégorie FFA se calcule seule), le **numéro de licence**, le **groupe**, les **prépas spécifiques**, le **téléphone** et la visibilité du profil dans l'annuaire.
- En tant que coach, tu vois aussi sur chaque fiche la **Régularité** (séances faites sur séances proposées) et le **calendrier annuel**. Les athlètes ne voient pas ces données entre eux. Esprit club : c'est un outil de suivi, pas de jugement ; certains athlètes ont choisi de ne pas afficher leur régularité chez eux, respecte ce choix dans tes messages.

## 7. Réglages du club

Quatre onglets dans **Réglages** :

- **Groupes** : créer, renommer, supprimer un groupe (les membres ne sont pas supprimés, ils passent « sans groupe »), et ranger les membres sans groupe.
- **Prépas** : les préparations spécifiques (une course cible, une échéance) avec leurs inscrits. Une séance peut viser une prépa plutôt qu'un groupe.
- **Athlètes** : le **code d'invitation** du club (à partager aux nouveaux ; **Régénérer** invalide immédiatement l'ancien), le bouton **Ajouter un athlète** (génère un mot de passe temporaire avec message d'invitation prêt à partager), les nouveaux membres à ranger (groupe, VMA), et la liste complète avec édition rapide de la VMA.
- **Allures** : les pourcentages de VMA de référence et les zones d'entraînement utilisées dans les calculs. N'y touche pas sans en parler aux autres coachs, ça change les allures affichées pour tout le monde.

## 8. Palmarès

Sur la page **Palmarès**, un coach peut **Ajouter** un résultat de course pour n'importe quel membre, et corriger ou supprimer n'importe quelle ligne. Les athlètes, eux, ne gèrent que leurs propres résultats.

## 9. Ton entraînement continue

Devenir coach ne t'enlève rien côté coureur :

- **Mon entraîn.** (accueil) : ton programme, et le bouton **J'ai fait ma séance** pour valider, avec le mini questionnaire objectif et sensations ;
- **Mon suivi** (page Suivi) : tes validations mois par mois et ton calendrier annuel ;
- ta **VMA** et ton **groupe** se modifient désormais directement depuis ton profil ;
- tes **séances personnelles** et ton palmarès restent dans ton profil, onglet séances ;
- tu restes visible dans l'annuaire et les statistiques du club, avec un badge Coach.

Petite différence : ta régularité s'affiche toujours sur ton accueil (le réglage « Suivre ma régularité » ne s'applique qu'aux athlètes).

## 10. Prudence : tes nouveaux accès engagent

- Tu as maintenant accès aux **données personnelles** des membres : téléphone, email, date de naissance, licence, et les dossiers d'adhésion. Usage club uniquement, on ne rediffuse rien à l'extérieur.
- Plusieurs actions sont **définitives**, l'app te demande confirmation mais il n'y a pas de corbeille : supprimer un athlète (fiche > Zone sensible : son profil, ses validations et son palmarès disparaissent), supprimer une séance, un groupe, une prépa ou un résultat de palmarès.
- Il n'existe **aucun écran pour changer le rôle** de quelqu'un (athlète ou coach) : si besoin, demande à Matthieu.
- Un changement dans **Allures** ou la **régénération du code d'invitation** touche tout le club : préviens les autres coachs avant.

## 11. Besoin d'aide

- La page **Aide** dans l'app (menu ou icône en haut).
- Le groupe WhatsApp du club (icône dans la barre du haut).
- David pour les questions d'entraînement et d'organisation, Matthieu pour les questions techniques.
