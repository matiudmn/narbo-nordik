import { Dumbbell, Trophy, Mountain, Battery, Bike, Footprints, Activity } from 'lucide-react';
import type { SessionType } from '../../types';

type Size = 'sm' | 'md';

interface SessionTypeBadgeProps {
  type: SessionType;
  size?: Size;
  /** Mode compact (icône seule) ou avec label */
  iconOnly?: boolean;
  className?: string;
}

const config: Record<SessionType, { label: string; icon: typeof Dumbbell; varKey: string }> = {
  entrainement: { label: 'Entraînement', icon: Dumbbell, varKey: 'entrainement' },
  course: { label: 'Course', icon: Trophy, varKey: 'course' },
  sortie_longue: { label: 'Sortie longue', icon: Mountain, varKey: 'sortie-longue' },
  recuperation: { label: 'Récupération', icon: Battery, varKey: 'recuperation' },
  velo: { label: 'Vélo', icon: Bike, varKey: 'velo' },
  marche: { label: 'Marche', icon: Footprints, varKey: 'marche' },
  renfo: { label: 'Renfo', icon: Dumbbell, varKey: 'renfo' },
};

/**
 * Badge typé par session_type avec icône + couleur dédiée.
 * Couleurs définies par tokens --color-session-* (cf. index.css).
 */
export function SessionTypeBadge({ type, size = 'sm', iconOnly = false, className = '' }: SessionTypeBadgeProps) {
  const cfg = config[type] ?? { label: 'Séance', icon: Activity, varKey: 'entrainement' };
  const Icon = cfg.icon;
  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const style = {
    backgroundColor: `var(--color-session-${cfg.varKey}-tint)`,
    color: `var(--color-session-${cfg.varKey})`,
  };

  if (iconOnly) {
    return (
      <span
        aria-label={cfg.label}
        title={cfg.label}
        className={[
          'inline-flex items-center justify-center rounded-md',
          size === 'sm' ? 'w-6 h-6' : 'w-7 h-7',
          className,
        ].join(' ')}
        style={style}
      >
        <Icon size={iconSize} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        padding,
        textSize,
        className,
      ].join(' ')}
      style={style}
    >
      <Icon size={iconSize} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
