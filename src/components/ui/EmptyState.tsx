import type { ReactNode } from 'react';
import { Button } from './Button';
import type { ButtonVariant } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  className?: string;
}

/**
 * Empty state motivant — jamais "Aucun X" sec.
 * Toujours reformuler en invitation.
 *
 * @example
 * <EmptyState
 *   icon={<Calendar size={32} />}
 *   title="Rien de prévu cette semaine"
 *   description="Ton coach publiera bientôt le programme. Profites-en pour une sortie libre !"
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'accent',
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center py-10 px-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <div className="w-14 h-14 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-neutral-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-500 max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          variant={actionVariant}
          size="md"
          onClick={onAction}
          className="mt-5"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
