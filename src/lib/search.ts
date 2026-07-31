/**
 * Recherche universelle Narbo Nordik.
 *
 * Tout est en mémoire (cf. DataContext) : pas de backend, pas de lib externe.
 * Deux responsabilités :
 *  1. Indexer + matcher les entités du club (athlètes, séances, séances faites,
 *     palmarès, prépas, groupes, commandes de navigation).
 *  2. Garder le périmètre par persona AVANT le matching (sécurité) : la RLS
 *     Supabase est ouverte en lecture, donc le cloisonnement coach/athlète est
 *     fait ici. Un athlète ne doit jamais trouver la séance perso ou le
 *     compte-rendu d'un autre athlète. `getScopedEntities` est la barrière.
 *
 * La couche IA (langage naturel) ne touche jamais aux données : une edge
 * function traduit la phrase en filtres structurés (AiSearchFilters), et
 * `applyAiFilters` les exécute ici, sur les entités DÉJÀ scopées par persona.
 */

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  User, Session, SessionValidation, RaceResult, SpecificPreparation, Group,
  UserPreparation, Role, SessionType, SessionStatus, Sensations, ObjectiveReached,
} from '../types';
import { filterSessionsForAthlete, getUserPrepIds } from './athleteSessions';
import { pacePerKm } from './calculations';

/* ============================================================
   Normalisation + matching
   ============================================================ */

/** Minuscule + suppression des accents (NFD) + trim. "André" -> "andre". */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Tous les tokens de la requête doivent apparaître dans le haystack. */
export function matchTokens(haystack: string, query: string): boolean {
  return matchTokensNorm(normalize(haystack), normalize(query));
}

/** Score de pertinence simple (préfixe > début de mot > sous-chaîne). */
export function scoreMatch(haystack: string, query: string): number {
  return scoreNorm(normalize(haystack), normalize(query));
}

// Variantes internes : haystack déjà normalisé (évite de renormaliser à chaque frappe).
function matchTokensNorm(normHaystack: string, normQuery: string): boolean {
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  return tokens.every(t => normHaystack.includes(t));
}

function scoreNorm(normHaystack: string, normQuery: string): number {
  const q = normQuery.trim();
  if (!q) return 0;
  let s = 0;
  const idx = normHaystack.indexOf(q);
  if (idx === 0) s += 100;
  else if (idx > 0 && /\s/.test(normHaystack[idx - 1])) s += 60;
  else if (idx > 0) s += 30;
  for (const t of q.split(/\s+/).filter(Boolean)) {
    const ti = normHaystack.indexOf(t);
    if (ti === 0) s += 20;
    else if (ti > 0 && /\s/.test(normHaystack[ti - 1])) s += 12;
    else if (ti > 0) s += 6;
  }
  return s;
}

/* ============================================================
   Types de résultat
   ============================================================ */

export type SearchKind =
  | 'athlete' | 'session' | 'validation' | 'race' | 'preparation' | 'group' | 'command';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  /** Petit tag contextuel (type de séance, "Palmarès"...). */
  badge?: string;
  /** Navigation principale au clic. */
  to: string;
  score: number;
  /** Action rapide optionnelle (ex. coach : "Changer la VMA"). */
  action?: { label: string; to: string };
}

type ResultBase = Omit<SearchResult, 'score'>;

interface IndexItem {
  base: ResultBase;
  /** Haystack déjà normalisé. */
  haystack: string;
}

export interface SearchData {
  users: User[];
  sessions: Session[];
  validations: SessionValidation[];
  raceResults: RaceResult[];
  preparations: SpecificPreparation[];
  groups: Group[];
  userPreparations: UserPreparation[];
}

export interface SearchViewer {
  id: string;
  role: Role;
  group_id: string | null;
  isSuperAdmin: boolean;
}

/**
 * Vrai si l'athlete `u` est visible par `viewer` dans l'annuaire et la
 * recherche. Un profil `is_public=false` reste visible pour soi-meme, les
 * coachs et le super-admin ; il disparait pour les AUTRES athletes.
 *
 * C'est un filtre applicatif, pas une frontiere RLS : la ligne reste
 * techniquement lisible en base par tout `authenticated` (cf. migration
 * 20260731120000). Utilise par `getScopedEntities` ci-dessous ainsi que par
 * Directory et AthleteDetail, pour ne pas dupliquer la regle a 3 endroits.
 */
