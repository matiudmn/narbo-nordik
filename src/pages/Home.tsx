import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, isWithinInterval, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, ChevronLeft, ChevronRight, Check, Clock, AlertCircle, TrendingUp, Gauge, Info, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ALLURE_ZONES, formatBlockSummary, RACE_PACES, calculateRacePace } from '../lib/calculations';

function getSeasonRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return { start: new Date(year, 8, 1), end: new Date(year + 1, 7, 31, 23, 59, 59) };
  }
  return { start: new Date(year - 1, 8, 1), end: new Date(year, 7, 31, 23, 59, 59) };
}

export default function Home() {
  const { user } = useAuth();
  const { sessions, validations, groups } = useData();
  const [weekOffset, setWeekOffset] = useState(0);

  const isCoach = user?.role === 'coach';

  // --- Attendance stats ---
  const attendanceStats = useMemo(() => {
    if (!user) return { week: 0, month: 0, season: 0 };

    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const { start: sStart, end: sEnd } = getSeasonRange();

    const userSessions = sessions.filter(s => {
      if (isCoach) return true;
      if (!s.group_id) return true;
      return s.group_id === user.group_id;
    });

    const calc = (start: Date, end: Date) => {
      const periodSessions = userSessions.filter(s =>
        isWithinInterval(new Date(s.date), { start, end })
      );
      if (periodSessions.length === 0) return 0;
      const done = periodSessions.filter(s =>
        validations.some(v => v.session_id === s.id && v.user_id === user.id && v.status === 'done')
      ).length;
      return Math.round((done / periodSessions.length) * 100);
    };

    return {
      week: calc(wStart, wEnd),
      month: calc(mStart, mEnd),
      season: calc(sStart, sEnd),
    };
  }, [user, sessions, validations, isCoach]);

  // --- Weekly sessions ---
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => {
        const sessionDate = new Date(s.date);
        if (sessionDate < weekStart || sessionDate > weekEnd) return false;
        if (isCoach) return true;
        if (!s.group_id) return true;
        return s.group_id === user?.group_id;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, user?.group_id, isCoach, weekStart, weekEnd]);

  const getValidation = (sessionId: string) =>
    validations.find(v => v.session_id === sessionId && v.user_id === user?.id);

  const getGroupName = (groupId: string | null) =>
    groupId ? groups.find(g => g.id === groupId)?.name : 'Tous';

  const getStatusBadge = (session: typeof sessions[0]) => {
    const validation = getValidation(session.id);
    const sessionPast = isPast(new Date(session.date));

    if (validation?.status === 'done') {
      return <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full"><Check size={12} /> Fait</span>;
    }
    if (validation?.status === 'missed') {
      return <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full"><AlertCircle size={12} /> Manque</span>;
    }
    if (sessionPast) {
      return <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full"><Clock size={12} /> En attente</span>;
    }
    return null;
  };

  const getGroupColor = (groupId: string | null) => {
    if (!groupId) return 'bg-gray-400';
    const colors: Record<string, string> = { g1: 'bg-blue-500', g2: 'bg-green-600', g3: 'bg-purple-500' };
    return colors[groupId] || 'bg-gray-400';
  };

  if (!user) return null;

  const rateColor = (rate: number) => rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400';

  return (
    <div className="py-4 space-y-4">
      {/* VMA + Evolution */}
      {user.vma && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="bg-primary/5 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">VMA</p>
                <p className="text-2xl font-bold text-primary">
                  {user.vma} <span className="text-sm font-normal">km/h</span>
                </p>
              </div>
              {user.vma_history.length >= 2 && (() => {
                const first = user.vma_history[0];
                const last = user.vma_history[user.vma_history.length - 1];
                const evolution = ((last.vma - first.vma) / first.vma) * 100;
                return (
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm font-bold ${evolution >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      <TrendingUp size={16} />
                      {evolution >= 0 ? '+' : ''}{evolution.toFixed(1)}%
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      depuis {format(new Date(first.date), 'MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Allures Specifiques */}
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mt-4 mb-3">
            <Gauge size={18} className="text-accent" />
            Mes Allures
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(RACE_PACES).map(([key, zone]) => {
              const { speed, pace } = calculateRacePace(user.vma!, zone.pct);
              return (
                <div key={key} className="rounded-lg p-3 border border-gray-100" style={{ backgroundColor: `${zone.color}08` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <span className="text-xs font-bold text-gray-600">{zone.label}</span>
                    <span className="text-[10px] text-gray-400">{zone.description}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{pace} <span className="text-xs font-normal text-gray-400">min/km</span></p>
                  <p className="text-xs text-gray-400">{speed.toFixed(1)} km/h ({zone.pct}% VMA)</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
            <Info size={12} />
            <span>{isCoach ? 'Modifiable depuis la fiche athlete' : 'Contacte ton coach pour modifier ta VMA'}</span>
          </div>
        </div>
      )}

      {/* Assiduite */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <Target size={18} className="text-primary" />
          Assiduite
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {([
            { label: 'Semaine', value: attendanceStats.week },
            { label: 'Mois', value: attendanceStats.month },
            { label: 'Saison', value: attendanceStats.season },
          ] as const).map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stat.value}%</p>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${rateColor(stat.value)}`}
                  style={{ width: `${stat.value}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Seances de la semaine */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">Mes Seances</h2>
            <p className="text-sm text-gray-500">
              {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM yyyy', { locale: fr })}
              {weekOffset === 0 && <span className="ml-1 text-accent font-medium">(cette semaine)</span>}
            </p>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>

        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="w-full mb-3 text-sm text-primary font-medium hover:underline"
          >
            Revenir a cette semaine
          </button>
        )}

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CalendarIcon size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">Aucune seance cette semaine</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map(session => {
              const sessionDate = new Date(session.date);
              const sessionPast = isPast(sessionDate);
              const validation = getValidation(session.id);

              return (
                <Link
                  key={session.id}
                  to={`/session/${session.id}`}
                  className={`block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                    sessionPast && !validation ? 'border-l-4 border-l-warning' : ''
                  } ${validation?.status === 'done' ? 'border-l-4 border-l-success' : ''} ${
                    !sessionPast && !validation ? 'opacity-90' : ''
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${getGroupColor(session.group_id)}`} />
                          <span className="text-xs text-gray-500 font-medium">
                            {getGroupName(session.group_id)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">{session.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="font-medium">
                            {format(sessionDate, 'EEEE d MMM', { locale: fr })}
                          </span>
                          <span>{format(sessionDate, 'HH:mm')}</span>
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
                            <MapPin size={14} />
                            <span className="truncate">{session.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(session)}
                      </div>
                    </div>

                    {session.blocks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.blocks.map(b => {
                          const z = ALLURE_ZONES[b.allure];
                          return (
                            <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: z.color }}>
                              {formatBlockSummary(b)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {session.blocks.length === 0 && session.target_distance && session.vma_percent_min && (
                      <div className="mt-3 bg-primary/5 rounded-lg px-3 py-2 text-sm">
                        <span className="text-primary font-medium">{session.target_distance}m</span>
                        <span className="text-gray-400 mx-1">a</span>
                        <span className="text-primary font-medium">
                          {session.vma_percent_min}-{session.vma_percent_max}% VMA
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  );
}
