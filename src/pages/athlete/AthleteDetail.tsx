import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, ExternalLink, Shield, Cake, Gauge, Target, Trophy, History } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFFACategory, formatBirthDatePublic } from '../../lib/ffa';
import { getRacePaces, calculateRacePace, getVmaLevelIndex } from '../../lib/calculations';
import { getSeasonRange } from '../../lib/date-utils';
import Avatar from '../../components/Avatar';
import YearlyHeatmap from '../../components/YearlyHeatmap';
import ExpandableText from '../../components/ExpandableText';

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { users, sessions, validations, raceResults, userPreparations, preparations, groups, clubSettings } = useData();

  const member = useMemo(() => users.find(u => u.id === id), [users, id]);
  const racePaces = getRacePaces(clubSettings?.race_paces);
  const isCoach = currentUser?.role === 'coach';

  const groupName = useMemo(() => {
    if (!member?.group_id) return undefined;
    return groups.find(g => g.id === member.group_id)?.name;
  }, [member, groups]);

  const prepName = useMemo(() => {
    if (!member) return undefined;
    const up = userPreparations.find(up => up.user_id === member.id);
    if (!up) return undefined;
    return preparations.find(p => p.id === up.preparation_id)?.name;
  }, [member, userPreparations, preparations]);

  const userPrepIds = useMemo(() =>
    member ? userPreparations.filter(up => up.user_id === member.id).map(up => up.preparation_id) : [],
    [userPreparations, member]
  );

  const attendance = useMemo(() => {
    if (!member) return { week: 0, month: 0, season: 0 };
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const { start: sStart, end: sEnd } = getSeasonRange();

    const memberSessions = sessions.filter(s => {
      if (s.is_personal) return s.created_by === member.id;
      if (s.preparation_id) return userPrepIds.includes(s.preparation_id);
      if (!s.group_id) return true;
      return s.group_id === member.group_id;
    });

    const doneSessionIds = new Set(
      validations
        .filter(v => v.user_id === member.id && v.status === 'done')
        .map(v => v.session_id)
    );

    const calc = (start: Date, end: Date) => {
      const periodSessions = memberSessions.filter(s =>
        isWithinInterval(new Date(s.date), { start, end })
      );
      if (periodSessions.length === 0) return 0;
      const done = periodSessions.filter(s => doneSessionIds.has(s.id)).length;
      return Math.round((done / periodSessions.length) * 100);
    };

    return { week: calc(wStart, wEnd), month: calc(mStart, mEnd), season: calc(sStart, sEnd) };
  }, [member, sessions, validations, userPrepIds]);

  const memberRaces = useMemo(() => {
    if (!member) return [];
    return raceResults
      .filter(r => r.user_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceResults, member]);

  // Heatmap data: coach-created sessions (done + missed) for this athlete
  const heatmapSessions = useMemo(() => {
    if (!member) return [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const doneSessionIds = new Set(
      validations
        .filter(v => v.user_id === member.id && v.status === 'done')
        .map(v => v.session_id)
    );
    const memberPrepIds = userPreparations
      .filter(up => up.user_id === member.id)
      .map(up => up.preparation_id);
    return sessions
      .filter(s => {
        if (s.is_personal) return false;
        if (s.preparation_id) return memberPrepIds.includes(s.preparation_id);
        if (!s.group_id) return true;
        return s.group_id === member.group_id;
      })
      .filter(s => doneSessionIds.has(s.id) || new Date(s.date) <= today)
      .map(s => ({
        date: s.date,
        title: s.title,
        session_type: s.session_type,
        is_personal: s.is_personal,
        done: doneSessionIds.has(s.id),
      }));
  }, [member, sessions, validations, userPreparations]);

  if (!member) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-400">Athlete introuvable</p>
        <button onClick={() => navigate('/directory')} className="mt-4 text-sm text-primary underline">
          Retour a l'annuaire
        </button>
      </div>
    );
  }

  const category = member.birth_date ? getFFACategory(member.birth_date) : null;
  const birthday = member.birth_date ? formatBirthDatePublic(member.birth_date) : null;
  const lastVmaDate = member.vma_history.length > 0
    ? member.vma_history[member.vma_history.length - 1].date
    : null;
  const rateColor = (rate: number) => rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400';

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/directory')} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Fiche athlete</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <Avatar user={member} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
              {member.firstname} {member.lastname}
              {member.role === 'coach' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  <Shield size={10} />
                  Coach
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {member.vma && <span className="text-sm text-primary font-bold">VMA {member.vma}</span>}
              {groupName && <span className="text-xs text-gray-500">{groupName}</span>}
              {prepName && <span className="text-xs text-amber-600 font-medium">{prepName}</span>}
              {category && <span className="text-xs text-accent font-medium">{category.code}</span>}
              {birthday && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Cake size={11} />
                  {birthday}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {member.phone && (
              <a
                href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '').replace(/^0/, '33')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              >
                <Phone size={18} />
              </a>
            )}
            {member.strava_id && (
              <a
                href={member.strava_id}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg"
              >
                <ExternalLink size={18} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* VMA + Allures */}
      {member.vma ? (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-gray-400">VMA</p>
              <p className="text-xl font-bold text-primary">
                {member.vma} <span className="text-sm font-normal">km/h</span>
              </p>
            </div>
            {lastVmaDate && (
              <p className="text-[10px] text-gray-400">
                MAJ {format(new Date(lastVmaDate), 'd MMM yyyy', { locale: fr })}
              </p>
            )}
          </div>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-2">
            <Gauge size={14} className="text-accent" />
            Allures
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {(() => {
              const levelIdx = getVmaLevelIndex(member.vma!);
              return Object.entries(racePaces).map(([key, zone]) => {
                const pct = zone.pctByLevel[levelIdx];
                const { pace } = calculateRacePace(member.vma!, pct);
                return (
                  <div key={key} className="rounded-lg p-2 border border-gray-100 bg-white">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-[10px] font-bold text-gray-500">{zone.label}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-900">{pace}</p>
                    <p className="text-[9px] text-gray-400">{pct}%</p>
                  </div>
                );
              });
            })()}
          </div>
          {member.vma_history.length > 1 && (
            <Link to={`/vma-history?user=${member.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
              <History size={12} />
              Historique VMA
            </Link>
          )}
          {isCoach && (
            <Link to={`/training-history?user=${member.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
              <History size={12} />
              Historique entrainement
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-400">VMA non renseignee</p>
        </div>
      )}

      {/* Assiduite */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-2">
          <Target size={14} className="text-primary" />
          Assiduité
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {([
            { label: 'Semaine', value: attendance.week },
            { label: 'Mois', value: attendance.month },
            { label: 'Saison', value: attendance.season },
          ] as const).map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-bold text-gray-900">{stat.value}%</p>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                <div
                  className={`h-full rounded-full ${rateColor(stat.value)}`}
                  style={{ width: `${stat.value}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      {isCoach && <YearlyHeatmap sessions={heatmapSessions} />}

      {/* Palmares */}
      {memberRaces.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase">
              <Trophy size={14} className="text-accent" />
              Palmarès ({memberRaces.length})
            </h3>
            <Link to="/palmares" className="text-[10px] text-primary hover:underline">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {memberRaces.map(race => (
              <div key={race.id} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{race.race_name}</span>
                  <span className="text-gray-400">{format(new Date(race.date), 'd MMM yyyy', { locale: fr })}</span>
                  {race.comment && (
                    <ExpandableText text={race.comment} maxLines={1} className="text-gray-500 italic mt-0.5" />
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="font-bold text-primary">{race.time_duration}</span>
                  {race.distance_km && <span className="text-gray-400 ml-1">{race.distance_km} km</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
