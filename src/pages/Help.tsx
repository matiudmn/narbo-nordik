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
          La page d'accueil est votre tableau de bord personnel. Elle affiche en un coup d'oeil
          les informations essentielles de votre saison.
        </p>
        <p className="font-semibold text-gray-900">VMA et allures</p>
        <p>
          En haut de page, vous retrouvez votre VMA actuelle ainsi que vos allures de reference
          calculees automatiquement. Ces allures correspondent aux differentes zones d'intensite
          utilisees lors des seances (endurance fondamentale, seuil, VMA, etc.).
        </p>
        <p className="font-semibold text-gray-900">Assiduité</p>
        <p>
          Un indicateur affiche votre taux de presence aux seances sur la saison en cours.
          Il se met a jour automatiquement lorsque vous validez votre participation a une seance.
        </p>
        <p className="font-semibold text-gray-900">Stats Strava</p>
        <p>
          Si votre compte Strava est connecte, un bloc orange affiche vos statistiques :
          nombre de sorties, kilometres, heures et denivele positif sur l'annee en cours,
          ainsi que vos stats cumulees depuis toujours et votre allure moyenne.
          Ces donnees se mettent a jour automatiquement chaque jour.
        </p>
        <p className="font-semibold text-gray-900">Seances de la semaine</p>
        <p>
          La partie principale liste les seances prevues pour la semaine en cours. Chaque carte
          de seance indique la date, le type de seance, le groupe concerne et un apercu du contenu.
          Vous pouvez naviguer entre les semaines avec les fleches pour consulter les seances
          passees ou a venir.
        </p>
        <p className="font-semibold text-gray-900">Demander une preparation specifique</p>
        <p>
          En bas de la page d'accueil, un bouton vous permet de demander au coach une preparation
          specifique pour un objectif precis (course, trail, etc.). Renseignez le nom de l'epreuve,
          la date, la distance, votre niveau de forme et un commentaire. La demande est envoyee
          directement au coach par WhatsApp.
        </p>
      </>
    ),
  },
  {
    id: 'seances',
    title: 'Seances d\'entrainement',
    content: (
      <>
        <p>
          En cliquant sur une seance, vous accedez a son detail complet.
        </p>
        <p className="font-semibold text-gray-900">Structure d'une seance</p>
        <p>
          Chaque seance est composee de blocs d'entrainement. Un bloc peut etre une phase
          d'échauffement, un travail d'intervalle, du seuil, de la récupération, etc.
          Pour chaque bloc, vous voyez la distance ou la duree, l'allure cible adaptee
          a votre VMA, et la zone d'intensite correspondante.
        </p>
        <p className="font-semibold text-gray-900">Allures personnalisees</p>
        <p>
          Les allures affichees dans les blocs sont calculees automatiquement a partir de
          votre VMA. Elles sont donc uniques et adaptees a votre niveau. Si votre VMA est
          mise a jour, toutes les allures se recalculent.
        </p>
        <p className="font-semibold text-gray-900">Lieu de la seance</p>
        <p>
          Si le coach a renseigne un lieu pour la seance, celui-ci est affiche avec un lien
          cliquable qui ouvre la localisation sur une carte.
        </p>
        <p className="font-semibold text-gray-900">Valider sa participation</p>
        <p>
          Apres la seance, vous pouvez indiquer si vous etiez present ("Fait") ou absent
          ("Manque"). Cette validation alimente votre taux d'assiduite.
        </p>
        <p className="font-semibold text-gray-900">Objectif atteint et sensations</p>
        <p>
          Lors de la validation, vous pouvez preciser si l'objectif de la seance a ete atteint
          (Oui, Partiel ou Non) et qualifier vos sensations (Excellentes, Bonnes ou Mauvaises).
          Ces informations sont visibles par le coach et alimentent votre page de suivi.
        </p>
        <p className="font-semibold text-gray-900">Bouton Nordik</p>
        <p>
          Un bouton coeur est disponible sur chaque seance. Il vous permet de marquer une seance
          comme coup de coeur. C'est un moyen simple de signaler au coach les seances que vous
          avez particulierement appreciees.
        </p>
        <p className="font-semibold text-gray-900">Associer une activite Strava</p>
        <p>
          Si votre compte Strava est connecte, les activites Strava proches de la date de la seance
          (+/- 4 jours) sont affichees en bas de la page. Vous pouvez associer manuellement
          une activite a la seance pour l'enrichir avec vos donnees reelles : distance, temps,
          frequence cardiaque, cadence, calories, denivele et appareil utilise.
          Vous pouvez aussi dissocier une activite si vous vous etes trompe.
        </p>
        <p className="font-semibold text-gray-900">Retour et photo</p>
        <p>
          Vous pouvez ajouter un retour ecrit sur la seance (ressenti, difficulte, remarques)
          et joindre une photo (capture d'ecran montre, photo de groupe, etc.).
          Le coach recoit ces retours et peut adapter les seances futures en consequence.
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
          La Vitesse Maximale Aerobie (VMA) est la vitesse a laquelle votre consommation
          d'oxygene atteint son maximum. C'est un indicateur fondamental de votre potentiel
          en course a pied. Elle sert de base au calcul de toutes vos allures d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Allures de reference (affichees sur votre profil)</p>
        <p>
          Les allures sont exprimees en min/km et calculees a partir d'un % de votre VMA :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>EF — Endurance fondamentale (~65% VMA)</strong> : allure confortable, on peut parler. Developpe le metabolisme aerobie de base.</li>
          <li><strong>AM — Aerobie modere (~75% VMA)</strong> : rythme soutenu mais regulier. Augmente le volume aerobie et l'economie de course.</li>
          <li><strong>SV1 — Seuil ventilatoire 1 (~78% VMA)</strong> : premier seuil lactique. Ameliore le confort sur les efforts prolonges.</li>
          <li><strong>SV2 — Seuil ventilatoire 2 (~85% VMA)</strong> : second seuil lactique. Travail de tolerance au lactate.</li>
          <li><strong>AS42 — Allure marathon (~77% VMA)</strong> : allure specifique marathon. Efficacite lipidique et economie de course longue duree.</li>
          <li><strong>AS21 — Allure semi-marathon (~83% VMA)</strong> : allure specifique semi. Gestion de l'effort sur la duree.</li>
          <li><strong>AS10 — Allure 10 km (~89% VMA)</strong> : allure specifique 10 km. Stimule la puissance aerobie en competition courte.</li>
          <li><strong>VMA (100% VMA)</strong> : effort maximal aerobie. Utilise pour les intervalles courts et le developpement de la VO2max.</li>
        </ul>
        <p className="text-xs text-gray-500 italic">
          Les pourcentages ci-dessus sont des valeurs indicatives. Le coach peut ajuster ces valeurs
          depuis les parametres de l'application en fonction du niveau du groupe.
        </p>
        <p className="font-semibold text-gray-900">Zones d'entrainement (dans les seances)</p>
        <p>
          Dans les blocs de seance, les allures sont exprimees en fourchettes de % VMA :
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
          La page "Historique VMA" (accessible depuis l'accueil) retrace l'evolution de votre
          VMA au fil du temps. Chaque test ou mise a jour par le coach est enregistre avec
          la date et la valeur. Un graphique vous permet de visualiser votre progression.
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
          Apres une competition, vous pouvez ajouter votre resultat : nom de la course,
          date, distance, temps realise et type de course. Ce resultat sera visible par tous
          les membres du club. Vous pouvez ajouter un resultat depuis votre profil ou depuis
          la page Palmares.
        </p>
        <p className="font-semibold text-gray-900">Modifier un resultat</p>
        <p>
          Si vous avez fait une erreur de saisie, vous pouvez modifier vos resultats a tout moment
          en cliquant sur l'icone crayon a cote du resultat. Le coach peut egalement modifier
          vos resultats si necessaire.
        </p>
        <p className="font-semibold text-gray-900">Course a label</p>
        <p>
          Lors de l'ajout ou la modification d'un resultat, vous pouvez cocher la case "Course a label"
          si la course dispose d'un label officiel (FFA, World Athletics, etc.). Ces courses sont
          identifiees par une etoile dans le palmares.
        </p>
        <p className="font-semibold text-gray-900">Consulter les resultats</p>
        <p>
          Vous pouvez parcourir les resultats de tous les membres du club, filtrer par course
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
          La page Suivi est votre tableau de bord personnel d'entrainement. Elle est accessible
          depuis la barre de navigation en bas de l'ecran.
        </p>
        <p className="font-semibold text-gray-900">Heatmap annuelle</p>
        <p>
          Une carte de chaleur affiche votre activite sur l'annee : chaque jour ou vous avez
          valide une seance est colore. Plus la couleur est intense, plus vous avez ete actif.
          Cela permet de visualiser d'un coup d'oeil votre regularite.
        </p>
        <p className="font-semibold text-gray-900">Statistiques mensuelles</p>
        <p>
          Pour chaque mois, vous retrouvez le detail de vos seances validees avec :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Objectif atteint</strong> : repartition entre Oui, Partiel et Non</li>
          <li><strong>Sensations</strong> : repartition entre Excellentes, Bonnes et Mauvaises</li>
        </ul>
        <p>
          Ces donnees proviennent de vos validations de seances et vous aident a suivre
          votre progression dans le temps.
        </p>
      </>
    ),
  },
  {
    id: 'historique',
    title: 'Historique des seances',
    content: (
      <>
        <p>
          La page Historique liste toutes vos seances passees avec leur statut :
          Fait, Manque ou En attente. Vous pouvez rechercher une seance par mot-cle
          et voir si un retour ou une photo est attache a chaque seance.
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
          ainsi que des statistiques d'assiduite. Vous pouvez rechercher un membre par son nom
          grace a la barre de recherche.
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
          pour revenir a l'accueil, sur votre photo de profil pour acceder a votre profil,
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
          Elle presente le club, ses statistiques globales (nombre de membres, seances realisees,
          etc.) et les derniers resultats en competition. Cette page peut etre partagee
          avec des personnes exterieures au club pour leur donner un apercu de l'activite.
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
          Votre profil personnel est accessible en cliquant sur votre photo de profil dans le header.
        </p>
        <p className="font-semibold text-gray-900">Informations personnelles</p>
        <p>
          Vous pouvez modifier votre prenom, nom, adresse email, numero de telephone
          et photo de profil. Ces informations sont visibles par les autres membres du club.
        </p>
        <p className="font-semibold text-gray-900">Date de naissance et categorie FFA</p>
        <p>
          En renseignant votre date de naissance, l'application calcule automatiquement
          votre categorie FFA (Espoir, Senior, Master, etc.). Cette information apparait
          sur votre fiche dans l'annuaire.
        </p>
        <p className="font-semibold text-gray-900">Profil public</p>
        <p>
          Un interrupteur vous permet de rendre votre profil public ou prive. Quand il est
          public, les autres membres du club peuvent voir votre VMA, votre telephone
          et vos informations Strava. Quand il est prive, seul le coach y a acces.
        </p>
        <p className="font-semibold text-gray-900">Seances personnelles</p>
        <p>
          Depuis la section "Seances personnelles" de votre profil, vous pouvez creer
          vos propres seances d'entrainement (course, velo, marche, renforcement, etc.)
          en dehors du planning du coach. Ces seances sont privees et n'apparaissent que
          pour vous.
        </p>
        <p className="font-semibold text-gray-900">Strava</p>
        <p>
          Une section dediee Strava est disponible dans votre profil (apres le Palmares).
          Elle regroupe trois actions : Synchroniser vos activites, consulter vos seances Strava,
          et gerer votre connexion. Voir la section "Strava" ci-dessous pour plus de details.
        </p>
        <p className="font-semibold text-gray-900">Mot de passe</p>
        <p>
          Vous pouvez changer votre mot de passe a tout moment depuis la section dediee
          de votre profil.
        </p>
        <p className="font-semibold text-gray-900">Notifications</p>
        <p>
          Gerez vos preferences de notifications push. Vous pouvez activer ou desactiver
          les notifications pour les nouvelles seances, les rappels, et les mises a jour du club.
        </p>
        <p className="font-semibold text-gray-900">Supprimer son compte</p>
        <p>
          En bas de votre profil, une option permet de supprimer definitivement votre compte.
          Cette action est irreversible. Un questionnaire de depart vous sera propose pour
          nous aider a ameliorer l'application. Vous devrez confirmer en tapant "SUPPRIMER".
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
          L'application peut se connecter a votre compte Strava pour synchroniser automatiquement
          vos activites sportives (marche nordique, course a pied, etc.).
        </p>
        <p className="font-semibold text-gray-900">Connecter son compte</p>
        <p>
          Depuis votre profil, descendez jusqu'a la section Strava (apres le Palmares) et cliquez
          sur "Connecter Strava". Vous serez redirige vers Strava pour autoriser l'acces.
          L'application accede uniquement a vos activites et votre profil en lecture.
          Elle ne peut rien modifier sur votre compte Strava.
        </p>
        <p className="font-semibold text-gray-900">Les 3 boutons</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Synchroniser</strong> : recupere vos dernieres activites depuis Strava.
            Utile si vous venez de finir une seance et voulez la voir tout de suite.</li>
          <li><strong>Mes seances</strong> : affiche toutes vos activites Strava.
            Les activites non associees proposent deux actions : les associer a une seance
            existante du coach, ou creer une seance personnelle automatiquement liee.</li>
          <li><strong>Deconnecter</strong> : supprime le lien entre votre compte Strava et l'app.
            Vos seances restent intactes mais les donnees Strava ne seront plus visibles.</li>
        </ul>
        <p className="font-semibold text-gray-900">Synchronisation automatique</p>
        <p>
          Vos activites Strava sont synchronisees automatiquement tous les jours a 6h du matin.
          Vos sorties de la veille seront donc disponibles le lendemain sans rien faire.
          Vous pouvez aussi forcer une synchro manuelle a tout moment avec le bouton Synchroniser.
        </p>
        <p className="font-semibold text-gray-900">Associer une activite a une seance</p>
        <p>
          L'association est toujours manuelle : c'est vous qui choisissez quelle activite Strava
          correspond a quelle seance du coach. L'application propose les seances proches en date
          (+/- 4 jours) pour faciliter le choix. Une fois associee, les donnees reelles (distance,
          temps, FC, cadence, calories) apparaissent dans le detail de la seance.
        </p>
        <p className="font-semibold text-gray-900">Stats sur la page d'accueil</p>
        <p>
          Quand votre compte est connecte, un bloc orange s'affiche sur la page d'accueil avec
          vos stats annuelles (sorties, km, heures, D+), vos stats cumulees et votre allure moyenne.
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
          L'application vous envoie des notifications pour vous tenir informe de l'activite du club.
        </p>
        <p className="font-semibold text-gray-900">Types de notifications</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nouvelle seance</strong> : quand le coach publie une nouvelle seance pour votre groupe</li>
          <li><strong>Modification de seance</strong> : quand une seance existante est modifiee</li>
          <li><strong>Rappel</strong> : rappel avant une seance a venir</li>
          <li><strong>Mise a jour VMA</strong> : quand votre VMA est mise a jour par le coach</li>
        </ul>
        <p className="font-semibold text-gray-900">Gestion des preferences</p>
        <p>
          Depuis votre profil, vous pouvez choisir quels types de notifications vous souhaitez
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
          Le dashboard coach est votre centre de pilotage. Il regroupe les indicateurs
          cles pour suivre l'activite du club.
        </p>
        <p className="font-semibold text-gray-900">KPIs</p>
        <p>
          En haut de page, des compteurs affichent les statistiques essentielles :
          nombre d'athletes actifs, seances creees sur la saison, taux de presence global,
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
          Cela vous permet de reprendre contact avec eux et de maintenir
          la dynamique du groupe.
        </p>
        <p className="font-semibold text-gray-900">Retours athletes</p>
        <p>
          Les derniers retours postes par les athletes sur leurs seances sont affiches
          directement sur le dashboard. Vous pouvez ainsi suivre le ressenti general
          et adapter vos plans d'entrainement.
        </p>
      </>
    ),
  },
  {
    id: 'coach-sessions',
    title: 'Gestion des seances',
    coachOnly: true,
    content: (
      <>
        <p>
          L'editeur de seances vous permet de creer et gerer les entrainements du club.
        </p>
        <p className="font-semibold text-gray-900">Creer une seance</p>
        <p>
          Cliquez sur "Nouvelle seance" pour creer un entrainement. Renseignez la date,
          le titre, le groupe concerne et optionnellement un lieu avec un lien de localisation
          (Google Maps, etc.). Vous pouvez ensuite ajouter des blocs d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Blocs d'entrainement</p>
        <p>
          Chaque bloc définit une phase de la séance : échauffement, travail spécifique,
          récupération, retour au calme. Pour chaque bloc, vous définissez le type,
          la distance ou duree (heures, minutes, secondes), et le pourcentage de VMA.
          L'application calculera automatiquement l'allure personnalisee pour chaque athlete.
        </p>
        <p className="font-semibold text-gray-900">Affecter a un groupe ou une preparation</p>
        <p>
          Une seance peut etre affectee a un ou plusieurs groupes d'entrainement,
          ou a une preparation specifique. Les athletes des groupes/preparations concernes
          verront automatiquement la seance sur leur accueil.
        </p>
        <p className="font-semibold text-gray-900">Modifier et supprimer</p>
        <p>
          Vous pouvez modifier une seance existante a tout moment. La suppression d'une seance
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
          Les groupes permettent d'organiser vos athletes par niveau ou objectif.
        </p>
        <p className="font-semibold text-gray-900">Creer un groupe</p>
        <p>
          Depuis l'onglet "Groupes" des parametres, cliquez sur "Ajouter" pour creer
          un nouveau groupe. Donnez-lui un nom explicite (ex: "Debutants", "Compet", "Trail").
        </p>
        <p className="font-semibold text-gray-900">Assigner des membres</p>
        <p>
          Cliquez sur un groupe pour voir et modifier sa composition. Vous pouvez ajouter
          ou retirer des athletes. Un athlete peut appartenir a plusieurs groupes.
        </p>
        <p className="font-semibold text-gray-900">Modifier et supprimer</p>
        <p>
          Le nom du groupe peut etre modifie a tout moment. La suppression d'un groupe
          ne supprime pas les athletes qui en faisaient partie, mais les seances
          affectees a ce groupe ne seront plus visibles pour ses anciens membres.
        </p>
      </>
    ),
  },
  {
    id: 'coach-preparations',
    title: 'Parametres — Preparations specifiques',
    coachOnly: true,
    content: (
      <>
        <p>
          Les preparations specifiques permettent de creer des plans d'entrainement
          dedies a un objectif precis (marathon, trail, 10 km, etc.).
        </p>
        <p className="font-semibold text-gray-900">Creer une preparation</p>
        <p>
          Depuis l'onglet "Prep. Specifiques" des parametres, creez une nouvelle preparation
          en indiquant son nom, sa description et la date de l'evenement. Un compte a rebours
          (J-X) s'affiche automatiquement pour visualiser le temps restant avant l'echeance.
          Exemple : "Preparation Marathon de Narbonne 2025".
        </p>
        <p className="font-semibold text-gray-900">Inscrire des athletes</p>
        <p>
          Ajoutez les athletes concernes a la preparation. Ils verront alors les seances
          specifiquement creees pour cette preparation sur leur accueil, en plus des seances
          de leur groupe habituel.
        </p>
        <p className="font-semibold text-gray-900">Seances dediees</p>
        <p>
          Lors de la creation d'une seance, vous pouvez l'affecter a une preparation specifique
          plutot qu'a un groupe. Seuls les athletes inscrits a cette preparation verront la seance.
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
          En tant que coach, vous avez des droits etendus sur le palmares.
        </p>
        <p className="font-semibold text-gray-900">Ajouter un resultat pour un athlete</p>
        <p>
          Depuis la page Palmares, cliquez sur "Ajouter un resultat". Selectionnez l'athlete
          concerne dans la liste deroulante, puis renseignez les informations de la course.
          Utile si un athlete n'a pas encore saisi son resultat.
        </p>
        <p className="font-semibold text-gray-900">Modifier un resultat</p>
        <p>
          Vous pouvez modifier le resultat de n'importe quel athlete en cliquant sur l'icone
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
          Cliquez sur "Ajouter" pour creer un nouveau compte athlete. Renseignez le prenom,
          nom, email, et definissez un mot de passe initial. L'athlete pourra ensuite
          se connecter et modifier ses informations.
        </p>
        <p className="font-semibold text-gray-900">VMA et licence</p>
        <p>
          Depuis la fiche de chaque athlete, vous pouvez mettre a jour sa VMA (apres un test
          par exemple) et son numero de licence FFA. Lors de la mise a jour de la VMA, vous pouvez
          indiquer un motif (test piste, estimation, etc.) qui sera enregistre dans l'historique.
          La modification recalcule automatiquement toutes les allures de l'athlete.
        </p>
        <p className="font-semibold text-gray-900">Partager les identifiants</p>
        <p>
          Apres avoir cree un compte athlete, vous pouvez copier et partager les identifiants
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
          L'onglet "Allures" des parametres vous permet de configurer les pourcentages de VMA
          utilises pour calculer les allures de reference et les zones d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Allures de reference</p>
        <p>
          Ce sont les allures affichees sur la fiche de chaque athlete (accueil et annuaire).
          Chaque allure correspond a un pourcentage fixe de la VMA. En modifiant un pourcentage,
          les allures de tous les athletes se recalculent instantanement.
        </p>
        <p className="font-semibold text-gray-900">Zones d'entrainement</p>
        <p>
          Les zones definissent les fourchettes de % VMA utilisees dans les blocs de seance
          (EF, Endurance, AS42, AS21, VMA). Elles determinent la plage d'allure affichee
          pour chaque bloc dans les seances.
        </p>
        <p className="font-semibold text-gray-900">Valeurs par defaut</p>
        <p>
          Un bouton permet de reinitialiser tous les pourcentages aux valeurs par defaut.
          Ces valeurs correspondent a un profil coureur intermediaire (VMA 12-14 km/h).
          Vous pouvez les ajuster selon le niveau global de votre groupe.
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
        Cliquez sur une section pour la deployer.
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
