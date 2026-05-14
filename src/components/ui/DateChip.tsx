import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateChipProps {
  date: Date | string;
  /** Variant compact (juste j + mois) ou full (Jour J mois) */
  variant?: 'compact' | 'full';
  /** Si true, "Aujourd'hui" / "Demain" / "Hier" en label */
  relative?: boolean;
  /** Tonalité — par défaut neutre */
  tone?: 'neutral' | 'accent' | 'warning';
  className?: string;
}

const toneClasses = {
  neutral: 'bg-neutral-100 text-neutral-700',
  accent: 'bg-accent/15 text-accent-dark',
  warning: 'bg-warning-100 text-warning-700',
} as const;

/**
 * Pastille de date stylée.
 * Si `relative` et la date est aujourd'hui/demain/hier, affiche le label.
 */
export function DateChip({ date, variant = 'compact', relative = true, tone = 'neutral', className = '' }: DateChipProps) {
  const d = typeof date === 'string' ? new Date(date) : date;

  let label: string;
  if (relative && isToday(d)) {
    label = "Aujourd'hui";
  } else if (relative && isTomorrow(d)) {
    label = 'Demain';
  } else if (relative && isYesterday(d)) {
    label = 'Hier';
  } else if (variant === 'compact') {
    label = format(d, 'd MMM', { locale: fr });
  } else {
    label = format(d, 'EEEE d MMMM', { locale: fr });
  }

  return (
    <span
      className={[
        'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
        toneClasses[tone],
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
