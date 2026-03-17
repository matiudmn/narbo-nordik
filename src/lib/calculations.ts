import { getISOWeek } from 'date-fns';
import type { PaceCalculation, AllureZone, AllureZoneConfig, RacePaceConfig, SessionBlock, Session, Group, SpecificPreparation } from '../types';

export const DEFAULT_ALLURE_ZONES: Record<AllureZone, AllureZoneConfig> = {
  ef:        { label: 'EF',        pctMinByLevel: [55, 60, 60, 60, 60],    pctMaxByLevel: [65, 70, 70, 70, 70],    color: '#22c55e' },
  am:        { label: 'AM',        pctMinByLevel: [68, 71, 73, 75, 76],    pctMaxByLevel: [76, 79, 81, 83, 84],    color: '#10b981' },
  endurance: { label: 'Endurance', pctMinByLevel: [65, 68, 70, 72, 73],    pctMaxByLevel: [75, 78, 80, 82, 83],    color: '#3b82f6' },
  sv1:       { label: 'SV1',       pctMinByLevel: [72, 75, 75, 77, 79],    pctMaxByLevel: [78, 81, 81, 83, 85],    color: '#6366f1' },
  sv2:       { label: 'SV2',       pctMinByLevel: [80, 82, 84, 85, 86],    pctMaxByLevel: [86, 88, 90, 91, 92],    color: '#8b5cf6' },
  as42:      { label: 'AS42',      pctMinByLevel: [72, 74, 75, 76, 77],    pctMaxByLevel: [80, 82, 83, 84, 85],    color: '#eab308' },
  as21:      { label: 'AS21',      pctMinByLevel: [79, 80, 81, 82, 82],    pctMaxByLevel: [87, 88, 89, 90, 90],    color: '#f97316' },
  as10:      { label: 'AS10',      pctMinByLevel: [85, 86, 86, 87, 88],    pctMaxByLevel: [91, 92, 92, 93, 94],    color: '#ef4444' },
  vma:       { label: 'VMA',       pctMinByLevel: [95, 95, 97, 100, 100],  pctMaxByLevel: [105, 107, 107, 110, 110], color: '#dc2626' },
};

export const ALLURE_ZONES = DEFAULT_ALLURE_ZONES;

export function getAllureZones(overrides?: Record<string, AllureZoneConfig>): Record<AllureZone, AllureZoneConfig> {
  if (!overrides || Object.keys(overrides).length === 0) return DEFAULT_ALLURE_ZONES;
  const valid = Object.values(overrides).every(z => Array.isArray(z.pctMinByLevel) && Array.isArray(z.pctMaxByLevel));
  return valid ? { ...DEFAULT_ALLURE_ZONES, ...overrides } as Record<AllureZone, AllureZoneConfig> : DEFAULT_ALLURE_ZONES;
}

function resolveZonePct(z: AllureZoneConfig, vma: number): { pctMin: number; pctMax: number } {
  const lvl = getVmaLevelIndex(vma);
  return { pctMin: z.pctMinByLevel[lvl], pctMax: z.pctMaxByLevel[lvl] };
}

export const BLOCK_TYPES: Record<string, { label: string }> = {
  echauffement:    { label: 'Échauffement' },
  travail:         { label: 'Travail' },
  retour_au_calme: { label: 'Retour au calme' },
  recuperation:    { label: 'Récupération' },
};

export function calculateBlockPace(vma: number, zone: AllureZone, zones?: Record<string, AllureZoneConfig>) {
  const z = (zones || ALLURE_ZONES)[zone] || ALLURE_ZONES[zone];
  const { pctMin, pctMax } = resolveZonePct(z, vma);
  const speedMin = vma * (pctMin / 100);
  const speedMax = vma * (pctMax / 100);
  return {
    speedMin,
    speedMax,
    paceMin: formatPace(60 / speedMax),
    paceMax: formatPace(60 / speedMin),
  };
}

