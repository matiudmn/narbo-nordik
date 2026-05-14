import Avatar from '../Avatar';
import type { User } from '../../types';

interface AvatarStackProps {
  users: User[];
  /** Nombre max d'avatars affichés (le reste passe en "+N") */
  max?: number;
  /** Taille des avatars */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { ring: 'w-7 h-7', overlap: '-ml-2', text: 'text-[10px]' },
  md: { ring: 'w-9 h-9', overlap: '-ml-2.5', text: 'text-xs' },
  lg: { ring: 'w-11 h-11', overlap: '-ml-3', text: 'text-sm' },
} as const;

/**
 * Pile d'avatars chevauchés avec compteur "+N" si débordement.
 * Usage : participants d'une séance, membres d'un groupe, prep cohort.
 */
export function AvatarStack({ users, max = 4, size = 'md', className = '' }: AvatarStackProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const extra = users.length - visible.length;
  const cfg = sizeClasses[size];

  return (
    <div className={['flex items-center', className].join(' ')} aria-label={`${users.length} membres`}>
      {visible.map((user, i) => (
        <div
          key={user.id}
          className={[
            'relative rounded-full ring-2 ring-white',
            i > 0 ? cfg.overlap : '',
          ].join(' ')}
          style={{ zIndex: visible.length - i }}
        >
          <Avatar user={user} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className={[
            'rounded-full ring-2 ring-white bg-neutral-200 text-neutral-700 font-semibold flex items-center justify-center',
            cfg.ring,
            cfg.overlap,
            cfg.text,
          ].join(' ')}
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
