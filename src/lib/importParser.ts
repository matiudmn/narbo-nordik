/**
 * Parser d'import en lot — 3 formats supportés.
 *
 * Le coach colle un Excel via Cmd-V. L'app détecte le format et crée les
 * séances en lot, sans rien restructurer du contenu écrit par le coach.
 *
 * Formats supportés :
 *  1. CANONIQUE (5 colonnes Ventoux) — format de base validé par David.
 *     Semaine | Date | Jour | Type de séance | Contenu détaillé
 *
 *  2. MATRICE (jours × groupes) — format hebdo club.
 *     semaine | DATE | GR ESSENTIEL | GR INTERMEDIAIRE | GROUPE RENFORCE | ...
 *
 *  3. SIMPLE (date | séance) — format minimaliste type "Pierre Dugue".
 *     Date | Séance
 *
 * Le séparateur de colonnes est la tabulation (TSV), ce que produit
 * naturellement un copier-coller depuis Excel.
 *
 * Ref PRD v3 Feature 1.
 */

import type { Group } from '../types';

export type ImportFormat = 'canonical' | 'matrix' | 'simple' | 'unknown';

export type MacroType =
  | 'vma'
  | 'seuil'
  | 'cotes'
  | 'sl'
  | 'spe'
  | 'recup'
  | 'course'
  | 'other';

