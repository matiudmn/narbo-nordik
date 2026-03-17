import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, Target, Smile, Dumbbell, Mountain, Battery, Bike, Footprints, Users, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { getSessionCode } from '../../lib/calculations';
import Avatar from '../../components/Avatar';
import YearlyHeatmap from '../../components/YearlyHeatmap';
import type { HeatmapSession } from '../../components/YearlyHeatmap';
import type { SessionType } from '../../types';

const SESSION_TYPE_ICON: Record<SessionType, typeof Dumbbell> = {
  entrainement: Dumbbell,
  course: Trophy,
  sortie_longue: Mountain,
  recuperation: Battery,
  velo: Bike,
  marche: Footprints,
  renfo: Dumbbell,
};

export default function Suivi() {
  const { user } = useAuth();
  const { sessions, validations, userPreparations, users } = useData();
  const [monthOffset, setMonthOffset] = useState(0);
  const isCoach = user?.role === 'coach';
  const [view, setView] = useState<'athletes' | 'personal'>(isCoach ? 'athletes' : 'personal');

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
      if (s.is_personal) return s.created_by === user.id;
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
        athlete: undefined as typeof users[number] | undefined,
      }));
  }, [sessions, validations, user, userPrepIds, monthStart, monthEnd]);

  const athleteSessions = useMemo(() => {
    if (!user || !isCoach) return [];

    return validations
      .filter(v => {
        if (v.user_id === user.id) return false;
        if (v.status !== 'done') return false;
        const s = sessions.find(s => s.id === v.session_id);
        if (!s) return false;
        if (s.is_personal) return false;
        const d = new Date(s.date);
        return d >= monthStart && d <= monthEnd;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(v => {
        const session = sessions.find(s => s.id === v.session_id)!;
        const athlete = users.find(u => u.id === v.user_id);
        return { session, validation: v, athlete };
      })
      .filter(item => item.session && item.athlete);
  }, [validations, sessions, users, user, isCoach, monthStart, monthEnd]);

  const stats = useMemo(() => {
    const source = isCoach && view === 'athletes' ? athleteSessions : completedSessions;
    const total = source.length;
    const objOui = source.filter(c => c.validation.objective_reached === 'oui').length;
    const objPartiel = source.filter(c => c.validation.objective_reached === 'partiel').length;
    const objNon = source.filter(c => c.validation.objective_reached === 'non').length;
    const sensExc = source.filter(c => c.validation.sensations === 'excellentes').length;
    const sensBon = source.filter(c => c.validation.sensations === 'bonnes').length;
    const sensMauv = source.filter(c => c.validation.sensations === 'mauvaises').length;
    return { total, objOui, objPartiel, objNon, sensExc, sensBon, sensMauv };
  }, [completedSessions, athleteSessions, isCoach, view]);

  const heatmapSessions = useMemo((): HeatmapSession[] => {
    if (!user) return [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const doneSessionIds = new Set(
      validations
        .filter(v => v.user_id === user.id && v.status === 'done')
        .map(v => v.session_id)
    );
    const userSessions = sessions.filter(s => {
      if (s.is_personal) return s.created_by === user.id;
      if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
      if (!s.group_id) return true;
      return s.group_id === user.group_id;
    });
    return userSessions
      .filter(s => doneSessionIds.has(s.id) || new Date(s.date) <= today)
      .map(s => ({
        date: s.date,
        title: s.title,
        session_type: s.session_type,
        is_personal: s.is_personal,
        done: doneSessionIds.has(s.id),
      }));
  }, [user, sessions, validations, userPrepIds]);

  if (!user) return null;

  const showingAthletes = isCoach && view === 'athletes';
  const currentList = showingAthletes ? athleteSessions : completedSessions;

  return (
    <div className="py-4">
      <h1 className="text-lg font-bold text-gray-900 mb-4">
        {showingAthletes ? 'Suivi athletes' : 'Mon suivi'}
      </h1>

      {isCoach && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setView('athletes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'athletes' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}
          >
            <Users size={14} />
            Suivi athletes
          </button>
          <button
            onClick={() => setView('personal')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'personal' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}
          >
            Mon suivi
          </button>
        </div>
      )}

      {!showingAthletes && <YearlyHeatmap sessions={heatmapSessions} />}

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthOffset(p => p - 1)} className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Mois precedent">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => setMonthOffset(p => p + 1)}
          disabled={monthOffset >= 0}
          className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          aria-label="Mois suivant"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Stats summary */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Check size={16} className="text-green-600" />
            <span className="font-semibold text-gray-900">
              {stats.total} seance{stats.total > 1 ? 's' : ''} validee{stats.total > 1 ? 's' : ''}
            </span>
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
      {currentList.length === 0 ? (
        <div className="text-center py-12">
          <Check size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">
            {showingAthletes ? 'Aucun retour athlete ce mois' : 'Aucune seance validee ce mois'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {showingAthletes ? 'Les validations des athletes apparaitront ici' : 'Validez vos seances pour les voir apparaitre ici'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map(({ session, validation, athlete }) => {
            const TypeIcon = SESSION_TYPE_ICON[session.session_type];
            return (
              <Link
                key={`${session.id}-${validation.id}`}
                to={`/session/${session.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {showingAthletes && athlete ? (
                      <Avatar user={athlete} size="sm" />
                    ) : (
                      <TypeIcon size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      {showingAthletes && athlete && (
                        <p className="text-xs font-medium text-primary mb-0.5">
                          {athlete.firstname} {athlete.lastname}
                        </p>
                      )}
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
                  <p className="text-sm text-gray-500 italic mt-2">"{validation.feedback}"</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
