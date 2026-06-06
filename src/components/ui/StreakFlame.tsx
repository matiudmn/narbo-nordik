import { Flame } from 'lucide-react';

interface StreakFlameProps {
  /** Nombre de semaines consécutives */
  weeks: number;
  /** Taille — sm (inline) ou md (card) */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Compteur de streak — flamme orange + nombre de semaines.
 * Affiche rien si streak === 0.
 */
export function StreakFlame({ weeks, size = 'sm', className = '' }: StreakFlameProps) {
  if (weeks < 1) return null;

  const isHot = weeks >= 4;
  const iconSize = size === 'sm' ? 14 : 20;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-semibold tabular',
        isHot ? 'text-warning-600' : 'text-neutral-500',
        textSize,
        className,
      ].join(' ')}
      aria-label={`Série de ${weeks} semaines consécutives`}
    >
      <Flame size={iconSize} className={isHot ? 'text-warning-500' : 'text-neutral-400'} aria-hidden="true" />
      {weeks} sem.
    </span>
  );
}
