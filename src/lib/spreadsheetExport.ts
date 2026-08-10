/**
 * Export tableur des séances du club (demande coach David : « il faudrait mettre
 * au point le téléchargement d'une partie de mon tableau Excel pour la prépa
 * groupe »).
 *
 * Format CSV et non .xlsx : le CSV se génère sans aucune dépendance, s'ouvre
 * d'un double-clic dans Excel et se recolle tel quel dans un tableau existant,
 * qui est l'usage visé. Les seules bibliothèques .xlsx légères disponibles sur
 * npm traînent des versions vulnérables ; on y reviendra si un besoin de mise en
 * forme (styles, plusieurs onglets) apparaît vraiment.
 *
 * Compatibilité Excel français : séparateur point-virgule (séparateur de liste
 * de la locale FR), BOM UTF-8 (sans quoi les accents sortent en mojibake) et
 * fins de ligne CRLF.
 *
 * Ce module est volontairement pur (aucun accès réseau ni DOM) : toutes les
 * données viennent du bootstrap déjà en mémoire (cf. contexts/data/bootstrap.ts).
 */

import { format, startOfDay, endOfDay } from 'date-fns';
import {
  ALLURE_ZONES, BLOCK_TYPES, SESSION_TYPE_LABELS,
  formatBlockSummary, isEffortZone, blockEffortLabel, getSessionLabel,
} from './calculations';
import { resolveSessionGroups } from './sessionGroups';
import type { GroupAttribution, ResolvedGroups } from './sessionGroups';
import type {
  Session, SessionBlock, SessionValidation, User, Group, SpecificPreparation,
  AllureZoneConfig,
} from '../types';

export interface SessionExportRow {
  id: string;
  date: string;
  title: string;
  type: string;
  groupLabel: string;
  /** Origine du rattachement, pour signaler les séances reconstituées dans l'UI. */
  attribution: GroupAttribution;
  description: string;
  content: string;
  validationsTotal: number;
  /** Clé = id de groupe, valeur = validations « faites » des athlètes de ce groupe. */
  validationsByGroup: Record<string, number>;
  /** Validations « faites » d'athlètes rattachés à aucun groupe. */
  validationsWithoutGroup: number;
}

export interface BuildRowsInput {
  sessions: Session[];
  validations: SessionValidation[];
  users: User[];
  groups: Group[];
  preparations: SpecificPreparation[];
  /** Zones du club (club_settings). Les zones par défaut servent de repli. */
  zones?: Record<string, AllureZoneConfig>;
  /** Bornes de période, incluses toutes les deux (comparées au jour civil). */
  start: Date;
  end: Date;
  /** Groupes retenus. `null` = tous les groupes. */
  groupIds: string[] | null;
}

/**
 * Intensité lisible d'un bloc : plage de % VMA, ou cible d'effort pour les zones
 * calibrées à l'effort (PMA en côte, où l'allure ne veut rien dire).
 *
 * La plage couvre tous les niveaux VMA (min des minimums, max des maximums) :
 * un export de plan groupe ne vise pas un athlète en particulier, contrairement
 * à l'affichage d'une séance dans l'app.
 */
export function blockIntensityLabel(block: SessionBlock, zones?: Record<string, AllureZoneConfig>): string {
  if (isEffortZone(block.allure)) return blockEffortLabel(block) ?? '';
  const zone = (zones || ALLURE_ZONES)[block.allure] || ALLURE_ZONES[block.allure];
  const min = Math.min(...zone.pctMinByLevel);
  const max = Math.max(...zone.pctMaxByLevel);
  return min === max ? `${min}% VMA` : `${min}-${max}% VMA`;
}

/**
 * Rend le champ jsonb `blocks` en une ligne lisible dans une cellule :
 * `Échauffement : 20' EF (55-70% VMA) | Travail : 8x400m VMA (95-110% VMA) R=1'30`
 */
export function formatBlocksForExport(blocks: SessionBlock[], zones?: Record<string, AllureZoneConfig>): string {
  return blocks
    .map(block => {
      const type = BLOCK_TYPES[block.type]?.label ?? block.type;
      const intensity = blockIntensityLabel(block, zones);
      const summary = formatBlockSummary(block, zones);
      return `${type} : ${summary}${intensity ? ` (${intensity})` : ''}`;
    })
    .join(' | ');
}

/** Une séance sans rattachement déductible concerne tout le club : jamais filtrée. */
function matchesGroupFilter(resolved: ResolvedGroups, selected: string[] | null): boolean {
  if (selected === null) return true;
  if (resolved.attribution === 'aucune') return true;
  return resolved.groupIds.some(id => selected.includes(id));
}