export function isAthleteVisible(u: User, viewer: Pick<SearchViewer, 'id' | 'role' | 'isSuperAdmin'>): boolean {
  if (viewer.role === 'coach' || viewer.isSuperAdmin) return true;
  return u.id === viewer.id || u.is_public;
}

/* ============================================================
   Libellés
   ============================================================ */

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  entrainement: 'Entraînement',
  sortie_longue: 'Sortie longue',
  recuperation: 'Récupération',
  velo: 'Vélo',
  marche: 'Marche',
  renfo: 'Renfo',
  course: 'Course',
};

// Mots-clés d'intensité dérivés des blocs (pour matcher "seuil", "vma"...).
const ALLURE_KEYWORDS: Record<string, string> = {
  aer: 'aerobie endurance',
  ef: 'endurance fondamentale footing',
  sv1: 'seuil sv1',
  sv2: 'seuil sv2',
  as42: 'allure marathon',
  as21: 'allure semi',
  as10: 'allure 10km',
  as5: 'allure 5km',
  vma: 'vma fractionne',
  pma: 'pma puissance cote montee vo2max',
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : format(d, 'd MMM yyyy', { locale: fr });
};

const fmtKm = (meters: number): string => `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
const fmtVma = (vma: number): string => String(vma).replace('.', ',');

/* ============================================================
   Périmètre par persona (sécurité)
   ============================================================ */

interface ScopedEntities {
  isStaff: boolean;
  athletes: User[];
  sessions: Session[];
  validations: SessionValidation[];
  races: RaceResult[];
  preparations: SpecificPreparation[];
  groups: Group[];
  groupName: Map<string, string>;
  athleteName: Map<string, string>;
  groupMemberCount: Map<string, number>;
  sessionById: Map<string, Session>;
}

/**
 * Renvoie les sous-ensembles d'entités VISIBLES par le viewer, selon son rôle.
 * C'est la barrière de confidentialité : tout passe par ici avant tout matching.
 */
export function getScopedEntities(viewer: SearchViewer, data: SearchData): ScopedEntities {
  const groupName = new Map(data.groups.map(g => [g.id, g.name]));
  const athleteName = new Map(data.users.map(u => [u.id, `${u.firstname} ${u.lastname}`]));
  const sessionById = new Map(data.sessions.map(s => [s.id, s]));
  const groupMemberCount = new Map<string, number>();
  for (const u of data.users) {
    if (u.group_id) groupMemberCount.set(u.group_id, (groupMemberCount.get(u.group_id) ?? 0) + 1);
  }

  const isStaff = viewer.role === 'coach' || viewer.isSuperAdmin;
  // Le super admin n'est jamais une cible de recherche (compte technique).
  // isAthleteVisible ne retire personne pour un viewer staff (toujours vrai) ;
  // pour un athlete, elle masque les profils is_public=false des AUTRES.
  const members = data.users.filter(u => !u.is_super_admin && isAthleteVisible(u, viewer));

  if (isStaff) {
    return {
      isStaff, athletes: members, sessions: data.sessions, validations: data.validations,
      races: data.raceResults, preparations: data.preparations, groups: data.groups,
      groupName, athleteName, groupMemberCount, sessionById,
    };
  }

  // Athlète : périmètre restreint.
  const prepIds = getUserPrepIds(viewer.id, data.userPreparations);
  const visibleSessions = filterSessionsForAthlete(viewer, data.sessions, prepIds).map(f => f.session);
  return {
    isStaff,
    athletes: members,                                           // annuaire club (déjà visible dans Directory)
    sessions: visibleSessions,                                   // ses séances visibles uniquement
    validations: data.validations.filter(v => v.user_id === viewer.id), // ses comptes-rendus
    races: data.raceResults.filter(r => r.user_id === viewer.id),       // son palmarès
    preparations: [],                                            // pas de route athlète
    groups: [],                                                  // pas de route athlète
    groupName, athleteName, groupMemberCount, sessionById,
  };
}

/* ============================================================
   Builders de résultat
   ============================================================ */

function buildAthlete(u: User, viewer: SearchViewer, ctx: ScopedEntities): ResultBase {
  const name = `${u.firstname} ${u.lastname}`;
  const parts: string[] = [];
  if (u.vma) parts.push(`VMA ${fmtVma(u.vma)}`);
  const gName = u.group_id ? ctx.groupName.get(u.group_id) : null;
  if (gName) parts.push(gName);

  const isSelf = u.id === viewer.id;
  const to = ctx.isStaff ? `/directory/${u.id}` : (isSelf ? '/profile' : '/directory');

  const base: ResultBase = {
    kind: 'athlete', id: u.id, title: name,
    subtitle: parts.join(' · ') || undefined,
    badge: u.role === 'coach' ? 'Coach' : undefined,
    to,
  };
  // Action rapide coach : changer la VMA, deep-link vers l'éditeur inline.
  if (ctx.isStaff && (u.role === 'athlete' || viewer.isSuperAdmin)) {
    base.action = { label: 'Changer la VMA', to: `/coach/settings?tab=athletes&edit=${u.id}` };
  }
  return base;
}

function athleteHaystack(u: User, ctx: ScopedEntities): string {
  const gName = u.group_id ? ctx.groupName.get(u.group_id) ?? '' : '';
  const vma = u.vma ? `vma ${u.vma}` : '';
  const email = ctx.isStaff ? u.email : '';
  return normalize(`${u.firstname} ${u.lastname} ${gName} ${vma} ${email}`);
}

function buildSession(s: Session): ResultBase {
  const typeLabel = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type;
  const subtitle = [fmtDate(s.date), s.location].filter(Boolean).join(' · ');
  return {
    kind: 'session', id: s.id, title: s.title,
    subtitle: subtitle || undefined, badge: typeLabel,
    to: `/session/${s.id}`,
  };
}

function sessionHaystack(s: Session): string {
  const typeLabel = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type;
  const allures = s.blocks.map(b => ALLURE_KEYWORDS[b.allure] ?? '').join(' ');
  return normalize(`${s.title} ${s.description ?? ''} ${s.location ?? ''} ${typeLabel} ${allures} ${fmtDate(s.date)}`);
}

function buildValidation(v: SessionValidation, ctx: ScopedEntities): ResultBase {
  const s = ctx.sessionById.get(v.session_id);
  const sTitle = s?.title ?? 'Séance';
  const date = s ? fmtDate(s.date) : fmtDate(v.created_at);
  const pace = pacePerKm(v.distance_m, v.duration_s);
  const statusWord = v.status === 'done' ? 'Fait' : v.status === 'missed' ? 'Manqué' : 'À faire';
  const metricBits: string[] = [];
  if (v.distance_m) metricBits.push(fmtKm(v.distance_m));
  if (pace) metricBits.push(`${pace}/km`);
  const aName = ctx.athleteName.get(v.user_id) ?? '';

  return {
    kind: 'validation', id: v.id,
    title: ctx.isStaff && aName ? `${aName} · ${sTitle}` : sTitle,
    subtitle: [date, ...metricBits].filter(Boolean).join(' · ') || undefined,
    badge: statusWord,
    to: ctx.isStaff ? `/training-history?user=${v.user_id}` : `/session/${v.session_id}`,
  };
}

function validationHaystack(v: SessionValidation, ctx: ScopedEntities): string {
  const s = ctx.sessionById.get(v.session_id);
  const sTitle = s?.title ?? '';
  const aName = ctx.isStaff ? ctx.athleteName.get(v.user_id) ?? '' : '';
  const status = v.status === 'done' ? 'fait reussi' : 'manque rate';
  return normalize(`${sTitle} ${aName} ${status} ${v.sensations ?? ''} ${v.objective_reached ?? ''} ${v.feedback ?? ''} ${s ? fmtDate(s.date) : ''}`);
}

function buildRace(r: RaceResult, ctx: ScopedEntities): ResultBase {
  const aName = ctx.athleteName.get(r.user_id) ?? '';
  const subtitle = [
    ctx.isStaff ? aName : null,
    fmtDate(r.date),
    r.time_duration,
    r.distance_km ? `${fmtVma(r.distance_km)} km` : null,
  ].filter(Boolean).join(' · ');
  return {
    kind: 'race', id: r.id, title: r.race_name,
    subtitle: subtitle || undefined, badge: 'Palmarès',
    to: '/palmares',
  };
}

function raceHaystack(r: RaceResult, ctx: ScopedEntities): string {
  const aName = ctx.isStaff ? ctx.athleteName.get(r.user_id) ?? '' : '';
  return normalize(`${r.race_name} ${r.comment ?? ''} ${aName} ${r.race_type} ${fmtDate(r.date)}`);
}

function buildPreparation(p: SpecificPreparation): ResultBase {
  const subtitle = [fmtDate(p.event_date), p.description].filter(Boolean).join(' · ');
  return {
    kind: 'preparation', id: p.id, title: p.name,
    subtitle: subtitle || undefined, badge: 'Prépa',
    to: '/coach/settings?tab=preparations',
  };
}

function buildGroup(g: Group, ctx: ScopedEntities): ResultBase {
  const count = ctx.groupMemberCount.get(g.id) ?? 0;
  return {
    kind: 'group', id: g.id, title: g.name,
    subtitle: count > 0 ? `${count} membre${count > 1 ? 's' : ''}` : undefined,
    badge: 'Groupe',
    to: '/coach/settings?tab=groups',
  };
}

/* ============================================================
   Commandes de navigation (palette = lanceur)
   ============================================================ */

interface CommandDef { id: string; title: string; to: string; kw: string; }

function getCommands(isStaff: boolean): CommandDef[] {
  const shared: CommandDef[] = [
    { id: 'cmd-palmares', title: 'Palmarès', to: '/palmares', kw: 'palmares courses resultats records' },
    { id: 'cmd-directory', title: 'Annuaire des athlètes', to: '/directory', kw: 'athletes annuaire membres' },
    { id: 'cmd-notifications', title: 'Notifications', to: '/notifications', kw: 'notifications alertes cloche' },
    { id: 'cmd-profile', title: 'Mon profil', to: '/profile', kw: 'profil compte parametres' },
    { id: 'cmd-help', title: 'Aide', to: '/aide', kw: 'aide guide support' },
  ];
  if (isStaff) {
    return [
      { id: 'cmd-new-session', title: 'Nouvelle séance', to: '/coach/nouvelle-seance', kw: 'creer ajouter seance entrainement nouvelle' },
      { id: 'cmd-planning', title: 'Planning', to: '/coach/sessions', kw: 'planning calendrier semaine seances editer' },
      { id: 'cmd-import', title: 'Import Excel', to: '/coach/import', kw: 'import excel coller seances lot' },
      { id: 'cmd-dashboard', title: 'Suivi du club', to: '/coach', kw: 'suivi dashboard tableau de bord coach' },
      { id: 'cmd-settings', title: 'Réglages', to: '/coach/settings', kw: 'parametres reglages settings' },
      { id: 'cmd-allures', title: 'Allures', to: '/coach/settings?tab=allures', kw: 'allures zones vma reglages' },
      { id: 'cmd-groups', title: 'Groupes', to: '/coach/settings?tab=groups', kw: 'groupes reglages' },
      ...shared,
    ];
  }
  return [
    { id: 'cmd-suivi', title: 'Mon suivi', to: '/suivi', kw: 'suivi calendrier seances mes' },
    ...shared,
  ];
}

/* ============================================================
   Index + recherche locale
   ============================================================ */

export function buildSearchIndex(viewer: SearchViewer, data: SearchData): IndexItem[] {
  const ctx = getScopedEntities(viewer, data);
  const items: IndexItem[] = [];

  for (const u of ctx.athletes) items.push({ base: buildAthlete(u, viewer, ctx), haystack: athleteHaystack(u, ctx) });
  for (const s of ctx.sessions) items.push({ base: buildSession(s), haystack: sessionHaystack(s) });
  for (const v of ctx.validations) items.push({ base: buildValidation(v, ctx), haystack: validationHaystack(v, ctx) });
  for (const r of ctx.races) items.push({ base: buildRace(r, ctx), haystack: raceHaystack(r, ctx) });
  for (const p of ctx.preparations) items.push({ base: buildPreparation(p), haystack: normalize(`${p.name} ${p.description ?? ''} preparation prepa`) });
  for (const g of ctx.groups) items.push({ base: buildGroup(g, ctx), haystack: normalize(`${g.name} groupe`) });
  for (const c of getCommands(ctx.isStaff)) items.push({ base: { kind: 'command', id: c.id, title: c.title, to: c.to }, haystack: normalize(`${c.title} ${c.kw}`) });

  return items;
}

export const MIN_QUERY_LENGTH = 2;

export function runSearch(index: IndexItem[], query: string, limit = 24): SearchResult[] {
  const nq = normalize(query);
  if (nq.length < MIN_QUERY_LENGTH) return [];
  const out: SearchResult[] = [];
  for (const item of index) {
    if (!matchTokensNorm(item.haystack, nq)) continue;
    out.push({ ...item.base, score: scoreNorm(item.haystack, nq) });
  }
  out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'fr'));
  return out.slice(0, limit);
}

/* ============================================================
   Couche IA : filtres structurés
   ============================================================ */

export interface AiSearchFilters {
  entity: 'athlete' | 'session' | 'validation' | 'race' | null;
  text: string | null;
  session_type: SessionType | null;
  allure: 'seuil' | 'vma' | 'endurance' | null;
  distance_km_min: number | null;
  distance_km_max: number | null;
  date_from: string | null;
  date_to: string | null;
  vma_min: number | null;
  vma_max: number | null;
  status: SessionStatus | null;
  sensations: Sensations | null;
  objective_reached: ObjectiveReached | null;
  group_name: string | null;
}

const SESSION_TYPES: SessionType[] = ['entrainement', 'sortie_longue', 'recuperation', 'velo', 'marche', 'renfo', 'course'];
const STATUSES: SessionStatus[] = ['pending', 'done', 'missed'];
const SENSATIONS: Sensations[] = ['excellentes', 'bonnes', 'mauvaises'];
const OBJECTIVES: ObjectiveReached[] = ['oui', 'non', 'partiel'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: unknown, min: number, max: number): number | null =>
  (typeof v === 'number' && isFinite(v) && v >= min && v <= max) ? v : null;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : null;
const dateStr = (v: unknown): string | null =>
  (typeof v === 'string' && ISO_DATE.test(v)) ? v : null;

/** Valide/borne la sortie brute du LLM. On ne fait jamais confiance au modèle. */
export function sanitizeAiFilters(raw: unknown): AiSearchFilters {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    entity: oneOf(r.entity, ['athlete', 'session', 'validation', 'race'] as const),
    text: typeof r.text === 'string' && r.text.trim() ? r.text.trim().slice(0, 80) : null,
    session_type: oneOf(r.session_type, SESSION_TYPES),
    allure: oneOf(r.allure, ['seuil', 'vma', 'endurance'] as const),
    distance_km_min: num(r.distance_km_min, 0, 500),
    distance_km_max: num(r.distance_km_max, 0, 500),
    date_from: dateStr(r.date_from),
    date_to: dateStr(r.date_to),
    vma_min: num(r.vma_min, 5, 30),
    vma_max: num(r.vma_max, 5, 30),
    status: oneOf(r.status, STATUSES),
    sensations: oneOf(r.sensations, SENSATIONS),
    objective_reached: oneOf(r.objective_reached, OBJECTIVES),
    group_name: typeof r.group_name === 'string' && r.group_name.trim() ? r.group_name.trim().slice(0, 40) : null,
  };
}

/** Vrai si au moins un critère exploitable est présent. */
export function hasAnyFilter(f: AiSearchFilters): boolean {
  return Object.entries(f).some(([, v]) => v !== null);
}

function sessionMatchesAllure(s: Session, allure: NonNullable<AiSearchFilters['allure']>): boolean {
  const zones = s.blocks.map(b => b.allure);
  if (allure === 'seuil') return zones.some(z => z === 'sv1' || z === 'sv2');
  if (allure === 'vma') return zones.some(z => z === 'vma');
  return zones.some(z => z === 'ef' || z === 'aer'); // endurance
}

/** Exécute les filtres IA sur les entités DÉJÀ scopées par persona. */
export function applyAiFilters(
  viewer: SearchViewer, data: SearchData, f: AiSearchFilters, limit = 40,
): SearchResult[] {
  const ctx = getScopedEntities(viewer, data);
  const nq = f.text ? normalize(f.text) : null;
  const out: SearchResult[] = [];

  const inDate = (iso: string): boolean => {
    const d = iso.slice(0, 10);
    if (f.date_from && d < f.date_from) return false;
    if (f.date_to && d > f.date_to) return false;
    return true;
  };
  const wantKind = (k: AiSearchFilters['entity']) => !f.entity || f.entity === k;
  const groupOk = (groupId: string | null): boolean => {
    if (!f.group_name) return true;
    const gName = groupId ? ctx.groupName.get(groupId) : null;
    return !!gName && normalize(gName).includes(normalize(f.group_name));
  };

  if (wantKind('athlete')) {
    for (const u of ctx.athletes) {
      if (nq && !matchTokens(`${u.firstname} ${u.lastname}`, f.text!)) continue;
      if (f.vma_min != null && (u.vma == null || u.vma < f.vma_min)) continue;
      if (f.vma_max != null && (u.vma == null || u.vma > f.vma_max)) continue;
      if (!groupOk(u.group_id)) continue;
      out.push({ ...buildAthlete(u, viewer, ctx), score: 0 });
    }
  }

  if (wantKind('session')) {
    for (const s of ctx.sessions) {
      if (!inDate(s.date)) continue;
      if (f.session_type && s.session_type !== f.session_type) continue;
      if (f.allure && !sessionMatchesAllure(s, f.allure)) continue;
      if (!groupOk(s.group_id)) continue;
      if (nq && !matchTokens(`${s.title} ${s.description ?? ''} ${s.location ?? ''}`, f.text!)) continue;
      out.push({ ...buildSession(s), score: 0 });
    }
  }

  if (wantKind('validation')) {
    for (const v of ctx.validations) {
      const s = ctx.sessionById.get(v.session_id);
      if (!inDate(s?.date ?? v.created_at)) continue;
      if (f.status && v.status !== f.status) continue;
      if (f.sensations && v.sensations !== f.sensations) continue;
      if (f.objective_reached && v.objective_reached !== f.objective_reached) continue;
      const km = v.distance_m != null ? v.distance_m / 1000 : null;
      if (f.distance_km_min != null && (km == null || km < f.distance_km_min)) continue;
      if (f.distance_km_max != null && (km == null || km > f.distance_km_max)) continue;
      if (nq) {
        const aName = ctx.isStaff ? ctx.athleteName.get(v.user_id) ?? '' : '';
        if (!matchTokens(`${s?.title ?? ''} ${aName} ${v.feedback ?? ''}`, f.text!)) continue;
      }
      out.push({ ...buildValidation(v, ctx), score: 0 });
    }
  }

  if (wantKind('race')) {
    for (const r of ctx.races) {
      if (!inDate(r.date)) continue;
      if (f.distance_km_min != null && r.distance_km < f.distance_km_min) continue;
      if (f.distance_km_max != null && r.distance_km > f.distance_km_max) continue;
      if (nq) {
        const aName = ctx.isStaff ? ctx.athleteName.get(r.user_id) ?? '' : '';
        if (!matchTokens(`${r.race_name} ${aName} ${r.comment ?? ''}`, f.text!)) continue;
      }
      out.push({ ...buildRace(r, ctx), score: 0 });
    }
  }

  return out.slice(0, limit);
}

/** Résumé lisible des filtres IA pour l'UI. */
export function describeAiFilters(f: AiSearchFilters): string {
  const bits: string[] = [];
  const kindLabel: Record<NonNullable<AiSearchFilters['entity']>, string> = {
    athlete: 'Athlètes', session: 'Séances', validation: 'Séances faites', race: 'Palmarès',
  };
  if (f.entity) bits.push(kindLabel[f.entity]);
  if (f.text) bits.push(`"${f.text}"`);
  if (f.session_type) bits.push(SESSION_TYPE_LABELS[f.session_type]);
  if (f.allure) bits.push(f.allure);
  if (f.status) bits.push(f.status === 'done' ? 'fait' : f.status === 'missed' ? 'manqué' : 'à faire');
  if (f.sensations) bits.push(`sensations ${f.sensations}`);
  if (f.objective_reached) bits.push(`objectif ${f.objective_reached}`);
  if (f.distance_km_min != null && f.distance_km_max != null) bits.push(`${f.distance_km_min}-${f.distance_km_max} km`);
  else if (f.distance_km_min != null) bits.push(`+ de ${f.distance_km_min} km`);
  else if (f.distance_km_max != null) bits.push(`- de ${f.distance_km_max} km`);
  if (f.vma_min != null && f.vma_max != null) bits.push(`VMA ${f.vma_min}-${f.vma_max}`);
  else if (f.vma_min != null) bits.push(`VMA ≥ ${f.vma_min}`);
  else if (f.vma_max != null) bits.push(`VMA ≤ ${f.vma_max}`);
  if (f.group_name) bits.push(`groupe ${f.group_name}`);
  if (f.date_from || f.date_to) {
    const d = (s: string | null) => s ? format(new Date(s), 'd MMM', { locale: fr }) : '...';
    bits.push(`${d(f.date_from)} → ${d(f.date_to)}`);
  }
  return bits.join(' · ');
}