export function estimateBlockEffortSeconds(block: SessionBlock, vma?: number, zones?: Record<string, AllureZoneConfig>): number {
  if (block.distance_meters && vma) {
    const z = (zones || ALLURE_ZONES)[block.allure] || ALLURE_ZONES[block.allure];
    const { pctMin, pctMax } = resolveZonePct(z, vma);
    const avgPct = (pctMin + pctMax) / 2 / 100;
    const speedMs = (vma * avgPct) / 3.6;
    return Math.round(block.distance_meters / speedMs);
  }
  return block.duration_seconds;
}

export function estimateRestSeconds(block: SessionBlock, vma?: number, zones?: Record<string, AllureZoneConfig>): number {
  if (block.rest_distance_meters && vma) {
    const efZ = (zones || ALLURE_ZONES).ef || ALLURE_ZONES.ef;
    const { pctMin, pctMax } = resolveZonePct(efZ, vma);
    const efPct = (pctMin + pctMax) / 2 / 100;
    const speedMs = (vma * efPct) / 3.6;
    return Math.round(block.rest_distance_meters / speedMs);
  }
  if (block.rest_distance_meters) {
    return Math.round(block.rest_distance_meters / 2.5);
  }
  return block.rest_seconds;
}

export function calculateBlockTotalSeconds(block: SessionBlock, vma?: number, zones?: Record<string, AllureZoneConfig>): number {
  const effortPerRep = block.distance_meters ? estimateBlockEffortSeconds(block, vma, zones) : block.duration_seconds;
  const effort = effortPerRep * block.repetitions;
  const restPerRep = estimateRestSeconds(block, vma, zones);
  const rest = restPerRep * Math.max(0, block.repetitions - 1);
  return effort + rest;
}

export function calculateSessionTotalSeconds(blocks: SessionBlock[], vma?: number, zones?: Record<string, AllureZoneConfig>): number {
  return blocks.reduce((sum, b) => sum + calculateBlockTotalSeconds(b, vma, zones), 0);
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return s > 0 ? `${m}'${String(s).padStart(2, '0')}` : `${m}'`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) return `${meters / 1000}km`;
  return `${meters}m`;
}

export function formatBlockSummary(block: SessionBlock, zones?: Record<string, AllureZoneConfig>): string {
  const zone = (zones || ALLURE_ZONES)[block.allure] || ALLURE_ZONES[block.allure];
  const effort = block.distance_meters ? formatDistance(block.distance_meters) : formatSeconds(block.duration_seconds);
  if (block.repetitions <= 1) return `${effort} ${zone.label}`;
  let rest = '';
  if (block.rest_distance_meters) {
    rest = ` R=${formatDistance(block.rest_distance_meters)}`;
  } else if (block.rest_seconds > 0) {
    rest = ` R=${formatSeconds(block.rest_seconds)}`;
  }
  return `${block.repetitions}x${effort} ${zone.label}${rest}`;
}

export const VMA_LEVELS = [
  { key: 'debutant',       label: 'Deb.',   description: '< 12 km/h',  maxVma: 12 },
  { key: 'intermediaire',  label: 'Inter.',  description: '12-14 km/h', maxVma: 14 },
  { key: 'confirme',       label: 'Conf.',   description: '14-16 km/h', maxVma: 16 },
  { key: 'avance',         label: 'Av.',     description: '16-18 km/h', maxVma: 18 },
  { key: 'elite',          label: 'Elite',   description: '> 18 km/h',  maxVma: Infinity },
] as const;

export function getVmaLevelIndex(vma: number): number {
  if (vma < 12) return 0;
  if (vma < 14) return 1;
  if (vma < 16) return 2;
  if (vma < 18) return 3;
  return 4;
}

