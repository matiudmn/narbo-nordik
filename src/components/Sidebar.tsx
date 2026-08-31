import { NavLink } from 'react-router-dom';
import { House, Users, User, LayoutDashboard, ClipboardList, BarChart3, ClipboardCheck, Bell, MessageCircle, HelpCircle, LogOut, Upload, Download, Target, Settings, Search, History, Landmark } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInAppNotifications } from '../contexts/InAppNotificationContext';
import { useGlobalSearch } from '../contexts/GlobalSearchContext';
import Avatar from './Avatar';

// Indice clavier adapté à la plateforme (Cmd sur Mac, Ctrl ailleurs).
const SHORTCUT_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  ? '⌘K' : 'Ctrl K';

export default function Sidebar() {
  const { user, logout, isBoard } = useAuth();
  const { unreadCount } = useInAppNotifications();
  const { open: openSearch } = useGlobalSearch();
  const isCoach = user?.role === 'coach';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      isActive ? 'bg-accent/10 text-accent-text' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    }`;

  const coachLinks = [
    { to: '/', label: 'Mon entraînement', icon: House, end: true },
    { to: '/coach', label: 'Suivi', icon: LayoutDashboard, end: true },
    { to: '/club', label: 'Club', icon: BarChart3 },
    { to: '/coach/sessions', label: 'Planning', icon: ClipboardList },
    { to: '/coach/historique', label: 'Historique', icon: History },
    { to: '/coach/import', label: 'Import Excel', icon: Upload },
    { to: '/coach/export', label: 'Export tableur', icon: Download },
    { to: '/coach/settings?tab=preparations', label: 'Prépas spé', icon: Target },
    { to: '/directory', label: 'Athletes', icon: Users },
    { to: '/coach/settings', label: 'Réglages', icon: Settings },
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
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-neutral-200 flex-col z-50">
      {/* Logo + role */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-neutral-100">
        <img src="/logo-club.png" alt="Narbo Nordik" className="h-10 w-10 rounded-full" />
        <div>
          <p className="text-sm font-bold text-neutral-900">Narbo Nordik</p>
          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
            {isCoach ? 'Coach' : 'Athlete'}
          </span>
        </div>
      </div>

      {/* Recherche universelle */}
      <div className="px-3 pt-4">
        <button
          onClick={openSearch}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Rechercher"
        >
          <Search size={16} className="flex-shrink-0" />
          <span className="flex-1 text-left">Rechercher...</span>
          <kbd className="flex-shrink-0 text-[10px] font-sans font-medium text-neutral-400 bg-white border border-neutral-200 rounded px-1.5 py-0.5">{SHORTCUT_HINT}</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {links.map(link => (
          <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
            <link.icon size={18} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Utility links */}
      <div className="px-3 py-3 border-t border-neutral-100 space-y-1">
        {isBoard && (
          <NavLink to="/bureau" className={linkClass}>
            <Landmark size={18} />
            <span>Bureau</span>
          </NavLink>
        )}
        <NavLink to="/notifications" className={linkClass}>
          <div className="relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-danger-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
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
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <div className="px-3 py-4 border-t border-neutral-100">
        <div className="flex items-center gap-3 px-2">
          {user && <Avatar user={user} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">{user?.firstname} {user?.lastname}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-neutral-400 hover:text-danger-500 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Se deconnecter"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
