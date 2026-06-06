import type { SessionBlock, AllureZone } from '../../types';
import { getAllureZones } from '../../lib/calculations';

interface AlluresBarProps {
  blocks: SessionBlock[];
  /** Override des zones (sinon défaut) */
  allureZones?: ReturnType<typeof getAllureZones>;
  /** Hauteur en pixels (défaut: 8) */
  height?: number;
  className?: string;
}

/**
 * Barre horizontale segmentée colorée par allure d'un plan de séance.
 * Donne un aperçu visuel rapide de l'intensité (vert calme → rouge violent).
 *
 * Largeur de chaque segment = durée du bloc × ses répétitions / durée totale.
 */
export function AlluresBar({ blocks, allureZones, height = 8, className = '' }: AlluresBarProps) {
  if (blocks.length === 0) return null;

  const zones = allureZones ?? getAllureZones();

  // Calcule la durée totale (effort + repos) de chaque bloc
  const segments = blocks.map((b) => {
    const effortSec = (b.duration_seconds || 0) * b.repetitions;
    const restSec = (b.rest_seconds || 0) * Math.max(0, b.repetitions - 1);
    const total = effortSec + restSec;
    return {
      allure: b.allure as AllureZone,
      total: total > 0 ? total : 1, // fallback pour éviter divide-by-zero
      color: zones[b.allure]?.color ?? 'var(--color-neutral-400)',
      label: zones[b.allure]?.label ?? b.allure,
    };
  });

  const totalDuration = segments.reduce((sum, s) => sum + s.total, 0);

  return (
    <div
      className={['flex w-full overflow-hidden rounded-full bg-neutral-100', className].join(' ')}
      style={{ height: `${height}px` }}
      role="img"
      aria-label="Aperçu visuel des allures de la séance"
    >
      {segments.map((seg, i) => {
        const widthPct = (seg.total / totalDuration) * 100;
        return (
          <div
            key={i}
            title={seg.label}
            style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
