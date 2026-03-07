import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import Avatar from './Avatar';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 bg-primary text-white z-50">
      <div className="flex items-center justify-between h-14 px-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-club.svg" alt="Narbo Nordik Club" className="h-8 w-8 invert" />
          <span className="text-lg font-bold tracking-tight">NARBO NORDIK</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {user?.role === 'coach' ? 'Coach' : 'Athlete'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm px-2 py-1">
            {user && <Avatar user={user} size="sm" />}
            {user?.firstname}
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
