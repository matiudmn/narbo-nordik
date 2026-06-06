import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, isWithinInterval, isPast, differenceInCalendarDays, differenceInCalendarWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, ChevronLeft, ChevronRight, TrendingUp, Gauge, Info, Target, CalendarPlus, X, Copy, MessageCircle, Activity, Mountain, Timer, Check, Flag } from 'lucide-react';
import { Calendar } from 'lucide-react';
import { StatusBadge, EmptyState, Button, useToast, StreakFlame } from '../components/ui';
import { StravaWordmark, PoweredByStrava } from '../components/strava';
import { QuickSurveySheet } from '../components/athlete/QuickSurveySheet';
import { VmaRecordCelebration } from '../components/athlete/VmaRecordCelebration';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useStrava } from '../hooks/useStrava';
import { formatBlockSummary, getRacePaces, calculateRacePace, getVmaLevelIndex, VMA_LEVELS, getSessionCode, getAllureZones } from '../lib/calculations';
import { getSeasonRange } from '../lib/date-utils';
import { filterSessionsForAthlete } from '../lib/athleteSessions';
import { computeWeeklyStreak } from '../lib/streak';
import { PageSkeleton } from '../components/Skeleton';
import { celebrate, haptic } from '../lib/motion';
import type { ObjectiveReached, Sensations } from '../types';

