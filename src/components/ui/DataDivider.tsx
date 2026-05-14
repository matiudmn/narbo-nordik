import type { ReactNode } from 'react';

interface DataDividerProps {
  label?: ReactNode;
  /** Alignement du label */
  align?: 'left' | 'center' | 'right';
  className?: string;
}

/**
 * Séparateur horizontal avec label discret intégré.
 * Usage : listes longues groupées par période (semaines, mois).
 */
export function DataDivider({ label, align = 'left', className = '' }: DataDividerProps) {
  if (!label) {
    return <hr className={`border-t border-neutral-100 my-3 ${className}`} />;
  }

  const alignClasses = {
    left: 'before:hidden',
    center: '',
    right: 'after:hidden',
  } as const;

  return (
    <div
      className={[
        'flex items-center gap-3 my-3',
        'before:flex-1 before:h-px before:bg-neutral-100',
        'after:flex-1 after:h-px after:bg-neutral-100',
        alignClasses[align],
        className,
      ].join(' ')}
      role="separator"
    >
      <span className="label-micro text-neutral-400">{label}</span>
    </div>
  );
}
