import type { HTMLAttributes, ReactNode } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  interactive?: boolean;
  children: ReactNode;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Card primitive — remplace le pattern dupliqué
 * "bg-white rounded-xl border border-gray-100 p-4" (60+ occurrences).
 */
export function Card({
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-xl border border-neutral-100',
        paddingClasses[padding],
        interactive
          ? 'transition-colors hover:border-neutral-200 hover:shadow-sm cursor-pointer'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action, className = '', ...rest }: CardHeaderProps) {
  return (
    <div className={['flex items-start justify-between gap-3 mb-3', className].filter(Boolean).join(' ')} {...rest}>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-neutral-900 truncate">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
