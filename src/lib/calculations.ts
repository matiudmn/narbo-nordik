import type { PaceCalculation, AllureZone, SessionBlock } from '../types';

export const ALLURE_ZONES: Record<AllureZone, { label: string; pctMin: number; pctMax: number; color: string }> = {
  ef:        { label: 'EF',        pctMin: 55, pctMax: 65, color: '#22c55e' },
  endurance: { label: 'Endurance', pctMin: 65, pctMax: 75, color: '#3b82f6' },
  as42:      { label: 'AS42',      pctMin: 75, pctMax: 85, color: '#eab308' },
  as21:      { label: 'AS21',      pctMin: 85, pctMax: 92, color: '#f97316' },
  vma:       { label: 'VMA',       pctMin: 95, pctMax: 105, color: '#ef4444' },
};

export const BLOCK_TYPES: Record<string, { label: string }> = {
  echauffement:    { label: 'Echauffement' },
  travail:         { label: 'Travail' },
  retour_au_calme: { label: 'Retour au calme' },
};

export function calculateBlockPace(vma: number, zone: AllureZone) {
  const z = ALLURE_ZONES[zone];
  const speedMin = vma * (z.pctMin / 100);
  const speedMax = vma * (z.pctMax / 100);
  return {
    speedMin,
    speedMax,
    paceMin: formatPace(60 / speedMax),
    paceMax: formatPace(60 / speedMin),
  };
}

export function estimateBlockEffortSeconds(block: SessionBlock, vma?: number): number {
  if (block.distance_meters && vma) {
    const zone = ALLURE_ZONES[block.allure];
    const avgPct = (zone.pctMin + zone.pctMax) / 2 / 100;
    const speedMs = (vma * avgPct) / 3.6;
    return Math.round(block.distance_meters / speedMs);
  }
  return block.duration_seconds;
}

export function calculateBlockTotalSeconds(block: SessionBlock, vma?: number): number {
  const effortPerRep = block.distance_meters ? estimateBlockEffortSeconds(block, vma) : block.duration_seconds;
  const effort = effortPerRep * block.repetitions;
  const rest = block.rest_seconds * Math.max(0, block.repetitions - 1);
  return effort + rest;
}

export function calculateSessionTotalSeconds(blocks: SessionBlock[], vma?: number): number {
  return blocks.reduce((sum, b) => sum + calculateBlockTotalSeconds(b, vma), 0);
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

export function formatBlockSummary(block: SessionBlock): string {
  const zone = ALLURE_ZONES[block.allure];
  const effort = block.distance_meters ? formatDistance(block.distance_meters) : formatSeconds(block.duration_seconds);
  if (block.repetitions <= 1) return `${effort} ${zone.label}`;
  const rest = block.rest_seconds > 0 ? ` R=${formatSeconds(block.rest_seconds)}` : '';
  return `${block.repetitions}x${effort} ${zone.label}${rest}`;
}

export const RACE_PACES = {
  sv1:  { label: 'SV1',  pct: 72, color: '#10b981', description: 'Seuil aerobie' },
  sv2:  { label: 'SV2',  pct: 87, color: '#8b5cf6', description: 'Seuil anaerobie' },
  as42: { label: 'AS42', pct: 80, color: '#eab308', description: 'Marathon' },
  as21: { label: 'AS21', pct: 88, color: '#f97316', description: 'Semi' },
  as10: { label: 'AS10', pct: 90, color: '#ef4444', description: '10 km' },
  as5:  { label: 'AS5',  pct: 97, color: '#dc2626', description: '5 km' },
} as const;

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
