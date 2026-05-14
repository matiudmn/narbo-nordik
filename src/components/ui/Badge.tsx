import type { HTMLAttributes, ReactNode } from 'react';
import { Check, X as XIcon, Clock, Calendar } from 'lucide-react';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: ReactNode;
  children: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent-dark',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-info-100 text-info-700',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
};

/**
 * Badge générique avec tonalité sémantique.
 * Pour les statuts de séance, préférer <StatusBadge>.
 */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        toneClasses[tone],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------
   StatusBadge — spécifique aux séances et workflow métier
   ------------------------------------------------------------ */

export type SessionStatus = 'done' | 'missed' | 'pending' | 'upcoming';

const statusConfig: Record<
  SessionStatus,
  { label: string; tone: BadgeTone; Icon: typeof Check }
> = {
  done: { label: 'Validée', tone: 'success', Icon: Check },
  missed: { label: 'Ratée', tone: 'danger', Icon: XIcon },
  pending: { label: 'À valider', tone: 'warning', Icon: Clock },
  upcoming: { label: 'À venir', tone: 'info', Icon: Calendar },
};

interface StatusBadgeProps {
  status: SessionStatus;
  size?: BadgeSize;
  withIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'sm',
  withIcon = false,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <Badge
      tone={config.tone}
      size={size}
      icon={withIcon ? <config.Icon size={iconSize} aria-hidden="true" /> : undefined}
      className={className}
    >
      {config.label}
    </Badge>
  );
}
