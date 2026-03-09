import { useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Check, X, Clock, Paperclip, Dumbbell, Mountain, Battery } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import type { SessionType } from '../types';

const SESSION_TYPE_INFO: Record<SessionType, { label: string; icon: typeof Dumbbell }> = {
  entrainement: { label: 'Entrainement', icon: Dumbbell },
  sortie_longue: { label: 'Sortie Longue', icon: Mountain },
  recuperation: { label: 'Recuperation', icon: Battery },
};

const STATUS_BADGES = {
  done: { label: 'Fait', bg: 'bg-green-100', text: 'text-green-700', icon: Check },
  missed: { label: 'Manque', bg: 'bg-red-100', text: 'text-red-700', icon: X },
  pending: { label: 'En attente', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
} as const;

export default function TrainingHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, validations, users, userPreparations } = useData();

  const targetUserId = searchParams.get('user');
  const targetUser = targetUserId ? users.find(u => u.id === targetUserId) : user;

  if (!targetUser) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Utilisateur introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  if (!isOwnProfile && user?.role !== 'coach') {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Acces non autorise</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const userPrepIds = useMemo(() =>
    userPreparations.filter(up => up.user_id === targetUser.id).map(up => up.preparation_id),
    [userPreparations, targetUser.id]
  );

  const targetSessions = useMemo(() => {
    return sessions
      .filter(s => {
        if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
        if (!s.group_id) return true;
        return s.group_id === targetUser.group_id;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, targetUser.group_id, userPrepIds]);

  const getValidation = (sessionId: string) =>
    validations.find(v => v.session_id === sessionId && v.user_id === targetUser.id);

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <h1 className="text-lg font-bold text-gray-900 mb-1">
        Historique des seances
      </h1>
      {!isOwnProfile && (
        <p className="text-sm text-gray-500 mb-4">{targetUser.firstname} {targetUser.lastname}</p>
      )}

      {targetSessions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Aucune seance</p>
        </div>
      ) : (
        <div className="space-y-2">
          {targetSessions.map(session => {
            const validation = getValidation(session.id);
            const status = validation?.status || 'pending';
            const badge = STATUS_BADGES[status];
            const BadgeIcon = badge.icon;
            const typeInfo = SESSION_TYPE_INFO[session.session_type];
            const TypeIcon = typeInfo.icon;

            return (
              <Link
                key={session.id}
                to={`/session/${session.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <TypeIcon size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{session.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">
                          {format(new Date(session.date), 'EEEE d MMMM yyyy', { locale: fr })}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{typeInfo.label}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}>
                    <BadgeIcon size={12} />
                    {badge.label}
                  </span>
                </div>
                {validation?.feedback && (
                  <p className="text-sm text-gray-500 italic mt-2 line-clamp-2">"{validation.feedback}"</p>
                )}
                {validation?.attachment_path && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                    <Paperclip size={12} />
                    Piece jointe
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
