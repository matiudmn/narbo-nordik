import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
  coachOnly?: boolean;
}

function Accordion({ section, isOpen, onToggle }: { section: Section; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{section.title}</span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-gray-700 space-y-3 border-t border-gray-50 pt-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

const athleteSections: Section[] = [
  {
    id: 'accueil',
    title: 'Accueil',
    content: (
      <>
        <p>
          La page d'accueil est ton tableau de bord personnel. Elle affiche en un coup d'oeil
          les informations essentielles de ta saison.
        </p>
        <p className="font-semibold text-gray-900">VMA et allures</p>
        <p>
          En haut de page, tu retrouves ta VMA actuelle ainsi que tes allures de référence
          calculées automatiquement. Ces allures correspondent aux différentes zones d'intensité
          utilisées lors des séances (endurance fondamentale, seuil, VMA, etc.).
        </p>
        <p className="font-semibold text-gray-900">Assiduité</p>
        <p>
          Un indicateur affiche ton taux de présence aux séances sur la saison en cours.
          Il se met à jour automatiquement lorsque tu valides ta participation à une séance.
        </p>
        <p className="font-semibold text-gray-900">Stats Strava</p>
        <p>
          Si ton compte Strava est connecté, un bloc orange affiche tes statistiques :
          nombre de sorties, kilomètres, heures et dénivelé positif sur l'année en cours,
          ainsi que tes stats cumulées depuis toujours et ton allure moyenne.
          Ces données se mettent à jour automatiquement chaque jour.
        </p>
        <p className="font-semibold text-gray-900">Séances de la semaine</p>
        <p>
          La partie principale liste les séances prévues pour la semaine en cours. Chaque carte
          de séance indique la date, le type de séance, le groupe concerné et un aperçu du contenu.
          Tu peux naviguer entre les semaines avec les flèches pour consulter les séances
          passées ou à venir.
        </p>
        <p className="font-semibold text-gray-900">Demander une préparation spécifique</p>
        <p>
          En bas de la page d'accueil, un bouton te permet de demander au coach une préparation
          spécifique pour un objectif précis (course, trail, etc.). Renseigne le nom de l'épreuve,
          la date, la distance, ton niveau de forme et un commentaire. La demande est envoyée
          directement au coach par WhatsApp.
        </p>
      </>
    ),
  },
  {
    id: 'séances',
    title: 'Séances d\'entrainement',
    content: (
      <>
        <p>
          En cliquant sur une séance, tu accèdès à son détail complet.
        </p>
        <p className="font-semibold text-gray-900">Structure d'une séance</p>
        <p>
          Chaque séance est composee de blocs d'entrainement. Un bloc peut etre une phase
          d'échauffement, un travail d'intervalle, du seuil, de la récupération, etc.
          Pour chaque bloc, tu vois la distance ou la durée, l'allure cible adaptee
          a ta VMA, et la zone d'intensité correspondante.
        </p>
        <p className="font-semibold text-gray-900">Allures personnalisees</p>
        <p>
          Les allures affichées dans les blocs sont calculées automatiquement à partir de
          ta VMA. Elles sont donc uniques et adaptees a ton niveau. Si ta VMA est
          mise à jour, toutes les allures se recalculent.
        </p>
        <p className="font-semibold text-gray-900">Lieu de la séance</p>
        <p>
          Si le coach a renseigne un lieu pour la séance, celui-ci est affiche avec un lien
          cliquable qui ouvre la localisation sur une carte.
        </p>
        <p className="font-semibold text-gray-900">Valider sa participation</p>
        <p>
          Après la séance, tu peux indiquer si tu étais présent·e ("Validée") ou absent·e
          ("Ratée"). Cette validation alimente ton taux d'assiduité.
        </p>
        <p className="font-semibold text-gray-900">Objectif atteint et sensations</p>
        <p>
          Lors de la validation, tu peux preciser si l'objectif de la séance a été atteint
          (Oui, Partiel ou Non) et qualifier tes sensations (Excellentes, Bonnes ou Mauvaises).
          Ces informations sont visibles par le coach et alimentent ton page de suivi.
        </p>
        <p className="font-semibold text-gray-900">Bouton Nordik</p>
        <p>
          Un bouton coeur est disponible sur chaque séance. Il tu permet de marquer une séance
          comme coup de coeur. C'est un moyen simple de signaler au coach les séances que tu
          avez particulierement appreciees.
        </p>
        <p className="font-semibold text-gray-900">Associer une activite Strava</p>
        <p>
          Si ton compte Strava est connecté, les activites Strava proches de la date de la séance
          (+/- 4 jours) sont affichées en bas de la page. Tu peux associer manuellement
          une activite a la séance pour l'enrichir avec tes données reelles : distance, temps,
          fréquence cardiaque, cadence, calories, dénivelé et appareil utilisé.
          Tu peux aussi dissocier une activite si tu tu es trompe.
        </p>
        <p className="font-semibold text-gray-900">Retour et photo</p>
        <p>
          Tu peux ajouter un retour ecrit sur la séance (ressenti, difficulte, remarques)
          et joindre une photo (capture d'ecran montre, photo de groupe, etc.).
          Le coach recoit ces retours et peut adapter les séances futures en consequence.
        </p>
      </>
    ),
  },
  {
    id: 'vma',
    title: 'VMA & Allures',
    content: (
      <>
        <p className="font-semibold text-gray-900">Qu'est-ce que la VMA ?</p>
        <p>
          La Vitesse Maximale Aerobie (VMA) est la vitesse a laquelle ton consommation
          d'oxygene atteint son maximum. C'est un indicateur fondamental de ton potentiel
          en course a pied. Elle sert de base au calcul de toutes tes allures d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Allures de référence (affichées sur ton profil)</p>
        <p>
          Les allures sont exprimees en min/km et calculées à partir d'un % de ta VMA :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>EF — Endurance fondamentale (~65% VMA)</strong> : allure confortable, on peut parler. Developpe le metabolisme aerobie de base.</li>
          <li><strong>AM — Aerobie modere (~75% VMA)</strong> : rythme soutenu mais regulier. Augmente le volume aerobie et l'economie de course.</li>
          <li><strong>SV1 — Seuil ventilatoire 1 (~78% VMA)</strong> : premier seuil lactique. Ameliore le confort sur les efforts prolonges.</li>
          <li><strong>SV2 — Seuil ventilatoire 2 (~85% VMA)</strong> : second seuil lactique. Travail de tolerance au lactate.</li>
          <li><strong>AS42 — Allure marathon (~77% VMA)</strong> : allure spécifique marathon. Efficacite lipidique et economie de course longue durée.</li>
          <li><strong>AS21 — Allure semi-marathon (~83% VMA)</strong> : allure spécifique semi. Gestion de l'effort sur la durée.</li>
          <li><strong>AS10 — Allure 10 km (~89% VMA)</strong> : allure spécifique 10 km. Stimule la puissance aerobie en competition courte.</li>
          <li><strong>VMA (100% VMA)</strong> : effort maximal aerobie. Utilise pour les intervalles courts et le developpement de la VO2max.</li>
        </ul>
        <p className="text-xs text-gray-500 italic">
          Les pourcentages ci-dessus sont des valeurs indicatives. Le coach peut ajuster ces valeurs
          depuis les parametres de l'application en fonction du niveau du groupe.
        </p>
        <p className="font-semibold text-gray-900">Zones d'entrainement (dans les séances)</p>
        <p>
          Dans les blocs de séance, les allures sont exprimees en fourchettes de % VMA :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>EF (60-65% VMA)</strong> : endurance fondamentale, footing leger</li>
          <li><strong>Endurance (70-80% VMA)</strong> : aerobie modere, footing soutenu</li>
          <li><strong>AS42 (75-85% VMA)</strong> : allure marathon et seuil</li>
          <li><strong>AS21 (83-90% VMA)</strong> : allure semi et seuil anaerobie</li>
          <li><strong>VMA (95-105% VMA)</strong> : effort intense, intervalles courts</li>
        </ul>
        <p className="font-semibold text-gray-900">Historique VMA</p>
        <p>
          La page "Historique VMA" (accessible depuis l'accueil) retrace l'évolution de ton
          VMA au fil du temps. Chaque test ou mise à jour par le coach est enregistre avec
          la date et la valeur. Un graphique tu permet de visualiser ton progression.
        </p>
      </>
    ),
  },
  {
    id: 'palmares',
    title: 'Palmares',
    content: (
      <>
        <p>
          Le palmares regroupe les resultats de courses des membres du club.
        </p>
        <p className="font-semibold text-gray-900">Ajouter un resultat</p>
        <p>
          Après une competition, tu peux ajouter ton resultat : nom de la course,
          date, distance, temps réalisé et type de course. Ce resultat sera visible par tous
          les membres du club. Tu peux ajouter un resultat depuis ton profil ou depuis
          la page Palmares.
        </p>
        <p className="font-semibold text-gray-900">Modifier un resultat</p>
        <p>
          Si tu as fait une erreur de saisie, tu peux modifier tes résultats à tout moment
          en cliquant sur l'icone crayon a cote du resultat. Le coach peut egalement modifier
          tes résultats si nécessaire.
        </p>
        <p className="font-semibold text-gray-900">Course a label</p>
        <p>
          Lors de l'ajout ou la modification d'un resultat, tu peux cocher la case "Course a label"
          si la course dispose d'un label officiel (FFA, World Athletics, etc.). Ces courses sont
          identifiees par une etoile dans le palmares.
        </p>
        <p className="font-semibold text-gray-900">Consulter les resultats</p>
        <p>
          Tu peux parcourir les resultats de tous les membres du club, filtrer par course
          ou par athlete. C'est un excellent moyen de suivre les performances du groupe
          et de se motiver mutuellement.
        </p>
      </>
    ),
  },
  {
    id: 'suivi',
    title: 'Suivi',
    content: (
      <>
        <p>
          La page Suivi est ton tableau de bord personnel d'entrainement. Elle est accessible
          depuis la barre de navigation en bas de l'ecran.
        </p>
        <p className="font-semibold text-gray-900">Heatmap annuelle</p>
        <p>
          Une carte de chaleur affiche ton activite sur l'année : chaque jour ou tu as
          valide une séance est colore. Plus la couleur est intense, plus tu as été actif.
          Cela permet de visualiser d'un coup d'oeil ton regularite.
        </p>
        <p className="font-semibold text-gray-900">Statistiques mensuelles</p>
        <p>
          Pour chaque mois, tu retrouves le détail de tes séances validées avec :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Objectif atteint</strong> : repartition entre Oui, Partiel et Non</li>
          <li><strong>Sensations</strong> : repartition entre Excellentes, Bonnes et Mauvaises</li>
        </ul>
        <p>
          Ces données proviennent de tes validations de séances et tu aident a suivre
          ton progression dans le temps.
        </p>
      </>
    ),
  },
  {
    id: 'historique',
    title: 'Historique des séances',
    content: (
      <>
        <p>
          La page Historique liste toutes tes séances passées avec leur statut :
          Fait, Manque ou En attente. Tu peux rechercher une séance par mot-cle
          et voir si un retour ou une photo est attache à chaque séance.
        </p>
      </>
    ),
  },
  {
    id: 'annuaire',
    title: 'Annuaire',
    content: (
      <>
        <p>
          L'annuaire liste tous les membres du club avec leur fiche individuelle.
        </p>
        <p className="font-semibold text-gray-900">Fiches membres</p>
        <p>
          Chaque fiche affiche le prenom, la photo, le groupe d'entrainement, la VMA,
          ainsi que des statistiques d'assiduité. Tu peux rechercher un membre par son nom
          grâce à la barre de recherche.
        </p>
        <p className="font-semibold text-gray-900">Groupe WhatsApp</p>
        <p>
          Un lien direct vers le groupe WhatsApp du club est disponible dans le header
          (icone bulle de conversation). Il permet d'echanger facilement avec les autres membres
          en dehors de l'application.
        </p>
        <p className="font-semibold text-gray-900">Navigation dans le header</p>
        <p>
          Le header en haut de l'ecran contient plusieurs raccourcis : cliquez sur le logo du club
          pour revenir a l'accueil, sur ta photo de profil pour acceder a ton profil,
          sur l'icone cloche pour les notifications, et sur l'icone "?" pour cette page d'aide.
        </p>
      </>
    ),
  },
  {
    id: 'club',
    title: 'Profil du Club',
    content: (
      <>
        <p>
          La page "Profil du Club" est une vitrine publique du Narbo Nordik Club.
        </p>
        <p>
          Elle présente le club, ses statistiques globales (nombre de membres, séances realisees,
          etc.) et les derniers resultats en competition. Cette page peut etre partagee
          avec des personnes exterieures au club pour leur donner un aperçu de l'activite.
        </p>
      </>
    ),
  },
  {
    id: 'profil',
    title: 'Profil & Compte',
    content: (
      <>
        <p>
          Ton profil personnel est accessible en cliquant sur ta photo de profil dans le header.
        </p>
        <p className="font-semibold text-gray-900">Informations personnelles</p>
        <p>
          Tu peux modifier ton prenom, nom, adresse email, numéro de telephone
          et photo de profil. Ces informations sont visibles par les autres membres du club.
        </p>
        <p className="font-semibold text-gray-900">Date de naissance et catégorie FFA</p>
        <p>
          En renseignant ta date de naissance, l'application calculé automatiquement
          ton catégorie FFA (Espoir, Senior, Master, etc.). Cette information apparait
          sur ton fiche dans l'annuaire.
        </p>
        <p className="font-semibold text-gray-900">Profil public</p>
        <p>
          Un interrupteur tu permet de rendre ton profil public ou prive. Quand il est
          public, les autres membres du club peuvent voir ta VMA, ton telephone
          et tes informations Strava. Quand il est prive, seul le coach y a acces.
        </p>
        <p className="font-semibold text-gray-900">Séances personnelles</p>
        <p>
          Depuis la section "Séances personnelles" de ton profil, tu peux créer
          tes propres séances d'entrainement (course, vélo, marche, renforcement, etc.)
          en dehors du planning du coach. Ces séances sont privees et n'apparaissent que
          pour tu.
        </p>
        <p className="font-semibold text-gray-900">Strava</p>
        <p>
          Une section dédiée Strava est disponible dans ton profil (après le Palmares).
          Elle regroupe trois actions : Synchroniser tes activites, consulter tes séances Strava,
          et gérer ton connexion. Voir la section "Strava" ci-dessous pour plus de détails.
        </p>
        <p className="font-semibold text-gray-900">Mot de passe</p>
        <p>
          Tu peux changer ton mot de passe à tout moment depuis la section dédiée
          de ton profil.
        </p>
        <p className="font-semibold text-gray-900">Notifications</p>
        <p>
          Gerez tes préférences de notifications push. Tu peux activer ou desactiver
          les notifications pour les nouvelles séances, les rappels, et les mises à jour du club.
        </p>
        <p className="font-semibold text-gray-900">Supprimer son compte</p>
        <p>
          En bas de ton profil, une option permet de supprimer definitivement ton compte.
          Cette action est irreversible. Un questionnaire de depart tu sera propose pour
          nous aider à ameliorer l'application. Tu devrez confirmer en tapant "SUPPRIMER".
        </p>
      </>
    ),
  },
  {
    id: 'strava',
    title: 'Strava',
    content: (
      <>
        <p>
          L'application peut se connecter a ton compte Strava pour synchroniser automatiquement
          tes activites sportives (marche nordique, course a pied, etc.).
        </p>
        <p className="font-semibold text-gray-900">Connecter son compte</p>
        <p>
          Depuis ton profil, descendez jusqu'à la section Strava (après le Palmares) et cliquez
          sur "Connecter Strava". Tu serez redirige vers Strava pour autoriser l'acces.
          L'application accède uniquement a tes activites et ton profil en lecture.
          Elle ne peut rien modifier sur ton compte Strava.
        </p>
        <p className="font-semibold text-gray-900">Les 3 boutons</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Synchroniser</strong> : recupere tes dernieres activites depuis Strava.
            Utile si tu venez de finir une séance et voulez la voir tout de suite.</li>
          <li><strong>Mes séances</strong> : affiche toutes tes activites Strava.
            Les activites non associees proposent deux actions : les associer a une séance
            existante du coach, ou créer une séance personnelle automatiquement liee.</li>
          <li><strong>Déconnecter</strong> : supprime le lien entre ton compte Strava et l'app.
            Tes séances restent intactes mais les données Strava ne seront plus visibles.</li>
        </ul>
        <p className="font-semibold text-gray-900">Synchronisation automatique</p>
        <p>
          Tes activites Strava sont synchronisees automatiquement tous les jours a 6h du matin.
          Tes sorties de la veille seront donc disponibles le lendemain sans rien faire.
          Tu peux aussi forcer une synchro manuelle à tout moment avec le bouton Synchroniser.
        </p>
        <p className="font-semibold text-gray-900">Associer une activite a une séance</p>
        <p>
          L'association est toujours manuelle : c'est tu qui choisissez quelle activite Strava
          correspond a quelle séance du coach. L'application propose les séances proches en date
          (+/- 4 jours) pour faciliter le choix. Une fois associee, les données reelles (distance,
          temps, FC, cadence, calories) apparaissent dans le détail de la séance.
        </p>
        <p className="font-semibold text-gray-900">Stats sur la page d'accueil</p>
        <p>
          Quand ton compte est connecté, un bloc orange s'affiche sur la page d'accueil avec
          tes stats annuelles (sorties, km, heures, D+), tes stats cumulées et ton allure moyenne.
        </p>
      </>
    ),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    content: (
      <>
        <p>
          L'application tu envoie des notifications pour tu tenir informe de l'activite du club.
        </p>
        <p className="font-semibold text-gray-900">Types de notifications</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nouvelle séance</strong> : quand le coach publié une nouvelle séance pour ton groupe</li>
          <li><strong>Modification de séance</strong> : quand une séance existante est modifiee</li>
          <li><strong>Rappel</strong> : rappel avant une séance à venir</li>
          <li><strong>Mise à jour VMA</strong> : quand ta VMA est mise à jour par le coach</li>
        </ul>
        <p className="font-semibold text-gray-900">Gestion des préférences</p>
        <p>
          Depuis ton profil, tu peux choisir quels types de notifications tu souhaites
          recevoir. Les notifications non lues sont signalees par un badge rouge sur l'icone
          de cloche dans le header.
        </p>
      </>
    ),
  },
];

const coachSections: Section[] = [
  {
    id: 'coach-dashboard',
    title: 'Dashboard Coach',
    coachOnly: true,
    content: (
      <>
        <p>
          Le dashboard coach est ton centre de pilotage. Il regroupe les indicateurs
          cles pour suivre l'activite du club.
        </p>
        <p className="font-semibold text-gray-900">KPIs</p>
        <p>
          En haut de page, des compteurs affichent les statistiques essentielles :
          nombre d'athletes actifs, séances creees sur la saison, taux de présence global,
          et retours recents des athletes.
        </p>
        <p className="font-semibold text-gray-900">Alertes d'inactivite</p>
        <p>
          Le dashboard signale les athletes inactifs avec trois niveaux de severite :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>+45 jours</strong> (rouge) : athlete a risque de decrochage</li>
          <li><strong>+20 jours</strong> (orange) : a relancer</li>
          <li><strong>+7 jours</strong> (jaune) : a surveiller</li>
        </ul>
        <p>
          Cela tu permet de reprendre contact avec eux et de maintenir
          la dynamique du groupe.
        </p>
        <p className="font-semibold text-gray-900">Retours athletes</p>
        <p>
          Les derniers retours postes par les athletes sur leurs séances sont affiches
          directement sur le dashboard. Tu peux ainsi suivre le ressenti général
          et adapter tes plans d'entrainement.
        </p>
      </>
    ),
  },
  {
    id: 'coach-sessions',
    title: 'Gestion des séances',
    coachOnly: true,
    content: (
      <>
        <p>
          L'editeur de séances tu permet de créer et gérer les entrainements du club.
        </p>
        <p className="font-semibold text-gray-900">Créer une séance</p>
        <p>
          Clique sur "Nouvelle séance" pour créer un entrainement. Renseigne la date,
          le titre, le groupe concerné et optionnellement un lieu avec un lien de localisation
          (Google Maps, etc.). Tu peux ensuite ajouter des blocs d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Blocs d'entrainement</p>
        <p>
          Chaque bloc définit une phase de la séance : échauffement, travail spécifique,
          récupération, retour au calme. Pour chaque bloc, tu définissez le type,
          la distance ou durée (heures, minutes, secondes), et le pourcentage de VMA.
          L'application calculera automatiquement l'allure personnalisee pour chaque athlete.
        </p>
        <p className="font-semibold text-gray-900">Affecter a un groupe ou une préparation</p>
        <p>
          Une séance peut etre affectee a un ou plusieurs groupes d'entrainement,
          ou a une préparation spécifique. Les athletes des groupes/préparations concernés
          verront automatiquement la séance sur leur accueil.
        </p>
        <p className="font-semibold text-gray-900">Modifier et supprimer</p>
        <p>
          Tu peux modifier une séance existante à tout moment. La suppression d'une séance
          est egalement possible mais irremediable : les validations et retours associes
          seront aussi supprimes.
        </p>
      </>
    ),
  },
  {
    id: 'coach-groups',
    title: 'Parametres — Groupes',
    coachOnly: true,
    content: (
      <>
        <p>
          Les groupes permettent d'organiser tes athletes par niveau ou objectif.
        </p>
        <p className="font-semibold text-gray-900">Créer un groupe</p>
        <p>
          Depuis l'onglet "Groupes" des parametres, cliquez sur "Ajouter" pour créer
          un nouveau groupe. Donnez-lui un nom explicite (ex: "Debutants", "Compet", "Trail").
        </p>
        <p className="font-semibold text-gray-900">Assigner des membres</p>
        <p>
          Clique sur un groupe pour voir et modifier sa composition. Tu peux ajouter
          ou retirer des athletes. Un athlete peut appartenir a plusieurs groupes.
        </p>
        <p className="font-semibold text-gray-900">Modifier et supprimer</p>
        <p>
          Le nom du groupe peut etre modifie à tout moment. La suppression d'un groupe
          ne supprime pas les athletes qui en faisaient partie, mais les séances
          affectees à ce groupe ne seront plus visibles pour ses anciens membres.
        </p>
      </>
    ),
  },
  {
    id: 'coach-préparations',
    title: 'Parametres — Préparations spécifiques',
    coachOnly: true,
    content: (
      <>
        <p>
          Les préparations spécifiques permettent de créer des plans d'entrainement
          dédiés a un objectif précis (marathon, trail, 10 km, etc.).
        </p>
        <p className="font-semibold text-gray-900">Créer une préparation</p>
        <p>
          Depuis l'onglet "Prep. Spécifiques" des parametres, creez une nouvelle préparation
          en indiquant son nom, sa description et la date de l'événement. Un compte a rebours
          (J-X) s'affiche automatiquement pour visualiser le temps restant avant l'echeance.
          Exemple : "Préparation Marathon de Narbonne 2025".
        </p>
        <p className="font-semibold text-gray-900">Inscrire des athletes</p>
        <p>
          Ajoute les athletes concernés a la préparation. Ils verront alors les séances
          specifiquement creees pour cette préparation sur leur accueil, en plus des séances
          de leur groupe habituel.
        </p>
        <p className="font-semibold text-gray-900">Séances dédiées</p>
        <p>
          Lors de la création d'une séance, tu peux l'affecter a une préparation spécifique
          plutot qu'a un groupe. Seuls les athletes inscrits à cette préparation verront la séance.
        </p>
      </>
    ),
  },
  {
    id: 'coach-palmares',
    title: 'Palmares des athletes',
    coachOnly: true,
    content: (
      <>
        <p>
          En tant que coach, tu as des droits etendus sur le palmares.
        </p>
        <p className="font-semibold text-gray-900">Ajouter un resultat pour un athlete</p>
        <p>
          Depuis la page Palmares, cliquez sur "Ajouter un resultat". Sélectionne l'athlete
          concerné dans la liste deroulante, puis renseignez les informations de la course.
          Utile si un athlete n'a pas encore saisi son resultat.
        </p>
        <p className="font-semibold text-gray-900">Modifier un resultat</p>
        <p>
          Tu peux modifier le resultat de n'importe quel athlete en cliquant sur l'icone
          crayon a cote du resultat. Cela permet de corriger des erreurs de saisie ou d'ajouter
          le statut "course a label".
        </p>
      </>
    ),
  },
  {
    id: 'coach-athletes',
    title: 'Parametres — Athletes',
    coachOnly: true,
    content: (
      <>
        <p>
          L'onglet "Athletes" des parametres centralise la gestion de tous les membres du club.
        </p>
        <p className="font-semibold text-gray-900">Ajouter un athlete</p>
        <p>
          Clique sur "Ajouter" pour créer un nouveau compte athlete. Renseigne le prenom,
          nom, email, et definissez un mot de passe initial. L'athlete pourra ensuite
          se connecter et modifier ses informations.
        </p>
        <p className="font-semibold text-gray-900">VMA et licence</p>
        <p>
          Depuis la fiche de chaque athlete, tu peux mettre à jour sa VMA (après un test
          par exemple) et son numéro de licence FFA. Lors de la mise à jour de la VMA, tu peux
          indiquer un motif (test piste, estimation, etc.) qui sera enregistre dans l'historique.
          La modification recalcule automatiquement toutes les allures de l'athlete.
        </p>
        <p className="font-semibold text-gray-900">Partager les identifiants</p>
        <p>
          Après avoir créé un compte athlete, tu peux copier et partager les identifiants
          de connexion (email + mot de passe initial) directement via WhatsApp ou un autre
          canal de communication.
        </p>
      </>
    ),
  },
  {
    id: 'coach-allures',
    title: 'Parametres — Allures',
    coachOnly: true,
    content: (
      <>
        <p>
          L'onglet "Allures" des parametres tu permet de configurer les pourcentages de VMA
          utilisés pour calculer les allures de référence et les zones d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Allures de référence</p>
        <p>
          Ce sont les allures affichées sur la fiche de chaque athlete (accueil et annuaire).
          Chaque allure correspond a un pourcentage fixe de la VMA. En modifiant un pourcentage,
          les allures de tous les athletes se recalculent instantanement.
        </p>
        <p className="font-semibold text-gray-900">Zones d'entrainement</p>
        <p>
          Les zones definissent les fourchettes de % VMA utilisées dans les blocs de séance
          (EF, Endurance, AS42, AS21, VMA). Elles determinent la plage d'allure affichée
          pour chaque bloc dans les séances.
        </p>
        <p className="font-semibold text-gray-900">Valeurs par defaut</p>
        <p>
          Un bouton permet de reinitialiser tous les pourcentages aux valeurs par defaut.
          Ces valeurs correspondent a un profil coureur intermediaire (VMA 12-14 km/h).
          Tu peux les ajuster selon le niveau global de ton groupe.
        </p>
      </>
    ),
  },
];

export default function Help() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const isCoach = user?.role === 'coach';

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle size={22} className="text-primary" />
        <h1 className="text-lg font-bold text-gray-900">Centre d'aide</h1>
      </div>

      <p className="text-sm text-gray-500">
        Retrouvez ici toutes les explications sur le fonctionnement de l'application.
        Clique sur une section pour la deployer.
      </p>

      <div className="space-y-2">
        {athleteSections.map(section => (
          <Accordion
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {isCoach && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Espace Coach</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-2">
            {coachSections.map(section => (
              <Accordion
                key={section.id}
                section={section}
                isOpen={openSection === section.id}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
