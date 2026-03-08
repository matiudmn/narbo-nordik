import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CalendarPlus, Trophy, TrendingUp, Mail, Info, CheckCheck } from 'lucide-react';
import { useInAppNotifications } from '../contexts/InAppNotificationContext';
import type { AppNotification } from '../types';

function getNotifIcon(type: AppNotification['type']) {
  switch (type) {
    case 'new_session': return <CalendarPlus size={18} className="text-primary" />;
    case 'palmares': return <Trophy size={18} className="text-yellow-500" />;
    case 'vma_update': return <TrendingUp size={18} className="text-green-500" />;
    case 'weekly_digest': return <Mail size={18} className="text-blue-500" />;
    case 'system': return <Info size={18} className="text-gray-500" />;
  }
}

function formatGroupDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

function groupByDay(notifications: AppNotification[]) {
  const groups: { date: string; items: AppNotification[] }[] = [];
  for (const n of notifications) {
    const day = format(new Date(n.created_at), 'yyyy-MM-dd');
    const existing = groups.find(g => g.date === day);
    if (existing) {
      existing.items.push(n);
    } else {
      groups.push({ date: day, items: [n] });
    }
  }
  return groups;
}

export default function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useInAppNotifications();
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const id = entry.target.getAttribute('data-notif-id');
      if (!id) continue;
      if (entry.isIntersecting) {
        if (!timersRef.current.has(id)) {
          timersRef.current.set(id, setTimeout(() => {
            markAsRead(id);
            timersRef.current.delete(id);
          }, 1000));
        }
      } else {
        const timer = timersRef.current.get(id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      }
    }
  }, [markAsRead]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersect, { threshold: 0.5 });
    return () => {
      observerRef.current?.disconnect();
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [handleIntersect]);

  const setItemRef = useCallback((el: HTMLDivElement | null, notif: AppNotification) => {
    if (!el || notif.read) return;
    observerRef.current?.observe(el);
  }, []);

  const grouped = groupByDay(notifications);

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 text-sm text-primary font-medium"
          >
            <CheckCheck size={16} />
            Tout lire
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.date}>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                {formatGroupDate(group.items[0].created_at)}
              </p>
              <div className="space-y-2">
                {group.items.map(notif => (
                  <div
                    key={notif.id}
                    ref={el => setItemRef(el, notif)}
                    data-notif-id={notif.id}
                    onClick={() => notif.link && navigate(notif.link)}
                    className={`flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-3.5 transition-colors ${
                      notif.link ? 'cursor-pointer hover:bg-gray-50' : ''
                    }`}
                  >
                    <div className="mt-0.5 relative">
                      {getNotifIcon(notif.type)}
                      {!notif.read && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.read ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{notif.body}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 whitespace-nowrap mt-0.5">
                      {format(new Date(notif.created_at), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
