import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isThisWeek, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, Users, MessageSquare, CheckCircle, AlertTriangle, Phone, ChevronRight, Settings, Paperclip, FileText } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';
import { getAttachmentUrl } from '../../lib/storage';
import Avatar from '../../components/Avatar';

export default function Dashboard() {
  const { sessions, validations, users } = useData();

  const members = useMemo(() => users.filter(u => u.email !== SUPER_ADMIN_EMAIL), [users]);

  const stats = useMemo(() => {
    const weekSessions = sessions.filter(s => !s.is_personal && isThisWeek(new Date(s.date), { weekStartsOn: 1 }));
    const weekSessionIds = weekSessions.map(s => s.id);
    const weekValidations = validations.filter(v => weekSessionIds.includes(v.session_id));
    const doneCount = weekValidations.filter(v => v.status === 'done').length;
    const totalExpected = weekSessions.length * members.length;

    return {
      completionRate: totalExpected > 0 ? Math.round((doneCount / totalExpected) * 100) : 0,
      sessionsThisWeek: weekSessions.length,
      memberCount: members.length,
    };
  }, [sessions, validations, members]);

  const inactivityAlerts = useMemo(() => {
    const now = new Date();
    const thresholds = [
      { days: 45, label: 'Plus de 45 jours', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
      { days: 20, label: 'Plus de 20 jours', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
      { days: 7, label: 'Plus de 7 jours', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
    ];

    const sessionDateMap = new Map(sessions.map(s => [s.id, new Date(s.date)]));
    const lastDoneByUser = new Map<string, Date>();
    for (const v of validations) {
      if (v.status !== 'done') continue;
      const d = sessionDateMap.get(v.session_id);
      if (!d) continue;
      const prev = lastDoneByUser.get(v.user_id);
      if (!prev || d > prev) lastDoneByUser.set(v.user_id, d);
    }

    const athletesWithLastDone = members.map(athlete => {
      const lastDate = lastDoneByUser.get(athlete.id);
      return { athlete, daysSince: lastDate ? differenceInDays(now, lastDate) : Infinity };
    });

    return thresholds.map(threshold => {
      const nextThreshold = thresholds[thresholds.indexOf(threshold) - 1]?.days ?? Infinity;
      const matched = athletesWithLastDone
        .filter(a => a.daysSince >= threshold.days && a.daysSince < nextThreshold)
        .sort((a, b) => b.daysSince - a.daysSince);
      return { ...threshold, athletes: matched };
    }).filter(t => t.athletes.length > 0);
  }, [members, validations, sessions]);

  const recentFeedback = useMemo(() => {
    return validations
      .filter(v => v.feedback || v.attachment_path)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(v => {
        const athlete = users.find(u => u.id === v.user_id);
        const session = sessions.find(s => s.id === v.session_id);
        return { ...v, athlete, session };
      });
  }, [validations, users, sessions]);

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.completionRate}%</p>
          <p className="text-xs text-gray-500 mt-0.5">Realisation semaine</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
              <CheckCircle size={20} className="text-accent" />
            </div>
          </div>
          <p className="text-2xl font-bold text-accent">{stats.sessionsThisWeek}</p>
          <p className="text-xs text-gray-500 mt-0.5">Seances cette semaine</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
              <Users size={20} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.memberCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Membres</p>
        </div>
      </div>

      {/* Quick action */}
      <Link to="/coach/settings" className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
          <Settings size={18} className="text-primary" />
        </div>
        <span className="flex-1 text-sm font-medium text-gray-900">Parametres</span>
        <ChevronRight size={16} className="text-gray-300" />
      </Link>

      {/* Inactivity alerts */}
      {inactivityAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
            <AlertTriangle size={18} className="text-orange-500" />
            Alertes inactivite
          </h2>
          <div className="space-y-3">
            {inactivityAlerts.map(group => (
              <div key={group.days} className={`rounded-lg border ${group.borderColor} ${group.bgColor} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${group.color}`} />
                  <span className={`text-sm font-bold ${group.textColor}`}>
                    {group.label} ({group.athletes.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {group.athletes.map(({ athlete, daysSince }) => (
                    <div key={athlete.id} className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2">
                      <Avatar user={athlete} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {athlete.firstname} {athlete.lastname}
                        </p>
                        <p className="text-xs text-gray-400">
                          {daysSince === Infinity ? 'Aucune seance validee' : `${daysSince} jours`}
                        </p>
                      </div>
                      {athlete.phone && (
                        <a
                          href={`tel:${athlete.phone}`}
                          className={`p-2 rounded-full ${group.bgColor} hover:opacity-70 transition-opacity`}
                          onClick={e => e.stopPropagation()}
                        >
                          <Phone size={16} className={group.textColor} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent feedback */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <MessageSquare size={18} className="text-primary" />
          Derniers retours athletes
        </h2>

        {recentFeedback.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucun retour pour le moment</p>
        ) : (
          <div className="space-y-3">
            {recentFeedback.map(item => (
              <div key={item.id} className="border-l-2 border-primary/20 pl-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {item.athlete?.firstname} {item.athlete?.lastname}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(item.created_at), 'dd/MM', { locale: fr })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-0.5">{item.session?.title}</p>
                {item.feedback && <p className="text-sm text-gray-700 italic">"{item.feedback}"</p>}
                {item.attachment_path && (
                  <a
                    href={getAttachmentUrl(item.attachment_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    {item.attachment_type?.startsWith('image/') ? <Paperclip size={12} /> : <FileText size={12} />}
                    {item.attachment_type?.startsWith('image/') ? 'Photo jointe' : 'PDF joint'}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
