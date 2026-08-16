/**
 * Échantillons de démonstration et prompt ChatGPT de la page Import.
 *
 * Sorti de la page pour être testable : le prompt doit toujours porter les
 * noms EXACTS des groupes du club, et l'échantillon JSON doit s'importer tel
 * quel (cf. importSamples.test.ts).
 */

import type { Group } from '../types';
import { PLAN_ALL_GROUPS, SESSION_TYPE_VALUES, type ImportFormat } from './importParser';

/** Échantillons pour démo (formats tabulaires : indépendants du club) */
export const STATIC_SAMPLES: Record<Exclude<ImportFormat, 'plan'>, string> = {
  canonical: [
    'Semaine\tDate\tJour\tType de séance\tContenu détaillé',
    "S1\t14/01\tMardi\tVMA courte\t20' EF + éducatifs | 8–12 x 1' rapide / 1' récup | 10' retour au calme",
    "S1\t16/01\tJeudi\tSeuil\t20' EF | 2 x 10' seuil (récup 5') | 10' retour au calme",
    'S1\t19/01\tDimanche\tSortie nature\t1h30 vallonné, D+ modéré, EF, finish progressif',
    "S2\t21/01\tMardi\tCôtes courtes\tÉchauffement | 10–15 x 30'' côte (récup descente)",
    "S2\t23/01\tJeudi\tActivation\t30–40' EF + 5 lignes droites",
  ].join('\n'),
  matrix: [
    'semaine\tDATE\tGR ESSENTIEL\tGR INTERMEDIAIRE\tGROUPE RENFORCE',
    "21\tlundi 25 mai 2026\tRENFO et/ou EF30'\tRENFO et/ou EF30'\tRENFO et EF45'",
    '21\tmardi 26 mai 2026\tEchauf | PISTE 2X6X200M | r200trotté R400\tEchauf | PISTE 2X8X200M | r200trotté R400\tEchauf | PISTE 2X10X200M | r200trotté R400',
    '21\tmercredi 27 mai 2026\tRENFO ou vélo\tRENFO ou vélo\tRENFO ou vélo',
    '21\tjeudi 28 mai 2026\tMoujan échauff | 4× seuil progressif pyramide 5\'\tMoujan échauff | 4× seuil progressif pyramide 5\'\tMoujan échauff | 4× seuil progressif pyramide 5\'',
    '21\tdimanche 31 mai 2026\t\t\tCaroux SL 2000D+',
  ].join('\n'),
  simple: [
    'Date\tSéance',
    '2025-12-15\tFooting 50 min + gainage',
    '2025-12-16\tVMA 12×300 m',
    '2025-12-18\tCôtes 12×25 s',
    '2025-12-20\tSeuil 3×8 min',
    '2025-12-21\tSortie 1h20 vallonnée',
  ].join('\n'),
  unknown: '',
};

/** Noms de groupes du club retenus pour l'échantillon (3 au plus, il illustre). */
export function sampleGroupNames(groups: Group[]): string[] {
  return groups.length > 0 ? groups.slice(0, 3).map(g => g.name) : [PLAN_ALL_GROUPS];
}

/**
 * Échantillon JSON construit avec les VRAIS noms de groupes du club : le coach
 * doit reconnaître ses groupes du premier coup d'oeil, et le fichier doit
 * s'importer tel quel.
 */
export function buildPlanSample(groups: Group[]): string {
  const names = sampleGroupNames(groups);
  const vma = [
    "20' EF + éducatifs | 8 x 1' rapide / 1' récup | 10' retour au calme",
    "20' EF + éducatifs | 10 x 1' rapide / 1' récup | 10' retour au calme",
    "20' EF + éducatifs | 12 x 1' rapide / 1' récup | 10' retour au calme",
  ];
  const longRun = [
    '1h15 vallonné en endurance, D+ modéré',
    '1h30 vallonné en endurance, D+ modéré',
    '1h45 vallonné, finish progressif',
  ];
  const byGroup = (contents: string[], names_: string[]) =>
    Object.fromEntries(names_.map((n, i) => [n, contents[Math.min(i, contents.length - 1)]]));
  // Sur la 2e date on omet volontairement le dernier groupe : c'est ainsi
  // qu'on signale « pas de séance ce jour-là pour ce groupe ».
  const sundayNames = names.length > 1 ? names.slice(0, -1) : names;

  return JSON.stringify(
    {
      version: 1,
      saison: '2026-2027',
      heure_par_defaut: '18:30',
      seances: [
        {
          date: '2026-09-08',
          titre: 'VMA courte',
          type: 'entrainement',
          groupes: byGroup(vma, names),
        },
        {
          date: '2026-09-13',
          heure: '09:00',
          titre: 'Sortie longue',
          type: 'sortie_longue',
          lieu: 'Massif de la Clape',
          groupes: byGroup(longRun, sundayNames),
        },
      ],
    },
    null,
    2
  );
}

/**
 * Prompt à coller dans ChatGPT. Généré avec les noms EXACTS de TOUS les
 * groupes du club : c'est ce qui garantit que la réponse s'importe sans
 * correspondance manuelle à faire ensuite.
 */
export function buildChatGptPrompt(groups: Group[]): string {
  const names = groups.length > 0 ? groups.map(g => g.name) : [PLAN_ALL_GROUPS];
  return [
    "Tu m'aides à construire le plan d'entraînement de mon club de running et trail.",
    "Objectif : produire un fichier JSON que j'importe directement dans l'application du club.",
    '',
    'Groupes de niveau du club, à reprendre EXACTEMENT tels quels comme clés de "groupes" :',
    ...names.map(n => `- ${n}`),
    `Utilise la clé "${PLAN_ALL_GROUPS}" pour une séance commune à tout le club.`,
    '',
    "Réponds avec UN SEUL objet JSON valide, sans aucun texte avant ni après, sans commentaire.",
    '',
    'Structure attendue :',
    buildPlanSample(groups),
    '',
    'Règles :',
    '- "date" : obligatoire, au format AAAA-MM-JJ.',
    '- "heure" : facultative, au format HH:MM. Sans elle, "heure_par_defaut" s\'applique (18:30 si absente).',
    '- "titre" : facultatif, court, c\'est le nom de la séance dans l\'appli.',
    `- "type" : facultatif, une valeur parmi ${SESSION_TYPE_VALUES.join(', ')}. Par défaut entrainement.`,
    '- "lieu" : facultatif, texte libre.',
    '- "groupes" : obligatoire, une version du contenu par groupe. Omets simplement la clé d\'un groupe qui n\'a pas de séance ce jour-là. N\'invente aucun autre nom de groupe.',
    '- Le contenu tient sur UNE seule ligne, avec un "|" entre chaque phase (échauffement, corps de séance, retour au calme). Pas de retour à la ligne, pas de liste à puces.',
    '- Un objet par date : répète-le autant de fois qu\'il y a de jours d\'entraînement.',
    '- Écris en français avec les accents, sans emoji.',
    '',
    'Ma saison : décris ici tes semaines, tes jours d\'entraînement, tes objectifs et tes courses cibles.',
  ].join('\n');
}