export default function Home() {
  const { user } = useAuth();
  const { sessions, validations, groups, preparations, userPreparations, clubSettings, loading, validateSession, updateValidation } = useData();
  const toast = useToast();
  const racePaces = getRacePaces(clubSettings?.race_paces);
  const allureZones = getAllureZones(clubSettings?.allure_zones);
  const [weekOffset, setWeekOffset] = useState(0);

  // VMA record celebration state
  const [vmaCelebration, setVmaCelebration] = useState<{ previous: number; current: number } | null>(null);

  // Quick-validate state
  const [surveySheet, setSurveySheet] = useState<{
    sessionId: string;
    validationId: string;
    title: string;
    objective: ObjectiveReached | null;
    sensations: Sensations | null;
  } | null>(null);
  const [quickValidatingId, setQuickValidatingId] = useState<string | null>(null);
  const [savingSurvey, setSavingSurvey] = useState(false);

  // Toggle "Voir aussi le programme du groupe" (persisté en localStorage par athlète)
  // Visible uniquement si l'athlète a une prépa active.
  const [showGroupBesidesPrep, setShowGroupBesidesPrep] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('nn:showGroupBesidesPrep');
    return stored === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nn:showGroupBesidesPrep', String(showGroupBesidesPrep));
    }
  }, [showGroupBesidesPrep]);

  const isCoach = user?.role === 'coach';
  const strava = useStrava();

  // Détecte un record VMA non encore célébré (athlète uniquement)
  useEffect(() => {
    if (!user || isCoach) return;
    const history = user.vma_history ?? [];
    if (history.length < 2) return;
    const sorted = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const previousValues = sorted.slice(0, -1).map((e) => e.vma);
    const previousMax = Math.max(...previousValues);
    if (latest.vma <= previousMax) return;

    const seenKey = `vma_record_seen:${user.id}:${latest.date}`;
    try {
      if (window.localStorage.getItem(seenKey)) return;
      window.localStorage.setItem(seenKey, '1');
    } catch {
      return;
    }
    setVmaCelebration({ previous: previousMax, current: latest.vma });
  }, [user, isCoach]);

  useEffect(() => {
    strava.checkConnection();
  }, [strava.checkConnection]);

  useEffect(() => {
    if (strava.connected && !strava.athleteStats) {
      strava.fetchStats();
    }
  }, [strava.connected, strava.athleteStats, strava.fetchStats]);

  const userPrepIds = useMemo(() => {
    if (!user) return [];
    return userPreparations.filter(up => up.user_id === user.id).map(up => up.preparation_id);
  }, [user, userPreparations]);

  // Objectifs datés des prépas actives de l'athlète (la "finalité" : jour de course).
  // Remontée David 06/2026 : l'échéance n'apparaissait que dans Réglages → Prépas,
  // jamais dans la vue semaine. On l'expose ici pour que l'athlète voie son objectif.
  const prepObjectives = useMemo(() => {
    if (!user) return [];
    const today = new Date();
    const parseDateOnly = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    return preparations
      .filter(p => userPrepIds.includes(p.id) && p.event_date)
      .map(p => {
        const date = parseDateOnly(p.event_date);
        return {
          id: p.id,
          name: p.name,
          date,
          daysUntil: differenceInCalendarDays(date, today),
          weekOffsetTo: differenceInCalendarWeeks(date, today, { weekStartsOn: 1 }),
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [preparations, userPrepIds, user]);

  // Prochain objectif : le plus proche à venir, sinon le plus récent passé.
  const nextObjective = useMemo(() => {
    const upcoming = prepObjectives.filter(o => o.daysUntil >= 0);
    return upcoming[0] ?? prepObjectives[prepObjectives.length - 1] ?? null;
  }, [prepObjectives]);

  // --- Attendance stats ---
  const attendanceStats = useMemo(() => {
    if (!user) return { week: 0, month: 0, season: 0 };

    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const { start: sStart, end: sEnd } = getSeasonRange();

    // Pour le calcul d'assiduité, on garde la règle stricte (sans toggle) :
    // si l'athlète a une prépa active, on ne compte que les séances de la prépa.
    const userSessions = filterSessionsForAthlete(user, sessions, userPrepIds).map(f => f.session);

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

  // Série d'assiduité hebdomadaire (régularité), affichée dans le bloc Assiduité.
  const weeklyStreak = useMemo(() => {
    if (!user) return 0;
    const doneDates = validations
      .filter(v => v.user_id === user.id && v.status === 'done')
      .map(v => sessions.find(s => s.id === v.session_id)?.date)
      .filter((d): d is string => Boolean(d))
      .map(d => new Date(d));
    return computeWeeklyStreak(doneDates, new Date());
  }, [user, sessions, validations]);

  // --- Weekly sessions ---
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  // Vue hebdo : applique la règle de priorité prépa, avec respect du toggle utilisateur.
  // Retourne FilteredSession pour conserver l'info "isSecondary" (utilisé pour le style dégradé).
  const filteredWeekItems = useMemo(() => {
    if (!user) return [];
    return filterSessionsForAthlete(user, sessions, userPrepIds, { includeGroupSessions: showGroupBesidesPrep })
      .filter(f => {
        const d = new Date(f.session.date);
        return d >= weekStart && d <= weekEnd;
      })
      .sort((a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime());
  }, [sessions, user, weekStart, weekEnd, userPrepIds, showGroupBesidesPrep]);

  // Backward-compat : la plupart du JSX existant itère sur filteredSessions (Session[]).
  // On conserve cet alias pour minimiser le diff côté rendu.
  const filteredSessions = useMemo(
    () => filteredWeekItems.map(f => f.session),
    [filteredWeekItems]
  );

  // Lookup rapide isSecondary par session.id pour le style dégradé côté JSX.
  const secondaryIds = useMemo(
    () => new Set(filteredWeekItems.filter(f => f.isSecondary).map(f => f.session.id)),
    [filteredWeekItems]
  );

  // Repère "jour J" : objectif(s) tombant dans la semaine affichée, intercalé(s)
  // dans la grille même sans séance ce jour-là (le jour de course lui-même).
  const weekObjectives = useMemo(
    () => prepObjectives.filter(o => o.date >= weekStart && o.date <= weekEnd),
    [prepObjectives, weekStart, weekEnd]
  );

  type WeekRenderItem =
    | { kind: 'session'; date: Date; session: typeof filteredSessions[number] }
    | { kind: 'objective'; date: Date; obj: typeof prepObjectives[number] };

  const weekRenderItems = useMemo<WeekRenderItem[]>(() => {
    const items: WeekRenderItem[] = filteredSessions.map(s => ({
      kind: 'session', date: new Date(s.date), session: s,
    }));
    for (const o of weekObjectives) items.push({ kind: 'objective', date: o.date, obj: o });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredSessions, weekObjectives]);

  const hasActivePrep = userPrepIds.length > 0;

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

    if (validation?.status === 'done') return <StatusBadge status="done" withIcon />;
    if (validation?.status === 'missed') return <StatusBadge status="missed" withIcon />;
    if (sessionPast) return <StatusBadge status="pending" withIcon />;
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
  if (loading && sessions.length === 0) return <PageSkeleton />;

  const rateColor = (rate: number) => rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400';

  const prepMessage = prepRaceName && prepRaceDate && prepRaceDistance && prepFitness
    ? `Hello coach !\nJe m'inscris sur ${prepRaceName} qui aura lieu le ${format(new Date(prepRaceDate), 'd MMMM yyyy', { locale: fr })} sur ${prepRaceDistance}.\nMon état de forme est ${prepFitness.toLowerCase()}.\n${prepComments ? prepComments + '\n' : ''}Pourrais-tu me faire un plan spécifique ?\nSi cela est opportun bien sûr.\nMerci pour ton retour,\nBises,\n${user.firstname}`
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

  // Validation 1-tap depuis la carte de séance Home
  const handleQuickValidate = async (sessionId: string, sessionTitle: string) => {
    if (!user) return;
    setQuickValidatingId(sessionId);
    haptic('success');
    const result = await validateSession(sessionId, user.id, 'done');
    setQuickValidatingId(null);
    if ('error' in result) {
      toast.error("Impossible d'enregistrer la validation. Réessaie.");
      return;
    }
    toast.success('Séance dans la boîte 💪');
    celebrate('subtle');
    // Mini-sondage différé 2s (laisse l'utilisateur voir le toast)
    window.setTimeout(() => {
      setSurveySheet({
        sessionId,
        validationId: result.id,
        title: sessionTitle,
        objective: null,
        sensations: null,
      });
    }, 1800);
  };

  const handleSaveSurvey = async () => {
    if (!surveySheet) return;
    setSavingSurvey(true);
    try {
      await updateValidation(surveySheet.validationId, {
        objective_reached: surveySheet.objective,
        sensations: surveySheet.sensations,
      });
      toast.success('Ressenti enregistré, merci !');
      setSurveySheet(null);
    } catch {
      toast.error("Impossible d'enregistrer ton ressenti.");
    } finally {
      setSavingSurvey(false);
    }
  };

  return (
    <div className="py-4 space-y-4">
      {/* Top section: cards side by side on desktop */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      {/* VMA + Evolution */}
      {user.vma && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="bg-primary/5 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">VMA</p>
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
          <div className="grid grid-cols-4 lg:grid-cols-5 gap-1.5">
            {(() => {
              const levelIdx = getVmaLevelIndex(user.vma!);
              return Object.entries(racePaces).map(([key, zone]) => {
                const pct = zone.pctByLevel[levelIdx];
                const { pace } = calculateRacePace(user.vma!, pct);
                return (
                  <div key={key} className="rounded-lg p-2 border border-gray-100" style={{ backgroundColor: `${zone.color}08` }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-[10px] font-bold text-gray-600">{zone.label}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{pace}</p>
                    <p className="text-[9px] text-gray-400 leading-tight">{pct}% — {zone.description}</p>
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Niveau : {VMA_LEVELS[getVmaLevelIndex(user.vma!)].description}
          </p>
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
          Assiduité
          <StreakFlame weeks={weeklyStreak} size="sm" className="ml-auto" />
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
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strava stats */}
      {strava.connected && strava.athleteStats && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-[#FC4C02]" aria-hidden="true" />
            <StravaWordmark height={18} variant="orange" />
          </h2>

          {/* YTD stats */}
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Depuis janvier {new Date().getFullYear()}</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-[#FC4C02]/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">{strava.athleteStats.ytd_run_totals?.count ?? 0}</p>
              <p className="text-[10px] text-gray-400">Sorties</p>
            </div>
            <div className="bg-[#FC4C02]/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.ytd_run_totals?.distance ? (strava.athleteStats.ytd_run_totals.distance / 1000).toFixed(0) : 0}
              </p>
              <p className="text-[10px] text-gray-400">km</p>
            </div>
            <div className="bg-[#FC4C02]/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.ytd_run_totals?.moving_time ? Math.round(strava.athleteStats.ytd_run_totals.moving_time / 3600) : 0}
              </p>
              <p className="text-[10px] text-gray-400">heures</p>
            </div>
            <div className="bg-[#FC4C02]/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.ytd_run_totals?.elevation_gain ? Math.round(strava.athleteStats.ytd_run_totals.elevation_gain) : 0}
              </p>
              <p className="text-[10px] text-gray-400">D+ m</p>
            </div>
          </div>

          {/* All-time stats */}
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Tout temps</p>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">{strava.athleteStats.all_run_totals?.count ?? 0}</p>
              <p className="text-[10px] text-gray-400">Sorties</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.all_run_totals?.distance ? (strava.athleteStats.all_run_totals.distance / 1000).toFixed(0) : 0}
              </p>
              <p className="text-[10px] text-gray-400">km</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.all_run_totals?.moving_time ? Math.round(strava.athleteStats.all_run_totals.moving_time / 3600) : 0}
              </p>
              <p className="text-[10px] text-gray-400">heures</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">
                {strava.athleteStats.all_run_totals?.elevation_gain ? Math.round(strava.athleteStats.all_run_totals.elevation_gain) : 0}
              </p>
              <p className="text-[10px] text-gray-400">D+ m</p>
            </div>
          </div>

          {/* Average pace YTD */}
          {strava.athleteStats.ytd_run_totals?.distance > 0 && strava.athleteStats.ytd_run_totals?.moving_time > 0 && (
            <div className="mt-3 flex items-center justify-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Timer size={14} className="text-[#FC4C02]" />
                <span>Allure moy. </span>
                <span className="font-bold text-[#FC4C02]">
                  {(() => {
                    const paceSeconds = strava.athleteStats.ytd_run_totals.moving_time / (strava.athleteStats.ytd_run_totals.distance / 1000);
                    const min = Math.floor(paceSeconds / 60);
                    const sec = Math.round(paceSeconds % 60);
                    return `${min}:${String(sec).padStart(2, '0')}`;
                  })()}
                  /km
                </span>
              </div>
              {strava.athleteStats.ytd_run_totals?.elevation_gain > 0 && (
                <div className="flex items-center gap-1.5">
                  <Mountain size={14} className="text-[#FC4C02]" />
                  <span className="font-bold">
                    {Math.round(strava.athleteStats.ytd_run_totals.elevation_gain)}
                  </span>
                  <span>m D+</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-end">
            <PoweredByStrava />
          </div>
        </div>
      )}

      </div>{/* end top grid */}

      {/* Demande préparation spécifique */}
      {!isCoach && (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          leftIcon={<CalendarPlus size={18} aria-hidden="true" />}
          onClick={() => setShowPrepRequest(true)}
          className="text-primary"
        >
          Préparer ta prochaine course
        </Button>
      )}

      {showPrepRequest && (
        <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center bg-black/40" onClick={resetPrepForm} role="dialog" aria-modal="true" aria-labelledby="prep-dialog-title">
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl flex flex-col max-h-[85vh] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
              <h2 id="prep-dialog-title" className="font-bold text-gray-900">Demande de préparation</h2>
              <button onClick={resetPrepForm} className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 rounded-lg transition-colors" aria-label="Fermer">
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
                <label className="text-xs text-gray-500">État de forme actuel *</label>
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
                  placeholder="Informations supplémentaires…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              {prepMessage && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Aperçu du message :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{prepMessage}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-5 pt-3 pb-8 flex-shrink-0 border-t border-gray-100">
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
          <button onClick={() => setWeekOffset(o => o - 1)} className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Semaine precedente">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">Ta semaine d'entraînement</h2>
            <p className="text-sm text-gray-500">
              {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM yyyy', { locale: fr })}
              {weekOffset === 0 && <span className="ml-1 text-accent font-medium">(cette semaine)</span>}
            </p>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Semaine suivante">
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

        {hasActivePrep && (
          <div className="mb-3 space-y-2">
            {nextObjective && (
              <button
                type="button"
                onClick={() => {
                  if (nextObjective.weekOffsetTo !== weekOffset) setWeekOffset(nextObjective.weekOffsetTo);
                }}
                title="Aller à la semaine de l'objectif"
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-warning-50 border border-warning-100 rounded-xl text-left hover:bg-warning-100 transition-colors"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-warning-100 flex-shrink-0">
                    <Flag size={16} className="text-warning-700" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wide font-semibold text-warning-600 leading-tight">Objectif de ta prépa</span>
                    <span className="block text-sm font-bold text-warning-700 truncate">{nextObjective.name}</span>
                  </span>
                </span>
                <span className="flex flex-col items-end flex-shrink-0">
                  <span className="text-sm font-bold text-warning-700 capitalize">{format(nextObjective.date, 'EEE d MMM', { locale: fr })}</span>
                  <span className="text-[11px] font-semibold text-warning-600">
                    {nextObjective.daysUntil > 0 ? `J-${nextObjective.daysUntil}` : nextObjective.daysUntil === 0 ? 'Jour J' : `J+${-nextObjective.daysUntil}`}
                  </span>
                </span>
              </button>
            )}
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-warning-50 border border-warning-100 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-warning-700">
                <Target size={14} />
                <span>
                  <span className="font-semibold">Prépa spécifique active.</span>{' '}
                  <span>Tu vois uniquement tes séances de prépa.</span>
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={showGroupBesidesPrep}
                  onChange={e => setShowGroupBesidesPrep(e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--color-warning)' }}
                />
                <span className="text-warning-700 font-medium">Voir aussi le groupe</span>
              </label>
            </div>
          </div>
        )}

        {weekRenderItems.length === 0 ? (
          <EmptyState
            icon={<Calendar size={28} />}
            title="Rien de prévu cette semaine"
            description="Ton coach publiera bientôt le programme. Profites-en pour une sortie libre !"
          />
        ) : (
          <div className="space-y-3">
            {weekRenderItems.map(item => {
              if (item.kind === 'objective') {
                const obj = item.obj;
                return (
                  <div
                    key={`obj-${obj.id}`}
                    className="rounded-xl border-2 border-dashed border-warning-500 bg-warning-50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-warning-100 flex-shrink-0">
                        <Flag size={18} className="text-warning-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-warning-700">
                            {obj.daysUntil === 0 ? 'Jour J' : 'Objectif'}
                          </span>
                          <span className="text-xs font-medium text-warning-600 capitalize">
                            {format(obj.date, 'EEEE d MMM', { locale: fr })}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 truncate">{obj.name}</p>
                      </div>
                      {obj.daysUntil > 0 && (
                        <span className="flex-shrink-0 text-sm font-bold text-warning-700">J-{obj.daysUntil}</span>
                      )}
                    </div>
                  </div>
                );
              }
              const session = item.session;
              const sessionDate = new Date(session.date);
              const sessionPast = isPast(sessionDate);
              const validation = getValidation(session.id);
              const isSecondary = secondaryIds.has(session.id);

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
                  } ${
                    isSecondary ? 'opacity-60 saturate-50 border-dashed' : ''
                  }`}
                  title={isSecondary ? 'Programme du groupe (pas prioritaire car tu as une prépa active)' : undefined}
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
                          const z = allureZones[b.allure];
                          return (
                            <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: z.color }}>
                              {formatBlockSummary(b, allureZones)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {session.blocks.length === 0 && session.target_distance && session.vma_percent_min && (
                      <div className="mt-3 bg-primary/5 rounded-lg px-3 py-2 text-sm">
                        <span className="text-primary font-medium">{session.target_distance}m</span>
                        <span className="text-gray-400 mx-1">à</span>
                        <span className="text-primary font-medium">
                          {session.vma_percent_min}-{session.vma_percent_max}% VMA
                        </span>
                      </div>
                    )}

                    {/* Quick-validate 1-tap : visible quand séance passée et non validée */}
                    {sessionPast && !validation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuickValidate(session.id, session.title);
                        }}
                        disabled={quickValidatingId === session.id}
                        aria-label={`J'ai fait la séance ${session.title}`}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-60"
                      >
                        <Check size={16} aria-hidden="true" />
                        {quickValidatingId === session.id ? 'Validation…' : "J'ai fait ma séance"}
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* QuickSurveySheet — déclenchée 1.8s après une validation 1-tap */}
      <QuickSurveySheet
        open={surveySheet !== null}
        sessionTitle={surveySheet?.title ?? ''}
        objective={surveySheet?.objective ?? null}
        sensations={surveySheet?.sensations ?? null}
        onObjectiveChange={(v) => setSurveySheet((s) => (s ? { ...s, objective: v } : s))}
        onSensationsChange={(v) => setSurveySheet((s) => (s ? { ...s, sensations: v } : s))}
        onSave={handleSaveSurvey}
        onClose={() => setSurveySheet(null)}
        loading={savingSurvey}
      />

      {/* VMA Record celebration — wow moment quand le coach update la VMA */}
      <VmaRecordCelebration
        open={vmaCelebration !== null}
        previousVma={vmaCelebration?.previous ?? 0}
        newVma={vmaCelebration?.current ?? 0}
        onClose={() => setVmaCelebration(null)}
      />
    </div>
  );
}

