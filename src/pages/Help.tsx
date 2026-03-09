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
        <p className="font-semibold text-gray-900">Assiduite</p>
        <p>
          Un indicateur affiche votre taux de presence aux seances sur la saison en cours.
          Il se met a jour automatiquement lorsque vous validez votre participation a une seance.
        </p>
        <p className="font-semibold text-gray-900">Seances de la semaine</p>
        <p>
          La partie principale liste les seances prevues pour la semaine en cours. Chaque carte
          de seance indique la date, le type de seance, le groupe concerne et un apercu du contenu.
          Vous pouvez naviguer entre les semaines avec les fleches pour consulter les seances
          passees ou a venir.
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
          d'echauffement, un travail d'intervalle, du seuil, de la recuperation, etc.
          Pour chaque bloc, vous voyez la distance ou la duree, l'allure cible adaptee
          a votre VMA, et la zone d'intensite correspondante.
        </p>
        <p className="font-semibold text-gray-900">Allures personnalisees</p>
        <p>
          Les allures affichees dans les blocs sont calculees automatiquement a partir de
          votre VMA. Elles sont donc uniques et adaptees a votre niveau. Si votre VMA est
          mise a jour, toutes les allures se recalculent.
        </p>
        <p className="font-semibold text-gray-900">Valider sa participation</p>
        <p>
          Apres la seance, vous pouvez indiquer si vous etiez present ("Fait") ou absent
          ("Manque"). Cette validation alimente votre taux d'assiduite.
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
        <p className="font-semibold text-gray-900">Comment lire vos allures</p>
        <p>
          Les allures sont exprimees en min/km. Elles sont reparties en zones d'intensite :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Endurance fondamentale (60-65% VMA)</strong> : allure confortable, on peut parler</li>
          <li><strong>Endurance active (70-75% VMA)</strong> : rythme soutenu mais regulier</li>
          <li><strong>Seuil (80-85% VMA)</strong> : allure "inconfortablement confortable"</li>
          <li><strong>VMA (95-105% VMA)</strong> : effort intense, utilise pour les intervalles courts</li>
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
        <p className="font-semibold text-gray-900">Connexion Strava</p>
        <p>
          Si vous utilisez Strava, vous pouvez renseigner le lien vers votre profil Strava.
          Les autres membres pourront alors acceder a votre profil Strava depuis l'annuaire.
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
          Le dashboard signale les athletes qui n'ont pas participe a une seance depuis
          un certain temps. Cela vous permet de reprendre contact avec eux et de maintenir
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
          le titre, et le groupe concerne. Vous pouvez ensuite ajouter des blocs
          d'entrainement.
        </p>
        <p className="font-semibold text-gray-900">Blocs d'entrainement</p>
        <p>
          Chaque bloc definit une phase de la seance : echauffement, travail specifique,
          recuperation, retour au calme. Pour chaque bloc, vous definissez le type,
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
          en indiquant son nom et sa description. Exemple : "Preparation Marathon de Narbonne 2025".
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
          par exemple) et son numero de licence FFA. La mise a jour de la VMA recalcule
          automatiquement toutes les allures de l'athlete.
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