function groupLabel(
  session: Session,
  resolved: ResolvedGroups,
  groups: Group[],
  preparations: SpecificPreparation[],
): string {
  if (resolved.attribution === 'reconstituee') {
    const names = resolved.groupIds
      .map(id => groups.find(g => g.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .sort();
    return `${names.join(', ')} (reconstitué)`;
  }
  return getSessionLabel(session, groups, preparations);
}

/**
 * Construit les lignes de l'export : séances du club (les séances personnelles
 * des athlètes sont hors sujet ici) tombant dans la période et rattachées à l'un
 * des groupes retenus, triées par date croissante.
 */
export function buildSessionExportRows(input: BuildRowsInput): SessionExportRow[] {
  const { sessions, validations, users, groups, preparations, zones, start, end, groupIds } = input;

  const groupIdByUserId = new Map(users.map(u => [u.id, u.group_id]));
  const validationsBySession = new Map<string, SessionValidation[]>();
  for (const validation of validations) {
    const bucket = validationsBySession.get(validation.session_id);
    if (bucket) bucket.push(validation);
    else validationsBySession.set(validation.session_id, [validation]);
  }

  const from = startOfDay(start).getTime();
  const to = endOfDay(end).getTime();

  return sessions
    .filter(session => {
      if (session.is_personal) return false;
      const time = new Date(session.date).getTime();
      return time >= from && time <= to;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap(session => {
      const sessionValidations = validationsBySession.get(session.id) ?? [];
      const resolved = resolveSessionGroups(session, sessionValidations, groupIdByUserId);
      if (!matchesGroupFilter(resolved, groupIds)) return [];

      const done = sessionValidations.filter(v => v.status === 'done');
      const validationsByGroup: Record<string, number> = {};
      let validationsWithoutGroup = 0;
      for (const validation of done) {
        const groupId = groupIdByUserId.get(validation.user_id);
        if (groupId) validationsByGroup[groupId] = (validationsByGroup[groupId] ?? 0) + 1;
        else validationsWithoutGroup += 1;
      }

      return [{
        id: session.id,
        date: format(new Date(session.date), 'dd/MM/yyyy'),
        title: session.title,
        type: SESSION_TYPE_LABELS[session.session_type] ?? session.session_type,
        groupLabel: groupLabel(session, resolved, groups, preparations),
        attribution: resolved.attribution,
        description: session.description ?? '',
        content: formatBlocksForExport(session.blocks, zones),
        validationsTotal: done.length,
        validationsByGroup,
        validationsWithoutGroup,
      }];
    });
}

// --- Sérialisation CSV ---

const SEPARATOR = ';';

/**
 * Échappement RFC 4180 : guillemets seulement quand c'est nécessaire, pour que
 * les compteurs restent lus comme des nombres par Excel et non comme du texte.
 */
function csvCell(value: string | number): string {
  const raw = String(value).replace(/\r\n?/g, '\n');
  if (raw === '') return '';
  const needsQuotes =
    raw.includes(SEPARATOR) || raw.includes('"') || raw.includes('\n') || raw !== raw.trim();
  return needsQuotes ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map(cells => cells.map(csvCell).join(SEPARATOR));
  // BOM UTF-8 explicite : sans lui Excel lit le fichier en ANSI et casse les accents.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Colonnes fixes puis une colonne de validations par groupe exporté. La colonne
 * « sans groupe » n'apparaît que si elle porte une valeur : sinon le coach
 * verrait un total supérieur à la somme des colonnes sans explication.
 */
export function toCsvContent(rows: SessionExportRow[], columnGroups: Group[]): string {
  const hasWithoutGroup = rows.some(row => row.validationsWithoutGroup > 0);

  const headers = [
    'Date', 'Titre', 'Type', 'Groupe', 'Description', 'Contenu', 'Validations (total)',
    ...columnGroups.map(group => `Val. ${group.name}`),
    ...(hasWithoutGroup ? ['Val. sans groupe'] : []),
  ];

  const matrix = rows.map(row => [
    row.date, row.title, row.type, row.groupLabel, row.description, row.content, row.validationsTotal,
    ...columnGroups.map(group => row.validationsByGroup[group.id] ?? 0),
    ...(hasWithoutGroup ? [row.validationsWithoutGroup] : []),
  ]);

  return toCsv(headers, matrix);
}

export function exportFilename(start: Date, end: Date): string {
  return `narbo-nordik-seances_${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}.csv`;
}
