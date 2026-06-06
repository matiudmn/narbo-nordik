import type { ReactNode } from 'react';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface ProgressRingProps {
  /** Valeur actuelle (0-max) */
  value: number;
  /** Max (défaut: 100) */
  max?: number;
  /** Diamètre en px (défaut: 64) */
  size?: number;
  /** Épaisseur du trait (défaut: 6) */
  stroke?: number;
  /** Couleur du progrès */
  tone?: Tone;
  /** Contenu au centre (chiffre + label) */
  children?: ReactNode;
  className?: string;
}

const toneStrokes: Record<Tone, string> = {
  primary: 'stroke-primary',
  accent: 'stroke-accent',
  success: 'stroke-success-500',
  warning: 'stroke-warning-500',
  danger: 'stroke-danger-500',
  info: 'stroke-info-500',
};

/**
 * Anneau circulaire SVG pour assiduité / objectif hebdo / progression.
 * Stroke animée via CSS transition (pas de motion lib pour ce composant
 * vu qu'il est très utilisé et doit rester léger).
 */
export function ProgressRing({
  value,
  max = 100,
  size = 64,
  stroke = 6,
  tone = 'primary',
  children,
  className = '',
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(value / max, 1));
  const offset = circumference * (1 - ratio);
  const pct = Math.round(ratio * 100);

  return (
    <div
      className={['relative inline-flex items-center justify-center', className].join(' ')}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Progression : ${pct} pour cent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-neutral-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={toneStrokes[tone]}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
