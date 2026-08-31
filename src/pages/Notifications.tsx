import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CalendarPlus, Trophy, TrendingUp, Mail, Info, Heart, CheckCheck, UserPlus, Gauge } from 'lucide-react';
import { useInAppNotifications } from '../contexts/InAppNotificationContext';
import { Disclosure, EmptyState } from '../components/ui';
import { PageSkeleton } from '../components/Skeleton';
import type { AppNotification } from '../types';

// Type de retour explicite : un `case` manquant devient une erreur de compilation
// (le switch tomberait en fin de fonction avec `undefined`).
function getNotifIcon(type: AppNotification['type']): ReactElement {
  switch (type) {
    case 'new_session': return <CalendarPlus size={18} className="text-primary" />;
    case 'palmares': return <Trophy size={18} className="text-warning-500" />;
    case 'vma_update': return <TrendingUp size={18} className="text-success-500" />;
    case 'weekly_digest': return <Mail size={18} className="text-info-500" />;
    case 'reaction': return <Heart size={18} className="text-danger-500" />;
    case 'new_athlete': return <UserPlus size={18} className="text-accent-text" />;
    case 'vma_missing': return <Gauge size={18} className="text-warning-500" />;
    case 'system': return <Info size={18} className="text-neutral-500" />;
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

function NotificationCard({
  notif,
  onOpen,
}: {
  notif: AppNotification;
  onOpen: (notif: AppNotification) => void;
}) {
  // Une notification deja lue et sans lien n'ouvre rien : elle reste un bloc de
  // texte, sans affordance de clic ni cible au clavier. Les autres sont de vrais
  // boutons, donc atteignables au clavier et annoncees comme actionnables.
  const actionable = !notif.read || Boolean(notif.link);
  const base = 'w-full text-left flex items-start gap-3 bg-white rounded-xl border border-neutral-100 p-3.5 transition-colors';

  const content = (
    <>
      <span className="mt-0.5 relative shrink-0">
        {getNotifIcon(notif.type)}
        {!notif.read && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm ${notif.read ? 'text-neutral-600' : 'text-neutral-900 font-semibold'}`}>
          {notif.title}
        </span>
        {notif.body && (
          <span className="block text-xs text-neutral-400 mt-0.5 truncate">{notif.body}</span>
        )}
      </span>
      <span className="text-xs text-neutral-300 whitespace-nowrap mt-0.5">
        {format(new Date(notif.created_at), 'HH:mm')}
      </span>
    </>
  );

  if (!actionable) return <div className={base}>{content}</div>;

  return (
    <button type="button" onClick={() => onOpen(notif)} className={`${base} cursor-pointer hover:bg-neutral-50`}>
      {content}
    </button>
  );
}

function NotificationList({
  notifications,
  onOpen,
}: {
  notifications: AppNotification[];
  onOpen: (notif: AppNotification) => void;
}) {
  return (
    <div className="space-y-4">
      {groupByDay(notifications).map(group => (
        <div key={group.date}>
          <p className="text-xs font-bold text-neutral-400 uppercase mb-2">
            {formatGroupDate(group.items[0].created_at)}
          </p>
          <div className="space-y-2">
            {group.items.map(notif => (
              <NotificationCard key={notif.id} notif={notif} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Notifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useInAppNotifications();
  const navigate = useNavigate();

  // La page est une liste de choses a traiter (demande du coach David) : une
  // notification traitee sort de la liste principale et rejoint le bloc
  // "Deja lues", qui garde l'historique consultable sans encombrer.
  const unread = notifications.filter(n => !n.read);
  const alreadyRead = notifications.filter(n => n.read);

  const openNotification = (notif: AppNotification) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  // Sans cette garde, le premier rendu annonce "Tout est calme" avant meme
  // d'avoir recu les notifications.
  if (loading && notifications.length === 0) return <PageSkeleton />;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-neutral-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-medium bg-accent/15 text-accent-dark px-2 py-0.5 rounded-full tabular">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            aria-label="Marquer toutes les notifications comme lues"
          >
            <CheckCheck size={16} aria-hidden="true" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {unread.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} />}
          title="Tout est calme"
          description={
            alreadyRead.length > 0
              ? 'Tu as traité toutes tes notifications.'
              : 'Tu seras notifié·e dès qu\'une séance arrive ou qu\'un athlète interagit avec toi.'
          }
        />
      ) : (
        <NotificationList notifications={unread} onOpen={openNotification} />
      )}

      {alreadyRead.length > 0 && (
        <Disclosure title={`Déjà lues (${alreadyRead.length})`} headingLevel={2}>
          <NotificationList notifications={alreadyRead} onOpen={openNotification} />
        </Disclosure>
      )}
    </div>
  );
}
