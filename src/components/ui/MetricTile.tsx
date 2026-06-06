import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { RollingNumber } from './RollingNumber';

export type MetricTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface MetricTileProps {
  /** Valeur numérique (animée via RollingNumber) — utilise `value` OU `valueDisplay` */
  value?: number;
  /** Override texte si tu ne veux pas d'animation (ex: "16.5 km/h") */
  valueDisplay?: ReactNode;
  /** Unité affichée petit à côté */
  unit?: string;
  /** Label sous la valeur */
  label: string;
  /** Delta vs période précédente */
  delta?: { value: string; positive?: boolean };
  /** Icône optionnelle en haut */
  icon?: ReactNode;
  /** Tonalité visuelle */
  tone?: MetricTone;
  /** Taille — md (défaut) ou lg pour hero */
  size?: 'md' | 'lg';
  /** Format custom du nombre */
  format?: (v: number) => string;
  className?: string;
}

const toneClasses: Record<MetricTone, { value: string; iconBg: string; iconText: string }> = {
  primary: { value: 'text-primary', iconBg: 'bg-primary/10', iconText: 'text-primary' },
  accent: { value: 'text-accent-dark', iconBg: 'bg-accent/15', iconText: 'text-accent-dark' },
  success: { value: 'text-success-700', iconBg: 'bg-success-50', iconText: 'text-success-600' },
  warning: { value: 'text-warning-700', iconBg: 'bg-warning-50', iconText: 'text-warning-600' },
  danger: { value: 'text-danger-700', iconBg: 'bg-danger-50', iconText: 'text-danger-600' },
  info: { value: 'text-info-700', iconBg: 'bg-info-50', iconText: 'text-info-600' },
  neutral: { value: 'text-neutral-900', iconBg: 'bg-neutral-100', iconText: 'text-neutral-600' },
};

/**
 * Tuile de statistique : gros chiffre animé + label + delta optionnel.
 * Pattern utilisé partout (Home stats, Profile, Dashboard, Suivi).
 */
export function MetricTile({
  value,
  valueDisplay,
  unit,
  label,
  delta,
  icon,
  tone = 'neutral',
  size = 'md',
  format,
  className = '',
}: MetricTileProps) {
  const cfg = toneClasses[tone];
  const valueClass = size === 'lg' ? 'font-stat text-stat-lg' : 'text-2xl font-bold';
  const TrendIcon = delta?.positive === false ? TrendingDown : TrendingUp;

  return (
    <div
      className={[
        'bg-white rounded-xl border border-neutral-100 shadow-card p-4 text-center',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="flex justify-center mb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconBg} ${cfg.iconText}`}>
            {icon}
          </div>
        </div>
      )}
      <div className={`${valueClass} tabular leading-tight ${cfg.value}`}>
        {valueDisplay ?? (value !== undefined ? <RollingNumber value={value} format={format} /> : '—')}
        {unit && <span className="text-sm font-normal text-neutral-400 ml-1">{unit}</span>}
      </div>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
      {delta && (
        <p
          className={[
            'inline-flex items-center gap-1 text-[10px] font-medium tabular mt-1',
            delta.positive === false ? 'text-danger-600' : 'text-success-600',
          ].join(' ')}
        >
          <TrendIcon size={10} aria-hidden="true" />
          {delta.value}
        </p>
      )}
    </div>
  );
}
