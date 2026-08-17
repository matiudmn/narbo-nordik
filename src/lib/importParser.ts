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
 *  4. PLAN (JSON saison) : une saison entière, chaque séance portant déjà sa
 *     variante par groupe de niveau. C'est le format que le coach fait
 *     produire à ChatGPT puis colle (ou dépose en fichier .json) ici.
 *
 * Le séparateur de colonnes des 3 premiers formats est la tabulation (TSV),
 * ce que produit naturellement un copier-coller depuis Excel. Un CSV (`;` ou
 * `,`) ou un fichier .xlsx est ramené à ce TSV par `normalizeTabular`.
 *
 * Ref PRD v3 Feature 1.
 */

import type { Group, SessionType } from '../types';

export type ImportFormat = 'canonical' | 'matrix' | 'simple' | 'plan' | 'unknown';

/** Valeurs acceptées par `sessions.session_type` (contrainte CHECK en base). */
export const SESSION_TYPE_VALUES: SessionType[] = [
  'entrainement', 'sortie_longue', 'recuperation', 'velo', 'marche', 'renfo', 'course',
];

/**
 * Clé de groupe du format `plan` désignant tout le club (séance globale,
 * `group_id = null`). Sert aussi de sentinelle côté UI pour ne pas réclamer
 * une correspondance de groupe sur ces lignes.
 */
export const PLAN_ALL_GROUPS = 'Tous';

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
  /** Heure HH:MM si le format la porte (`plan` uniquement). Optionnel. */
  time?: string;
  /** Type de séance si le format le porte (`plan` uniquement). Optionnel. */
  sessionType?: SessionType;
  /** Lieu si le format le porte (`plan` uniquement). Optionnel. */
  location?: string;
}

