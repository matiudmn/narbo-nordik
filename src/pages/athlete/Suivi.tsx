import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, Target, Smile, Dumbbell, Mountain, Battery } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { getSessionCode } from '../../lib/calculations';
import type { SessionType } from '../../types';

const SESSION_TYPE_ICON: Record<SessionType, typeof Dumbbell> = {
  entrainement: Dumbbell,
  sortie_longue: Mountain,
  recuperation: Battery,
};

export default function Suivi() {
  const { user } = useAuth();
  const { sessions, validations, userPreparations } = useData();
  const [monthOffset, setMonthOffset] = useState(0);

  const userPrepIds = useMemo(() => {
    if (!user) return [];
    return userPreparations.filter(up => up.user_id === user.id).map(up => up.preparation_id);
  }, [user, userPreparations]);

  const currentMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const completedSessions = useMemo(() => {
    if (!user) return [];

    const userSessions = sessions.filter(s => {
      if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
      if (!s.group_id) return true;
      return s.group_id === user.group_id;
    });

    return userSessions
      .filter(s => {
        const d = new Date(s.date);
        if (d < monthStart || d > monthEnd) return false;
        return validations.some(v =>
          v.session_id === s.id && v.user_id === user.id && v.status === 'done'
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => ({
        session: s,
        validation: validations.find(v => v.session_id === s.id && v.user_id === user.id)!,
      }));
  }, [sessions, validations, user, userPrepIds, monthStart, monthEnd]);

  const stats = useMemo(() => {
    const total = completedSessions.length;
    const objOui = completedSessions.filter(c => c.validation.objective_reached === 'oui').length;
    const objPartiel = completedSessions.filter(c => c.validation.objective_reached === 'partiel').length;
    const objNon = completedSessions.filter(c => c.validation.objective_reached === 'non').length;
    const sensExc = completedSessions.filter(c => c.validation.sensations === 'excellentes').length;
    const sensBon = completedSessions.filter(c => c.validation.sensations === 'bonnes').length;
    const sensMauv = completedSessions.filter(c => c.validation.sensations === 'mauvaises').length;
    return { total, objOui, objPartiel, objNon, sensExc, sensBon, sensMauv };
  }, [completedSessions]);

  if (!user) return null;

  return (
    <div className="py-4">
      <h1 className="text-lg font-bold text-gray-900 mb-4">Mon suivi</h1>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthOffset(p => p - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => setMonthOffset(p => p + 1)}
          disabled={monthOffset >= 0}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Stats summary */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Check size={16} className="text-green-600" />
            <span className="font-semibold text-gray-900">{stats.total} seance{stats.total > 1 ? 's' : ''} validee{stats.total > 1 ? 's' : ''}</span>
          </div>

          {(stats.objOui > 0 || stats.objPartiel > 0 || stats.objNon > 0) && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Target size={12} /> Objectifs</p>
              <div className="flex gap-2">
                {stats.objOui > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Atteint {stats.objOui}</span>}
                {stats.objPartiel > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Partiel {stats.objPartiel}</span>}
                {stats.objNon > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Non atteint {stats.objNon}</span>}
              </div>
            </div>
          )}

          {(stats.sensExc > 0 || stats.sensBon > 0 || stats.sensMauv > 0) && (
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Smile size={12} /> Sensations</p>
              <div className="flex gap-2">
                {stats.sensExc > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Excellentes {stats.sensExc}</span>}
                {stats.sensBon > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Bonnes {stats.sensBon}</span>}
                {stats.sensMauv > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Mauvaises {stats.sensMauv}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session list */}
      {completedSessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Aucune seance validee ce mois</p>
        </div>
      ) : (
        <div className="space-y-2">
          {completedSessions.map(({ session, validation }) => {
            const TypeIcon = SESSION_TYPE_ICON[session.session_type];
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
                      <p className="font-semibold text-gray-900 truncate">
                        {session.title}
                        <span className="text-xs font-normal text-gray-400 ml-1.5">
                          {getSessionCode(session, sessions)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(session.date), 'EEEE d MMMM', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                </div>

                {(validation.objective_reached || validation.sensations) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {validation.objective_reached && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        validation.objective_reached === 'oui' ? 'bg-green-100 text-green-700' :
                        validation.objective_reached === 'partiel' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {validation.objective_reached === 'oui' ? 'Objectif atteint' :
                         validation.objective_reached === 'partiel' ? 'Objectif partiel' : 'Objectif non atteint'}
                      </span>
                    )}
                    {validation.sensations && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        validation.sensations === 'excellentes' ? 'bg-green-100 text-green-700' :
                        validation.sensations === 'bonnes' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {validation.sensations.charAt(0).toUpperCase() + validation.sensations.slice(1)}
                      </span>
                    )}
                  </div>
                )}

                {validation.feedback && (
                  <p className="text-sm text-gray-500 italic mt-2 line-clamp-2">"{validation.feedback}"</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
