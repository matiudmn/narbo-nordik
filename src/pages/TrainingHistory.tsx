import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Paperclip, Dumbbell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { getSessionCode } from '../lib/calculations';
import { StatusBadge, EmptyState, SessionTypeBadge, DataDivider } from '../components/ui';
import type { SessionStatus } from '../components/ui';

type Filter = 'all' | 'done' | 'missed' | 'personal';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'done', label: 'Validées' },
  { id: 'missed', label: 'Ratées' },
  { id: 'personal', label: 'Perso' },
];

export default function TrainingHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, validations, users, userPreparations } = useData();
  const [filter, setFilter] = useState<Filter>('all');

  const targetUserId = searchParams.get('user');
  const targetUser = targetUserId ? users.find((u) => u.id === targetUserId) : user;

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
        <p className="text-gray-500">Accès non autorisé</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const userPrepIds = useMemo(
    () => userPreparations.filter((up) => up.user_id === targetUser.id).map((up) => up.preparation_id),
    [userPreparations, targetUser.id]
  );

  const allSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (s.is_personal) return s.created_by === targetUser.id;
        if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
        if (!s.group_id) return true;
        return s.group_id === targetUser.group_id;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, targetUser.group_id, userPrepIds, targetUser.id]);

  const getValidation = (sessionId: string) =>
    validations.find((v) => v.session_id === sessionId && v.user_id === targetUser.id);

  // Counts par filtre (pour afficher dans les pills)
  const counts = useMemo(() => {
    let done = 0,
      missed = 0,
      personal = 0;
    allSessions.forEach((s) => {
      if (s.is_personal) personal++;
      const v = getValidation(s.id);
      if (v?.status === 'done') done++;
      if (v?.status === 'missed') missed++;
    });
    return { all: allSessions.length, done, missed, personal };
  }, [allSessions, validations, targetUser.id]);

  const filteredSessions = useMemo(() => {
    return allSessions.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'personal') return s.is_personal;
      const v = getValidation(s.id);
      return v?.status === filter;
    });
  }, [allSessions, filter, validations, targetUser.id]);

  // Groupement par mois
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, { label: string; sessions: typeof filteredSessions; doneCount: number }>();
    filteredSessions.forEach((s) => {
      const monthKey = format(startOfMonth(new Date(s.date)), 'yyyy-MM');
      const monthLabel = format(new Date(s.date), 'MMMM yyyy', { locale: fr });
      if (!map.has(monthKey)) {
        map.set(monthKey, { label: monthLabel, sessions: [], doneCount: 0 });
      }
      const group = map.get(monthKey)!;
      group.sessions.push(s);
      const v = getValidation(s.id);
      if (v?.status === 'done') group.doneCount++;
    });
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [filteredSessions, validations, targetUser.id]);

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} aria-hidden="true" />
        <span className="text-sm">Retour</span>
      </button>

      <h1 className="text-lg font-bold text-gray-900 mb-1">Historique des séances</h1>
      {!isOwnProfile && (
        <p className="text-sm text-gray-500 mb-2">
          {targetUser.firstname} {targetUser.lastname}
        </p>
      )}

      {/* Filtres pills */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 mb-3" role="tablist" aria-label="Filtres">
        {FILTERS.map((f) => {
          const selected = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.id)}
              className={[
                'shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
                selected
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
              ].join(' ')}
            >
              <span>{f.label}</span>
              {count > 0 && (
                <span className={`text-[10px] tabular ${selected ? 'opacity-80' : 'text-neutral-400'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {filteredSessions.length === 0 ? (
        filter === 'all' ? (
          <EmptyState
            icon={<Dumbbell size={28} />}
            title="Aucune séance pour l'instant"
            description="Les séances s'afficheront ici dès qu'elles auront été validées."
          />
        ) : (
          <EmptyState
            title="Aucun résultat pour ce filtre"
            description="Essaie un autre filtre pour voir tes séances."
            actionLabel="Voir toutes les séances"
            actionVariant="secondary"
            onAction={() => setFilter('all')}
          />
        )
      ) : (
        <div>
          {groupedByMonth.map((group) => (
            <div key={group.key}>
              <DataDivider
                label={
                  <span className="flex items-baseline gap-2">
                    <span>{group.label}</span>
                    <span className="normal-case font-normal text-neutral-400">
                      {group.sessions.length} séance{group.sessions.length > 1 ? 's' : ''}
                      {' · '}
                      {group.doneCount} validée{group.doneCount > 1 ? 's' : ''}
                    </span>
                  </span>
                }
              />
              <div className="space-y-2">
                {group.sessions.map((session) => {
                  const validation = getValidation(session.id);
                  const status = (validation?.status || 'pending') as SessionStatus;

                  return (
                    <Link
                      key={session.id}
                      to={`/session/${session.id}`}
                      className="block bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 hover:shadow-card-hover transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <SessionTypeBadge type={session.session_type} iconOnly />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-neutral-900 truncate">
                              {session.title}
                              <span className="text-xs font-normal text-neutral-400 ml-1.5">
                                {getSessionCode(session, sessions)}
                              </span>
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-neutral-400">
                                {format(new Date(session.date), 'EEEE d MMM', { locale: fr })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={status} withIcon className="flex-shrink-0" />
                      </div>
                      {validation?.feedback && (
                        <p className="text-sm text-neutral-500 italic mt-2">« {validation.feedback} »</p>
                      )}
                      {validation?.attachment_path && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                          <Paperclip size={12} aria-hidden="true" />
                          Pièce jointe
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
