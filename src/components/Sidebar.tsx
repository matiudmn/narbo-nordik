import { NavLink } from 'react-router-dom';
import { House, Users, User, LayoutDashboard, ClipboardList, BarChart3, ClipboardCheck, Bell, MessageCircle, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInAppNotifications } from '../contexts/InAppNotificationContext';
import Avatar from './Avatar';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useInAppNotifications();
  const isCoach = user?.role === 'coach';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-accent/10 text-accent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const coachLinks = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/coach', label: 'Suivi', icon: LayoutDashboard, end: true },
    { to: '/club', label: 'Club', icon: BarChart3 },
    { to: '/coach/sessions', label: 'Planning', icon: ClipboardList },
    { to: '/directory', label: 'Athletes', icon: Users },
    { to: '/profile', label: 'Profil', icon: User },
  ];

  const athleteLinks = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/suivi', label: 'Suivi', icon: ClipboardCheck },
    { to: '/club', label: 'Club', icon: BarChart3 },
    { to: '/directory', label: 'Athletes', icon: Users },
    { to: '/profile', label: 'Profil', icon: User },
  ];

  const links = isCoach ? coachLinks : athleteLinks;

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 flex-col z-50">
      {/* Logo + role */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
        <img src="/logo-club.png" alt="Narbo Nordik" className="h-10 w-10 rounded-full" />
        <div>
          <p className="text-sm font-bold text-gray-900">Narbo Nordik</p>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            {isCoach ? 'Coach' : 'Athlete'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(link => (
          <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
            <link.icon size={18} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Utility links */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1">
        <NavLink to="/notifications" className={linkClass}>
          <div className="relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </NavLink>
        <a
          href="https://chat.whatsapp.com/JwBh6hcJ7o00aBqonTAtD8?mode=hqctcli"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <MessageCircle size={18} />
          <span>WhatsApp</span>
        </a>
        <NavLink to="/aide" className={linkClass}>
          <HelpCircle size={18} />
          <span>Aide</span>
        </NavLink>
      </div>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2">
          {user && <Avatar user={user} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.firstname} {user?.lastname}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
            aria-label="Se deconnecter"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
