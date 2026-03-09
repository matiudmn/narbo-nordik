import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, X, Bell, MessageCircle } from 'lucide-react';
import Avatar from './Avatar';
import { useInAppNotifications } from '../contexts/InAppNotificationContext';

export default function Header() {
  const { user, effectiveUser, isSuperAdmin, isImpersonating, impersonate, logout } = useAuth();
  const { unreadCount } = useInAppNotifications();
  const navigate = useNavigate();

  const handleStopImpersonating = () => {
    impersonate(null);
    navigate('/coach/dashboard');
  };

  return (
    <>
      {isImpersonating && effectiveUser && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-yellow-900 z-[60] h-8 flex items-center justify-center text-xs font-bold gap-2">
          <span>Vue en tant que {effectiveUser.firstname} {effectiveUser.lastname}</span>
          <button
            onClick={handleStopImpersonating}
            className="flex items-center gap-0.5 bg-yellow-600 text-white px-2 py-0.5 rounded-full text-[10px] hover:bg-yellow-700 transition-colors"
          >
            <X size={10} />
            Quitter
          </button>
        </div>
      )}
      <header className={`fixed left-0 right-0 bg-primary text-white z-50 ${isImpersonating ? 'top-8' : 'top-0'}`}>
        <div className="flex items-center justify-between h-14 px-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <img src="/logo-club.png" alt="Narbo Nordik Club" className="h-8 w-8 rounded-full" />
            <span className="text-lg font-bold tracking-tight">NARBO NORDIK</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {user?.role === 'coach' ? 'Coach' : 'Athlete'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && !isImpersonating && (
              <div className="p-1.5 bg-white/20 rounded-full" title="Super Admin">
                <Shield size={14} />
              </div>
            )}
            <a
              href="https://chat.whatsapp.com/JwBh6hcJ7o00aBqonTAtD8?mode=hqctcli"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Groupe WhatsApp"
            >
              <MessageCircle size={18} />
            </a>
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
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
    </>
  );
}
