import { NavLink } from 'react-router-dom';
import { House, Users, User, LayoutDashboard, ClipboardList, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function BottomNav() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-xs transition-colors ${
      isActive ? 'text-accent font-semibold' : 'text-gray-500'
    }`;

  if (isCoach) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)] z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavLink to="/" end className={linkClass}>
            <House size={22} />
            <span>Home</span>
          </NavLink>
          <NavLink to="/coach" end className={linkClass}>
            <LayoutDashboard size={22} />
            <span>Suivi</span>
          </NavLink>
          <NavLink to="/club" className={linkClass}>
            <BarChart3 size={22} />
            <span>Club</span>
          </NavLink>
          <NavLink to="/coach/sessions" className={linkClass}>
            <ClipboardList size={22} />
            <span>Planning</span>
          </NavLink>
          <NavLink to="/directory" className={linkClass}>
            <Users size={22} />
            <span>Athletes</span>
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <User size={22} />
            <span>Profil</span>
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavLink to="/" end className={linkClass}>
          <House size={22} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/club" className={linkClass}>
          <BarChart3 size={22} />
          <span>Club</span>
        </NavLink>
        <NavLink to="/directory" className={linkClass}>
          <Users size={22} />
          <span>Athletes</span>
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <User size={22} />
          <span>Profil</span>
        </NavLink>
      </div>
    </nav>
  );
}