export const DEFAULT_RACE_PACES: Record<string, RacePaceConfig> = {
  ef:   { label: 'EF',   pctByLevel: [60, 65, 65, 65, 65],      color: '#22c55e', description: 'Endurance fondamentale' },
  am:   { label: 'AM',   pctByLevel: [72, 75, 77, 79, 80],      color: '#10b981', description: 'Aerobie modere' },
  sv1:  { label: 'SV1',  pctByLevel: [75, 78, 78, 80, 82],      color: '#3b82f6', description: 'Seuil ventillatoire 1' },
  sv2:  { label: 'SV2',  pctByLevel: [83, 85, 87, 88, 89],      color: '#8b5cf6', description: 'Seuil ventillatoire 2' },
  as42: { label: 'AS42', pctByLevel: [75, 77, 78, 79, 80],      color: '#eab308', description: 'Marathon' },
  as21: { label: 'AS21', pctByLevel: [82, 83, 84, 85, 85],      color: '#f97316', description: 'Semi-marathon' },
  as10: { label: 'AS10', pctByLevel: [88, 89, 89, 90, 91],      color: '#ef4444', description: '10 km' },
  vma:  { label: 'VMA',  pctByLevel: [100, 100, 100, 100, 100], color: '#dc2626', description: 'VMA' },
};

export const RACE_PACES = DEFAULT_RACE_PACES;

export function getRacePaces(overrides?: Record<string, RacePaceConfig>): Record<string, RacePaceConfig> {
  if (!overrides || Object.keys(overrides).length === 0) return DEFAULT_RACE_PACES;
  const valid = Object.values(overrides).every(z => Array.isArray(z.pctByLevel));
  return valid ? overrides : DEFAULT_RACE_PACES;
}

export function calculateRacePace(vma: number, pct: number): { speed: number; pace: string } {
  const speed = vma * pct / 100;
  const paceDecimal = 60 / speed;
  const minutes = Math.floor(paceDecimal);
  const seconds = Math.round((paceDecimal - minutes) * 60);
  return { speed, pace: `${minutes}:${String(seconds).padStart(2, '0')}` };
}

export function calculatePaces(
  vma: number,
  pctMin: number,
  pctMax: number,
  distanceMeters: number
): PaceCalculation {
  const speedMin = vma * (pctMin / 100);
  const speedMax = vma * (pctMax / 100);

  const paceMin = formatPace(60 / speedMax);
  const paceMax = formatPace(60 / speedMin);

  const timeMinSeconds = Math.round((distanceMeters / 1000) / speedMax * 3600);
  const timeMaxSeconds = Math.round((distanceMeters / 1000) / speedMin * 3600);

  return {
    speedMin,
    speedMax,
    paceMin,
    paceMax,
    timeMinSeconds,
    timeMaxSeconds,
    timeMinDisplay: formatTime(timeMinSeconds),
    timeMaxDisplay: formatTime(timeMaxSeconds),
  };
}

function formatPace(paceDecimal: number): string {
  const minutes = Math.floor(paceDecimal);
  const seconds = Math.round((paceDecimal - minutes) * 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(duration: string): string {
  const parts = duration.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h === '00') return `${m}:${s}`;
    return `${h}:${m}:${s}`;
  }
  return duration;
}

export function getSessionCode(
  session: Session,
  allSessions: Session[],
): string {
  if (session.is_personal) return 'Hors plan';

  const sessionDate = new Date(session.date);
  const weekNum = getISOWeek(sessionDate);
  const year = sessionDate.getFullYear();

  const siblings = allSessions
    .filter(s => {
      if (s.is_personal) return false;
      const d = new Date(s.date);
      if (getISOWeek(d) !== weekNum || d.getFullYear() !== year) return false;
      if (session.preparation_id) return s.preparation_id === session.preparation_id;
      if (session.group_id) return s.group_id === session.group_id;
      return !s.group_id && !s.preparation_id;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const position = siblings.findIndex(s => s.id === session.id) + 1;
  return `S${weekNum}-${position}/${siblings.length}`;
}

export function getSessionLabel(
  session: Session,
  groups: Group[],
  preparations: SpecificPreparation[],
): string {
  if (session.preparation_id) {
    const prep = preparations.find(p => p.id === session.preparation_id);
    return prep?.name || '';
  }
  if (session.group_id) {
    const group = groups.find(g => g.id === session.group_id);
    return group?.name || '';
  }
  return 'Tous';
}
