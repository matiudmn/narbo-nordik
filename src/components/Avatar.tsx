import type { User } from '../types';

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-20 h-20 text-xl',
} as const;

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarProps {
  user: Pick<User, 'firstname' | 'lastname' | 'photo_url'>;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZES[size];
  const initials = `${user.firstname[0]}${user.lastname[0]}`.toUpperCase();

  if (user.photo_url) {
    return (
      <img
        src={user.photo_url}
        alt={initials}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${getColor(user.firstname + user.lastname)} ${className}`}>
      {initials}
    </div>
  );
}
