import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, isWithinInterval, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, ChevronLeft, ChevronRight, Check, Clock, AlertCircle, TrendingUp, Gauge, Info, Target, CalendarPlus, X, Copy, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ALLURE_ZONES, formatBlockSummary, RACE_PACES, calculateRacePace, getSessionCode } from '../lib/calculations';
import { getSeasonRange } from '../lib/date-utils';

export default function Home() {
  const { user } = useAuth();
  const { sessions, validations, groups, preparations, userPreparations } = useData();
  const [weekOffset, setWeekOffset] = useState(0);

  const isCoach = user?.role === 'coach';

  const userPrepIds = useMemo(() => {
    if (!user) return [];
    return userPreparations.filter(up => up.user_id === user.id).map(up => up.preparation_id);
  }, [user, userPreparations]);

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
      if (s.is_personal) return s.created_by === user.id;
      if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
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
  }, [user, sessions, validations, userPrepIds]);

  // --- Weekly sessions ---
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => {
        const sessionDate = new Date(s.date);
        if (sessionDate < weekStart || sessionDate > weekEnd) return false;
        if (s.is_personal) return s.created_by === user?.id;
        if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
        if (!s.group_id) return true;
        return s.group_id === user?.group_id;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, user?.group_id, weekStart, weekEnd, userPrepIds]);

  const getValidation = (sessionId: string) =>
    validations.find(v => v.session_id === sessionId && v.user_id === user?.id);

  const getGroupName = (session: typeof sessions[0]) => {
    if (session.preparation_id) {
      const prep = preparations.find(p => p.id === session.preparation_id);
      return prep?.name || 'Preparation';
    }
    return session.group_id ? groups.find(g => g.id === session.group_id)?.name : 'Tous';
  };

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

  const [showPrepRequest, setShowPrepRequest] = useState(false);
  const [prepRaceName, setPrepRaceName] = useState('');
  const [prepRaceDate, setPrepRaceDate] = useState('');
  const [prepRaceDistance, setPrepRaceDistance] = useState('');
  const [prepFitness, setPrepFitness] = useState<'Excellent' | 'Bon' | 'Mauvais' | ''>('');
  const [prepComments, setPrepComments] = useState('');
  const [prepCopied, setPrepCopied] = useState(false);

  if (!user) return null;

  const rateColor = (rate: number) => rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400';

  const prepMessage = prepRaceName && prepRaceDate && prepRaceDistance && prepFitness
    ? `Hello coach !\nJe m'inscris sur ${prepRaceName} qui aura lieu le ${format(new Date(prepRaceDate), 'd MMMM yyyy', { locale: fr })} sur ${prepRaceDistance}.\nMon etat de forme est ${prepFitness.toLowerCase()}.\n${prepComments ? prepComments + '\n' : ''}Pourrais-tu me faire un plan specifique ?\nSi cela est opportun bien sur.\nMerci pour ton retour,\nBises,\n${user.firstname}`
    : '';

  const handleCopyPrep = async () => {
    if (!prepMessage) return;
    await navigator.clipboard.writeText(prepMessage);
    setPrepCopied(true);
    setTimeout(() => setPrepCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(prepMessage);
    window.open(`https://wa.me/33611812018?text=${encoded}`, '_blank');
  };

  const resetPrepForm = () => {
    setPrepRaceName('');
    setPrepRaceDate('');
    setPrepRaceDistance('');
    setPrepFitness('');
    setPrepComments('');
    setPrepCopied(false);
    setShowPrepRequest(false);
  };

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
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(RACE_PACES).map(([key, zone]) => {
              const { pace } = calculateRacePace(user.vma!, zone.pct);
              return (
                <div key={key} className="rounded-lg p-2.5 border border-gray-100" style={{ backgroundColor: `${zone.color}08` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <span className="text-xs font-bold text-gray-600">{zone.label}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{pace}</p>
                  <p className="text-[10px] text-gray-400">{zone.description}</p>
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

      {/* Demande preparation specifique */}
      {!isCoach && (
        <button
          onClick={() => setShowPrepRequest(true)}
          className="w-full flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-100 p-4 text-primary font-semibold hover:border-primary/30 transition-colors"
        >
          <CalendarPlus size={18} />
          Demander une preparation specifique
        </button>
      )}

      {showPrepRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={resetPrepForm}>
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
              <h2 className="font-bold text-gray-900">Demande de preparation</h2>
              <button onClick={resetPrepForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nom de la course *</label>
                <input type="text" value={prepRaceName} onChange={e => setPrepRaceName(e.target.value)}
                  placeholder="Ex: Trail des Music'Halle"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Date de la course *</label>
                <input type="date" value={prepRaceDate} onChange={e => setPrepRaceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Distance *</label>
                <input type="text" value={prepRaceDistance} onChange={e => setPrepRaceDistance(e.target.value)}
                  placeholder="Ex: 10 km, Semi-marathon, 21 km..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Etat de forme actuel *</label>
                <div className="flex gap-2 mt-1">
                  {(['Excellent', 'Bon', 'Mauvais'] as const).map(val => (
                    <button key={val} type="button" onClick={() => setPrepFitness(prepFitness === val ? '' : val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        prepFitness === val
                          ? val === 'Excellent' ? 'bg-green-100 text-green-700 border-green-300'
                            : val === 'Bon' ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-red-100 text-red-700 border-red-300'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}>
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Commentaires (facultatif)</label>
                <textarea value={prepComments} onChange={e => setPrepComments(e.target.value)} rows={2}
                  placeholder="Informations supplementaires..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              {prepMessage && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Apercu du message :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{prepMessage}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-gray-100">
              <button onClick={handleCopyPrep} disabled={!prepMessage}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <Copy size={14} />
                {prepCopied ? 'Copie !' : 'Copier'}
              </button>
              <button onClick={handleWhatsApp} disabled={!prepMessage}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#20bd5a] transition-colors">
                <MessageCircle size={14} />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className={`block rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                    session.preparation_id ? 'bg-amber-50' : session.group_id ? 'bg-blue-50' : 'bg-white'
                  } ${
                    sessionPast && !validation ? 'border-l-4 border-l-warning' : ''
                  } ${validation?.status === 'done' ? 'border-l-4 border-l-success' : ''} ${
                    !sessionPast && !validation ? 'opacity-90' : ''
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${session.preparation_id ? 'bg-amber-500' : getGroupColor(session.group_id)}`} />
                          <span className="text-xs text-gray-500 font-medium">
                            {getGroupName(session)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {session.title}
                          <span className="text-xs font-normal text-gray-400 ml-1.5">{getSessionCode(session, sessions)}</span>
                        </h3>
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