export interface ParseError {
  lineNumber: number;
  message: string;
  /**
   * Nom de groupe non résolu à l'origine de l'erreur. L'UI s'en sert pour
   * proposer une correspondance manuelle et lever le blocage sans reparser.
   */
  unresolvedGroup?: string;
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
  if (/\bvma\b|fraction|fartlek|piste|\d+\s*x\s*\d+\s*m/.test(s)) return 'vma';
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

/* ---------- Normalisation tabulaire (CSV / Excel → TSV) ---------- */

/**
 * Sépare une ligne sur le séparateur détecté. Tabulation si présente (le
 * copier-coller Excel), sinon point-virgule (Excel en France) ou virgule.
 * Null si la ligne ne porte aucun des trois.
 */
function detectSeparator(line: string): string | null {
  if (line.includes('\t')) return '\t';
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (semicolons === 0 && commas === 0) return null;
  return semicolons >= commas ? ';' : ',';
}

/** Découpe un texte délimité en respectant les guillemets RFC 4180. */
function splitDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        // "" = guillemet littéral, sinon fin de la cellule entre guillemets.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else if (ch !== '\r') {
        // Un \r\n interne devient un simple \n, traité plus bas comme phase.
        field += ch;
      }
      continue;
    }
    // Un guillemet au milieu d'une cellule est un caractère comme un autre
    // (Excel n'échappe que les cellules entièrement encadrées).
    if (ch === '"' && fieldStart) {
      quoted = true;
      fieldStart = false;
      continue;
    }
    fieldStart = false;
    if (ch === sep) {
      row.push(field);
      field = '';
      fieldStart = true;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStart = true;
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  if (rows.length === 0 || row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/**
 * Aplatit une cellule sur une seule ligne : les retours à la ligne internes
 * (Excel les autorise dans une cellule) deviennent le séparateur de phases
 * " | " déjà utilisé par l'app, sans doublon ni pipe orphelin en bout.
 */
function flattenCell(cell: string): string {
  return cell
    .split('\n')
    .map(part => part.replace(/\t/g, ' ').replace(/^\s*\|+\s*|\s*\|+\s*$/g, '').trim())
    .filter(Boolean)
    .join(' | ');
}

/**
 * Convertit un tableau CSV (`;` ou `,`) ou un TSV abîmé en TSV propre :
 * une ligne par séance, une tabulation par colonne, aucune cellule à cheval
 * sur plusieurs lignes. Idempotent, et sans effet sur le format JSON.
 *
 * Appelée à chaque frappe dans la zone de collage : le chemin rapide
 * (aucun `;`, `,` ni guillemet) rend la main immédiatement.
 */
export function normalizeTabular(text: string): string {
  const head = text.trimStart();
  if (head.startsWith('{') || head.startsWith('```')) return text;
  if (!/[;,"]/.test(text)) return text;
  // Guillemet non appairé (saisie en cours dans la zone de collage) : on ne
  // normalise pas, sinon tout ce qui suit serait aplati en une seule cellule.
  if (((text.match(/"/g) ?? []).length & 1) === 1) return text;

  const firstLine = text.split('\n').find(l => l.trim().length > 0) ?? '';
  const sep = detectSeparator(firstLine);
  if (!sep) return text;

  return splitDelimited(text, sep)
    .map(row => row.map(flattenCell).join('\t'))
    .join('\n');
}

/* ---------- Détection de format ---------- */

/**
 * Détecte le format à partir de la première ligne (header).
 * Heuristique légère : on regarde les noms de colonnes.
 */
export function detectFormat(headerLine: string): ImportFormat {
  // PLAN : réponse JSON de ChatGPT, éventuellement enrobée d'un bloc de code.
  const head = headerLine.trim();
  if (head.startsWith('{') || head.startsWith('```')) return 'plan';

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
 * Construit une date ISO YYYY-MM-DD en validant que le jour/mois existent
 * réellement dans le calendrier. Renvoie null si la date est impossible
 * (ex: 31/02, 32/13, 00/00) pour éviter qu'une coquille du coach crée une
 * séance à une date absurde ou fasse planter l'insertion.
 */
function buildIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  // Roundtrip via le constructeur numérique (heure LOCALE, pas de parsing de
  // string) : new Date corrige silencieusement les dates impossibles
  // (31/02 → 03/03). On compare avec les getters locaux pour rester cohérent
  // et éviter tout décalage de fuseau horaire (un new Date("...T00:00:00")
  // suivi de getUTCDate faisait échouer les dates d'hiver en UTC+1).
  const dt = new Date(year, month - 1, day);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== year ||
    dt.getMonth() + 1 !== month ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse une date "raw" en YYYY-MM-DD. Supporte :
 *  - "14/01" (DD/MM, année = `defaultYear`)
 *  - "14/01/2026" (DD/MM/YYYY)
 *  - "2025-12-15" (déjà ISO)
 *  - "lundi 25 mai 2026" (texte français)
 *  - "25 mai 2026"
 * Renvoie null si non parsable OU si la date n'existe pas au calendrier.
 */
export function parseDateRaw(raw: string, defaultYear: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Déjà ISO ?
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return buildIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return buildIsoDate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));
  }

  // DD/MM (sans année) → utiliser defaultYear
  const dmMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dmMatch) {
    return buildIsoDate(defaultYear, Number(dmMatch[2]), Number(dmMatch[1]));
  }

  // "lundi 25 mai 2026" ou "25 mai 2026"
  const frMatch = trimmed.match(/(\d{1,2})\s+([a-zéûôîâàèùç]+)\s+(\d{4})/i);
  if (frMatch) {
    const month = MONTH_FR[frMatch[2].toLowerCase()];
    if (month) {
      return buildIsoDate(Number(frMatch[3]), month, Number(frMatch[1]));
    }
  }

  // "25 mai" sans année → defaultYear
  const dmTextMatch = trimmed.match(/(\d{1,2})\s+([a-zéûôîâàèùç]+)$/i);
  if (dmTextMatch) {
    const month = MONTH_FR[dmTextMatch[2].toLowerCase()];
    if (month) {
      return buildIsoDate(defaultYear, month, Number(dmTextMatch[1]));
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

export interface GroupMatch {
  groupId: string | null;
  /** 'exact' | 'approx' | 'none'. 'approx' doit être signalé au coach. */
  confidence: 'exact' | 'approx' | 'none';
}

/**
 * Résout un nom de groupe vers un group.id. Matching tolérant aux accents
 * et au préfixe "GR" / "GROUPE".
 *
 * Renvoie la confiance du match : 'exact' (sûr), 'approx' (résolu par
 * inclusion partielle, à vérifier par le coach), 'none' (non trouvé).
 * Le match approximatif est volontairement signalé plutôt que silencieux
 * pour éviter d'assigner des séances au mauvais groupe (ex: "Essentiel"
 * vs "Essentiel +").
 */
export function resolveGroup(rawName: string, groups: Group[]): GroupMatch {
  const target = normalizeGroupName(rawName);
  if (!target) return { groupId: null, confidence: 'none' };

  // 1. Match exact prioritaire
  const exact = groups.find(g => normalizeGroupName(g.name) === target);
  if (exact) return { groupId: exact.id, confidence: 'exact' };

  // 2. Match partiel : signalé comme approximatif
  const partial = groups.filter(
    g =>
      normalizeGroupName(g.name).includes(target) ||
      target.includes(normalizeGroupName(g.name))
  );
  if (partial.length === 1) {
    return { groupId: partial[0].id, confidence: 'approx' };
  }
  // Ambigu (plusieurs candidats) ou aucun → non résolu
  return { groupId: null, confidence: partial.length > 1 ? 'approx' : 'none' };
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
    // Une séance sans contenu détaillé est ignorée, même si un type est
    // renseigné (évite les séances fantômes avec description vide).
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
  // Colonne HEURE facultative (sorties du week-end le matin) : "8:30", "8h30".
  const timeIdx = header.findIndex(c => /^heure/i.test(c));
  const groupCols = header
    .map((name, idx) => ({ name, idx }))
    .filter(({ name, idx }) => idx > dateIdx && idx !== timeIdx && name);
  const badTimes = new Set<string>();

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
    const timeRaw = timeIdx === -1 ? '' : (cols[timeIdx] || '').trim();
    const time = normalizeTime(timeRaw) ?? undefined;
    if (timeRaw && !time && !badTimes.has(timeRaw)) {
      badTimes.add(timeRaw);
      warnings.push({ lineNumber: i + 1, message: `Heure "${timeRaw}" non lisible (format attendu HH:MM), 18:30 appliquée` });
    }
    for (const { name: groupName, idx } of groupCols) {
      const content = (cols[idx] || '').trim();
      if (isIgnorableContent(content)) {
        skipped++;
        continue;
      }
      const match = resolveGroup(groupName, opts.groups);
      if (match.confidence === 'none') {
        warnings.push({
          lineNumber: i + 1,
          message: `Groupe "${groupName}" non trouvé dans la liste du club`,
        });
      } else if (match.confidence === 'approx') {
        warnings.push({
          lineNumber: i + 1,
          message: `Groupe "${groupName}" résolu par approximation — vérifie l'assignation`,
        });
      }
      // Normalise le marqueur de semaine : "21" → "S21", "S21" reste "S21"
      const weekLabel = week ? (/^s/i.test(week) ? week.toUpperCase() : `S${week}`) : undefined;
      sessions.push({
        lineNumber: i + 1,
        week: weekLabel,
        date,
        dateRaw,
        time,
        day: extractDayName(dateRaw),
        targetType: 'group',
        targetGroupName: groupName,
        groupId: match.groupId,
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

/**
 * Format PLAN : un objet JSON décrivant une saison entière.
 *
 * {
 *   "version": 1,
 *   "saison": "2026-2027",
 *   "heure_par_defaut": "18:30",
 *   "seances": [
 *     { "date": "2026-09-08", "heure": "18:30", "titre": "VMA courte",
 *       "type": "entrainement", "lieu": "Stade",
 *       "groupes": { "Essentiel": "...", "Renforcé": "..." } }
 *   ]
 * }
 *
 * Une ligne par (séance × groupe) : c'est le pattern produit de l'app, une
 * séance ne visant qu'UN groupe. La clé "Tous" produit une séance globale
 * (`groupId = null`). Un nom de groupe inconnu est une ERREUR (et non un
 * avertissement) : sans cela la ligne partirait en séance globale, donc
 * visible par tout le club.
 */
function parsePlanJson(text: string, opts: ParseOpts): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const sessions: ParsedImportSession[] = [];
  let skipped = 0;

  const fail = (message: string): ParseResult => ({
    sessions: [],
    errors: [{ lineNumber: 1, message }],
    warnings: [],
    detectedFormat: 'plan',
    skipped: 0,
  });

  // Tolère les fences markdown et tout texte d'accompagnement : on ne garde
  // que du premier "{" au dernier "}".
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return fail(
      "Aucun objet JSON trouvé. Colle la réponse complète, accolade ouvrante comprise, ou choisis l'onglet correspondant à ton tableau."
    );
  }

  let plan: unknown;
  try {
    plan = JSON.parse(text.slice(start, end + 1));
  } catch {
    // Le message du moteur JS ("Unexpected end of JSON input"...) ne dit rien
    // au coach : la cause quasi systématique est une réponse tronquée.
    return fail(
      "La réponse semble incomplète ou abîmée (ChatGPT a peut-être coupé son message). Redemande-lui de la terminer, ou fais-lui produire un trimestre à la fois : les imports successifs repèrent les séances déjà créées."
    );
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return fail('JSON invalide : un objet { "seances": [...] } est attendu.');
  }

  const root = plan as Record<string, unknown>;
  const rawSessions = root.seances;
  if (!Array.isArray(rawSessions) || rawSessions.length === 0) {
    return fail('Aucune séance : la clé "seances" est absente ou vide.');
  }

  const defaultTime = normalizeTime(root.heure_par_defaut);
  const clubGroups = opts.groups.map(g => g.name).join(', ') || 'aucun groupe créé dans le club';
  // Un nom inconnu revient sur toutes les dates : une seule erreur par nom.
  const reportedUnknown = new Set<string>();
  // Même logique pour les avertissements répétitifs (type inconnu, heure
  // illisible) : une seule ligne par valeur fautive, pas une par séance.
  const reportedWarnings = new Set<string>();
  const warnOnce = (key: string, lineNumber: number, message: string) => {
    if (reportedWarnings.has(key)) return;
    reportedWarnings.add(key);
    warnings.push({ lineNumber, message });
  };

  rawSessions.forEach((entry, index) => {
    const lineNumber = index + 1;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push({ lineNumber, message: `Séance ${lineNumber} : un objet est attendu.` });
      return;
    }
    const item = entry as Record<string, unknown>;
    const dateRaw = typeof item.date === 'string' ? item.date.trim() : '';
    // Une saison est à cheval sur deux années : une date sans année serait
    // silencieusement rattachée à l'année par défaut, donc décalée.
    if (/^\d{1,2}\/\d{1,2}$/.test(dateRaw)) {
      errors.push({
        lineNumber,
        message: `Séance ${lineNumber} : date "${dateRaw}" sans année, utilise AAAA-MM-JJ.`,
      });
      return;
    }
    const date = dateRaw ? parseDateRaw(dateRaw, opts.defaultYear) : null;
    if (!date) {
      errors.push({
        lineNumber,
        message: `Séance ${lineNumber} : date non lisible ("${dateRaw}"). Format attendu : AAAA-MM-JJ.`,
      });
      return;
    }
    const groupes = item.groupes;
    if (
      !groupes ||
      typeof groupes !== 'object' ||
      Array.isArray(groupes) ||
      Object.keys(groupes).length === 0
    ) {
      errors.push({
        lineNumber,
        message: `Séance ${lineNumber} (${dateRaw}) : clé "groupes" absente, vide ou mal formée.`,
      });
      return;
    }

    const parsedTime = normalizeTime(item.heure);
    const time = parsedTime ?? defaultTime ?? undefined;
    if (item.heure != null && item.heure !== '' && !parsedTime) {
      // 18:30 est le repli appliqué à la création quand la saison ne fournit
      // aucune heure par défaut (cf. Import.tsx).
      warnOnce(
        `heure:${String(item.heure)}`,
        lineNumber,
        `Séance ${lineNumber} : heure "${String(item.heure)}" non lisible (format attendu HH:MM), ${time ?? '18:30'} appliquée.`
      );
    }
    const rawType = typeof item.type === 'string' ? item.type.trim() : '';
    const sessionType = SESSION_TYPE_VALUES.find(t => t === rawType);
    if (rawType && !sessionType) {
      warnOnce(
        `type:${rawType}`,
        lineNumber,
        `Séance ${lineNumber} : type "${rawType}" inconnu, "entrainement" sera utilisé.`
      );
    }
    const location = typeof item.lieu === 'string' && item.lieu.trim() ? item.lieu.trim() : undefined;
    const rawTitle = typeof item.titre === 'string' ? item.titre.trim() : '';

    for (const [groupName, value] of Object.entries(groupes as Record<string, unknown>)) {
      // `null` = clé posée mais sans séance ce jour-là. Tout autre non-texte
      // (tableau, objet, nombre) est signalé plutôt que perdu en silence.
      if (value !== null && typeof value !== 'string') {
        errors.push({
          lineNumber,
          message: `Séance ${lineNumber} (${dateRaw}) : le contenu du groupe "${groupName}" doit être un texte sur une ligne.`,
        });
        continue;
      }
      const content = value === null ? '' : value.trim();
      if (isIgnorableContent(content)) {
        skipped++;
        continue;
      }
      let groupId: string | null = null;
      let targetGroupName = groupName;
      if (normalizeGroupName(groupName) === 'tous') {
        targetGroupName = PLAN_ALL_GROUPS;
      } else {
        // Un match approximatif ("Essentiel" vs "Essentiel +") n'est pas sûr :
        // il est traité comme un nom non résolu, le coach tranche via le
        // sélecteur de correspondance manuelle.
        const match = resolveGroup(groupName, opts.groups);
        groupId = match.confidence === 'exact' ? match.groupId : null;
        if (!groupId && !reportedUnknown.has(groupName)) {
          reportedUnknown.add(groupName);
          errors.push({
            lineNumber,
            unresolvedGroup: groupName,
            message: `Groupe "${groupName}" inconnu. Groupes du club : ${clubGroups}.`,
          });
        }
      }

      sessions.push({
        lineNumber,
        date,
        dateRaw,
        targetType: 'group',
        targetGroupName,
        groupId,
        subType: rawTitle || content.split('|')[0].trim().slice(0, 60) || 'Séance',
        contentText: content,
        macroType: classifyMacroType(rawTitle, content),
        format: 'plan',
        time,
        sessionType,
        location,
      });
    }
  });

  return { sessions, errors, warnings, detectedFormat: 'plan', skipped };
}

/** Normalise une heure "9:5" / "18:30" / "18h30" en "HH:MM". Null si invalide. */
function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2})[:hH](\d{1,2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

  // Un CSV enregistré depuis Excel (séparateur ";" en France, cellules
  // multi-lignes entre guillemets) devient du TSV avant toute lecture : la
  // détection de format comme les parseurs ne connaissent que la tabulation.
  const tabular = opts.forceFormat === 'plan' ? text : normalizeTabular(text);
  const lines = tabular.split(/\r?\n/).filter(l => l.trim().length > 0);
  const format = opts.forceFormat ?? detectFormat(lines[0]);

  // Le JSON tient parfois sur une seule ligne : il passe donc avant le
  // contrôle "en-tête + données" propre aux formats tabulaires.
  if (format === 'plan') return parsePlanJson(text, opts);

  if (lines.length < 2) {
    return {
      sessions: [],
      errors: [{ lineNumber: 1, message: 'Le tableau doit avoir au moins une ligne d\'en-tête + une ligne de données' }],
      warnings: [],
      detectedFormat: 'unknown',
      skipped: 0,
    };
  }

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

/**
 * Métadonnées par macro-type pour l'affichage.
 * Toutes les couleurs passent par les tokens sémantiques du design system
 * (cf. src/index.css) via custom properties CSS, jamais de hex ni de classe
 * Tailwind brute (règle CLAUDE.md). `color` = trait/bordure plein,
 * `tint` = fond clair, `ink` = texte sur tint. Appliqués en style inline.
 */
export const MACRO_META: Record<MacroType, { label: string; color: string; tint: string; ink: string }> = {
  vma:    { label: 'VMA',              color: 'var(--color-danger)',         tint: 'var(--color-danger-50)',          ink: 'var(--color-danger-700)' },
  seuil:  { label: 'Seuil',            color: 'var(--color-warning)',        tint: 'var(--color-warning-50)',         ink: 'var(--color-warning-700)' },
  cotes:  { label: 'Côtes',            color: 'var(--color-session-velo)',   tint: 'var(--color-session-velo-tint)',  ink: 'var(--color-session-velo)' },
  sl:     { label: 'Sortie longue',    color: 'var(--color-success)',        tint: 'var(--color-success-50)',         ink: 'var(--color-success-700)' },
  spe:    { label: 'Spécifique',       color: 'var(--color-info)',           tint: 'var(--color-info-50)',            ink: 'var(--color-info-700)' },
  recup:  { label: 'Récup / Affûtage', color: 'var(--color-neutral-500)',    tint: 'var(--color-neutral-100)',        ink: 'var(--color-neutral-700)' },
  course: { label: 'Course / Test',    color: 'var(--color-session-course)', tint: 'var(--color-session-course-tint)', ink: 'var(--color-session-course)' },
  other:  { label: 'Autre',            color: 'var(--color-neutral-400)',    tint: 'var(--color-neutral-50)',         ink: 'var(--color-neutral-600)' },
};