/** Une session parsée, prête à être insérée. */
export interface ParsedImportSession {
  /** Numéro de ligne dans le texte source (1-based). Pour les erreurs. */
  lineNumber: number;
  /** Marqueur de semaine, ex: "S1", "S21", "21". Optionnel. */
  week?: string;
  /** Date ISO YYYY-MM-DD résolue. */
  date: string;
  /** Date brute telle qu'écrite par le coach ("14/01", "lundi 25 mai 2026"). */
  dateRaw: string;
  /** Nom du jour si présent (Mardi, Jeudi...). Optionnel. */
  day?: string;
  /** Cible : groupe ou athlète. */
  targetType: 'group' | 'athlete' | 'unknown';
  /** Nom de groupe tel qu'écrit ("GR ESSENTIEL"). Optionnel. */
  targetGroupName?: string;
  /** Nom d'athlète si format objectif individuel. Optionnel. */
  targetAthleteName?: string;
  /** group.id résolu après matching. Null si non résolu. */
  groupId: string | null;
  /** Sous-type fin écrit par le coach ("VMA courte"). Optionnel. */
  subType?: string;
  /** Contenu libre exactement comme écrit par le coach. */
  contentText: string;
  /** Macro-type calculé automatiquement. */
  macroType: MacroType;
  /** Format détecté. */
  format: ImportFormat;
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

export interface ParseWarning {
  lineNumber: number;
  message: string;
}

export interface ParseResult {
  sessions: ParsedImportSession[];
  errors: ParseError[];
  warnings: ParseWarning[];
  detectedFormat: ImportFormat;
  /** Nombre de cellules ignorées volontairement (vides, "repos", "—"). */
  skipped: number;
}

/* ---------- Classification macro-type ---------- */

/**
 * Classifie un sub_type + contenu en macro-type.
 * Heuristique par mots-clés, basée sur les ~30 sous-types observés dans
 * les fichiers réels de David (Ventoux, Antoine MdMB, Pierre Dugue, hebdo).
 */
export function classifyMacroType(typeOrSubType: string, content: string): MacroType {
  const s = (typeOrSubType + ' ' + content).toLowerCase();
  if (/\bvma\b|fraction|fartlek/.test(s)) return 'vma';
  if (/seuil|\bsv1\b|\bsv2\b|tempo/.test(s)) return 'seuil';
  if (/côte|cote|montée|grimpe|moujan|mortitude/.test(s)) return 'cotes';
  if (/sortie longue|\bsl\b|long run|sortie nature|vallonn/.test(s)) return 'sl';
  if (/spécif|specif|allure (course|trail|object)/.test(s)) return 'spe';
  if (
    /récup|recup|allégé|allege|rappel|reprise|activation|repos|renfo|gainage|ppg|vélo|velo/.test(s)
  ) {
    return 'recup';
  }
  if (
    /trail de|france trail|championnat|objectif|course test|marathon|ventoux|mont[- ]blanc/.test(s)
  ) {
    return 'course';
  }
  return 'other';
}

/* ---------- Détection de format ---------- */

/**
 * Détecte le format à partir de la première ligne (header).
 * Heuristique légère : on regarde les noms de colonnes.
 */
export function detectFormat(headerLine: string): ImportFormat {
  const cols = headerLine.split('\t').map(c => c.trim().toLowerCase());
  if (cols.length === 0) return 'unknown';

  // CANONIQUE : 5 colonnes avec "Type de séance"
  if (cols.length >= 4 && cols.some(c => c.includes('type de séance') || c.includes('type de seance'))) {
    return 'canonical';
  }

  // MATRICE : colonne DATE puis "GR/GROUPE/GRP <nom>"
  const hasDateCol = cols.some(c => c === 'date');
  const hasGroupCol = cols.some(c => /^(gr|groupe|grp)\s+/i.test(c) || c.startsWith('gr ') || c.startsWith('groupe '));
  if (hasDateCol && hasGroupCol) return 'matrix';

  // SIMPLE : 2 colonnes, Date + Séance/Contenu
  if (cols.length === 2 && cols[0] === 'date' && (cols[1].includes('séance') || cols[1].includes('seance') || cols[1].includes('contenu'))) {
    return 'simple';
  }

  // Heuristique de fallback : 5 cols → canonical, 2 cols → simple, autre → matrix
  if (cols.length >= 5) return 'canonical';
  if (cols.length === 2) return 'simple';
  if (cols.length >= 3 && hasDateCol) return 'matrix';

  return 'unknown';
}

/* ---------- Helpers de parsing de date ---------- */

const MONTH_FR: Record<string, number> = {
  janvier: 1, jan: 1,
  février: 2, fevrier: 2, fev: 2, fév: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7, jul: 7,
  août: 8, aout: 8, aoû: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  décembre: 12, decembre: 12, déc: 12, dec: 12,
};

/**
 * Parse une date "raw" en YYYY-MM-DD. Supporte :
 *  - "14/01" (DD/MM, année = `defaultYear`)
 *  - "14/01/2026" (DD/MM/YYYY)
 *  - "2025-12-15" (déjà ISO)
 *  - "lundi 25 mai 2026" (texte français)
 *  - "25 mai 2026"
 * Renvoie null si non parsable.
 */
export function parseDateRaw(raw: string, defaultYear: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Déjà ISO ?
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  // DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM (sans année) → utiliser defaultYear
  const dmMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dmMatch) {
    const [, d, m] = dmMatch;
    return `${defaultYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "lundi 25 mai 2026" ou "25 mai 2026"
  const frMatch = trimmed.match(
    /(\d{1,2})\s+([a-zéûôîâàèùç]+)\s+(\d{4})/i
  );
  if (frMatch) {
    const [, d, monthName, y] = frMatch;
    const month = MONTH_FR[monthName.toLowerCase()];
    if (month) {
      return `${y}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // "25 mai" sans année → defaultYear
  const dmTextMatch = trimmed.match(/(\d{1,2})\s+([a-zéûôîâàèùç]+)$/i);
  if (dmTextMatch) {
    const [, d, monthName] = dmTextMatch;
    const month = MONTH_FR[monthName.toLowerCase()];
    if (month) {
      return `${defaultYear}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

/** Extrait le nom du jour ("lundi 25 mai 2026" → "Lundi") si présent. */
function extractDayName(raw: string): string | undefined {
  const match = raw.trim().toLowerCase().match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i);
  if (!match) return undefined;
  const day = match[1];
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Détermine si une cellule doit être ignorée (vide, "repos", "—"...). */
export function isIgnorableContent(content: string): boolean {
  const c = content.trim().toLowerCase();
  return c === '' || c === '—' || c === '-' || c === 'repos' || c === 'rest' || c === 'off';
}

/* ---------- Résolution groupe par nom ---------- */

/**
 * Normalise un nom de groupe ("GR ESSENTIEL" → "essentiel") pour comparaison.
 */
function normalizeGroupName(name: string): string {
  return name
    .replace(/^(gr|groupe|grp)\s+/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip accents
}

/**
 * Résout un nom de groupe vers un group.id. Matching tolérant aux accents
 * et au préfixe "GR" / "GROUPE".
 */
export function resolveGroupId(rawName: string, groups: Group[]): string | null {
  const target = normalizeGroupName(rawName);
  if (!target) return null;
  // Matching exact d'abord
  let found = groups.find(g => normalizeGroupName(g.name) === target);
  if (found) return found.id;
  // Matching partiel : le nom du groupe contient la cible ou inversement
  found = groups.find(
    g =>
      normalizeGroupName(g.name).includes(target) ||
      target.includes(normalizeGroupName(g.name))
  );
  return found ? found.id : null;
}

/* ---------- Parsing par format ---------- */

interface ParseOpts {
  defaultYear: number;
  groups: Group[];
}

/**
 * Format CANONIQUE : 5 colonnes Ventoux.
 * Semaine | Date | Jour | Type de séance | Contenu détaillé
 */
function parseCanonical(lines: string[], opts: ParseOpts): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const sessions: ParsedImportSession[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    if (cols.length < 4) {
      if (cols.some(c => c)) {
        errors.push({ lineNumber: i + 1, message: `Ligne avec ${cols.length} colonnes, 5 attendues` });
      }
      continue;
    }
    const [week, dateRaw, day, subType, ...contentParts] = cols;
    const content = (contentParts.join('\t') || '').trim();
    if (isIgnorableContent(content) && isIgnorableContent(subType)) {
      skipped++;
      continue;
    }
    const date = parseDateRaw(dateRaw, opts.defaultYear);
    if (!date) {
      errors.push({ lineNumber: i + 1, message: `Date non parsée : "${dateRaw}"` });
      continue;
    }
    sessions.push({
      lineNumber: i + 1,
      week: week || undefined,
      date,
      dateRaw,
      day: day || undefined,
      targetType: 'unknown',
      groupId: null,
      subType: subType || undefined,
      contentText: content,
      macroType: classifyMacroType(subType, content),
      format: 'canonical',
    });
  }

  if (sessions.length > 0 && !sessions.some(s => s.targetType !== 'unknown')) {
    warnings.push({
      lineNumber: 0,
      message:
        "Format canonique : aucun groupe/athlète cible n'est encodé dans le tableau. Précise la cible au moment de la création (étape suivante).",
    });
  }

  return { sessions, errors, warnings, detectedFormat: 'canonical', skipped };
}

/**
 * Format MATRICE : jours × groupes (header avec colonnes GR/GROUPE).
 */
function parseMatrix(lines: string[], opts: ParseOpts): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const sessions: ParsedImportSession[] = [];
  let skipped = 0;

  const header = lines[0].split('\t').map(c => c.trim());
  const dateIdx = header.findIndex(c => c.toLowerCase() === 'date');
  if (dateIdx === -1) {
    errors.push({ lineNumber: 1, message: 'Colonne DATE introuvable dans le header' });
    return { sessions: [], errors, warnings, detectedFormat: 'matrix', skipped };
  }
  const groupNames = header.slice(dateIdx + 1).filter(Boolean);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const dateRaw = (cols[dateIdx] || '').trim();
    const week = (cols[0] || '').trim();
    if (!dateRaw) continue;
    const date = parseDateRaw(dateRaw, opts.defaultYear);
    if (!date) {
      errors.push({ lineNumber: i + 1, message: `Date non parsée : "${dateRaw}"` });
      continue;
    }
    for (let g = 0; g < groupNames.length; g++) {
      const groupName = groupNames[g];
      const content = (cols[dateIdx + 1 + g] || '').trim();
      if (isIgnorableContent(content)) {
        skipped++;
        continue;
      }
      const groupId = resolveGroupId(groupName, opts.groups);
      if (!groupId) {
        warnings.push({
          lineNumber: i + 1,
          message: `Groupe "${groupName}" non trouvé dans la liste du club`,
        });
      }
      sessions.push({
        lineNumber: i + 1,
        week: week ? `S${week}` : undefined,
        date,
        dateRaw,
        day: extractDayName(dateRaw),
        targetType: 'group',
        targetGroupName: groupName,
        groupId,
        contentText: content,
        macroType: classifyMacroType('', content),
        format: 'matrix',
      });
    }
  }

  return { sessions, errors, warnings, detectedFormat: 'matrix', skipped };
}

/**
 * Format SIMPLE : 2 colonnes Date | Séance.
 */
function parseSimple(lines: string[], opts: ParseOpts): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const sessions: ParsedImportSession[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    if (cols.length < 2) {
      if (cols.some(c => c)) {
        errors.push({ lineNumber: i + 1, message: `Ligne avec ${cols.length} colonne(s), 2 attendues` });
      }
      continue;
    }
    const [dateRaw, content] = cols;
    if (isIgnorableContent(content)) {
      skipped++;
      continue;
    }
    const date = parseDateRaw(dateRaw, opts.defaultYear);
    if (!date) {
      errors.push({ lineNumber: i + 1, message: `Date non parsée : "${dateRaw}"` });
      continue;
    }
    sessions.push({
      lineNumber: i + 1,
      date,
      dateRaw,
      targetType: 'unknown',
      groupId: null,
      contentText: content,
      macroType: classifyMacroType('', content),
      format: 'simple',
    });
  }

  if (sessions.length > 0) {
    warnings.push({
      lineNumber: 0,
      message:
        'Format simple : pas de groupe/athlète encodé. Précise la cible au moment de la création (étape suivante).',
    });
  }

  return { sessions, errors, warnings, detectedFormat: 'simple', skipped };
}

/* ---------- Point d'entrée ---------- */

/**
 * Parse le texte collé selon le format détecté (ou forcé).
 */
export function parseImport(
  text: string,
  opts: ParseOpts & { forceFormat?: ImportFormat }
): ParseResult {
  if (!text.trim()) {
    return {
      sessions: [],
      errors: [],
      warnings: [],
      detectedFormat: 'unknown',
      skipped: 0,
    };
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      sessions: [],
      errors: [{ lineNumber: 1, message: 'Le tableau doit avoir au moins une ligne d\'en-tête + une ligne de données' }],
      warnings: [],
      detectedFormat: 'unknown',
      skipped: 0,
    };
  }

  const format = opts.forceFormat ?? detectFormat(lines[0]);

  switch (format) {
    case 'canonical':
      return parseCanonical(lines, opts);
    case 'matrix':
      return parseMatrix(lines, opts);
    case 'simple':
      return parseSimple(lines, opts);
    default:
      return {
        sessions: [],
        errors: [
          {
            lineNumber: 1,
            message:
              "Format non reconnu. Utilise un onglet entre les colonnes (copier-coller depuis Excel). Header attendu : 'Semaine, Date, Jour, Type, Contenu' ou 'semaine, DATE, GR <nom>, ...' ou 'Date, Séance'.",
          },
        ],
        warnings: [],
        detectedFormat: 'unknown',
        skipped: 0,
      };
  }
}

/* ---------- Constantes de présentation ---------- */

/** Métadonnées par macro-type pour l'affichage. */
export const MACRO_META: Record<MacroType, { label: string; color: string; bgClass: string; textClass: string }> = {
  vma:    { label: 'VMA',              color: '#EF4444', bgClass: 'bg-red-50',    textClass: 'text-red-700' },
  seuil:  { label: 'Seuil',            color: '#F59E0B', bgClass: 'bg-amber-50',  textClass: 'text-amber-700' },
  cotes:  { label: 'Côtes',            color: '#92400E', bgClass: 'bg-orange-50', textClass: 'text-orange-800' },
  sl:     { label: 'Sortie longue',    color: '#10B981', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700' },
  spe:    { label: 'Spécifique',       color: '#3B82F6', bgClass: 'bg-blue-50',   textClass: 'text-blue-700' },
  recup:  { label: 'Récup / Affûtage', color: '#737373', bgClass: 'bg-gray-100',  textClass: 'text-gray-700' },
  course: { label: 'Course / Test',    color: '#EAB308', bgClass: 'bg-yellow-50', textClass: 'text-yellow-800' },
  other:  { label: 'Autre',            color: '#A3A3A3', bgClass: 'bg-gray-50',   textClass: 'text-gray-600' },
};
