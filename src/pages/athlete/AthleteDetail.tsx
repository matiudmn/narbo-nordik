import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Shield, Cake, Gauge, Target, Trophy, History, Pencil } from 'lucide-react';
import { Card } from '../../components/ui';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFFACategory, formatBirthDatePublic } from '../../lib/ffa';
import { getRacePaces, calculateRacePace, getVmaLevelIndex } from '../../lib/calculations';
import { getSeasonRange } from '../../lib/date-utils';
import { filterSessionsForAthlete } from '../../lib/athleteSessions';
import { computeAttendance, formatAttendance, getAthleteStartDate } from '../../lib/attendance';
import { isAthleteVisible } from '../../lib/search';
import Avatar from '../../components/Avatar';
import YearlyHeatmap, { toHeatmapStatus } from '../../components/YearlyHeatmap';
import type { HeatmapSession } from '../../components/YearlyHeatmap';
import ExpandableText from '../../components/ExpandableText';

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { users, sessions, validations, raceResults, userPreparations, preparations, groups, clubSettings } = useData();

  // Un profil is_public=false n'est pas accessible aux autres athletes, meme
  // par acces direct a l'URL (toujours visible pour soi-meme, les coachs et
  // le super-admin) : cf. isAthleteVisible. Traite comme "introuvable" plutot
  // qu'un etat "acces refuse" distinct, pour ne pas confirmer l'existence du
  // profil a qui n'a pas a le voir.
  const member = useMemo(() => {
    const found = users.find(u => u.id === id);
    if (!found || !currentUser) return undefined;
    return isAthleteVisible(found, { id: currentUser.id, role: currentUser.role, isSuperAdmin }) ? found : undefined;
  }, [users, id, currentUser, isSuperAdmin]);
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
    if (!member) return null;
    const now = new Date();
    const calc = (range: { start: Date; end: Date }) =>
      computeAttendance(member, sessions, validations, userPrepIds, range, now);
    return {
      week: calc({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }),
      month: calc({ start: startOfMonth(now), end: endOfMonth(now) }),
      season: calc(getSeasonRange()),
    };
  }, [member, sessions, validations, userPrepIds]);

  const memberRaces = useMemo(() => {
    if (!member) return [];
    return raceResults
      .filter(r => r.user_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceResults, member]);

  // Heatmap data: coach-created sessions (done + missed) for this athlete
  const heatmapSessions = useMemo((): HeatmapSession[] => {
    if (!member) return [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const statusBySession = new Map(
      validations.filter(v => v.user_id === member.id).map(v => [v.session_id, v.status])
    );
    const startDate = getAthleteStartDate(member);
    const memberPrepIds = userPreparations
      .filter(up => up.user_id === member.id)
      .map(up => up.preparation_id);
    // Le heatmap exclut les séances perso (vue club-side coach) mais applique la règle prépa
    return filterSessionsForAthlete(member, sessions, memberPrepIds)
      .map(f => f.session)
      .filter(s => !s.is_personal)
      .filter(s => new Date(s.date) >= startDate)
      .filter(s => statusBySession.get(s.id) === 'done' || new Date(s.date) <= today)
      .map(s => ({
        date: s.date,
        title: s.title,
        session_type: s.session_type,
        is_personal: s.is_personal,
        status: toHeatmapStatus(statusBySession.get(s.id)),
      }));
  }, [member, sessions, validations, userPreparations]);

  if (!member) {
    return (
      <div className="py-8 text-center">
        <p className="text-neutral-400">Athlete introuvable</p>
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

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/directory')} className="p-2 -ml-2 rounded-lg hover:bg-neutral-100">
          <ArrowLeft size={20} className="text-neutral-600" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-neutral-900">Fiche athlète</h1>
        {isCoach && (
          <Link
            to={`/coach/athlete/${member.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Pencil size={14} aria-hidden="true" />
            Modifier la fiche
          </Link>
        )}
      </div>

      {/* Profile card */}
      <Card>
        <div className="flex items-center gap-3">
          <Avatar user={member} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-neutral-900 flex items-center gap-1.5">
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
              {groupName && <span className="text-xs text-neutral-500">{groupName}</span>}
              {prepName && <span className="text-xs text-warning-600 font-medium">{prepName}</span>}
              {category && <span className="text-xs text-accent-text font-medium">{category.code}</span>}
              {birthday && (
                <span className="text-xs text-neutral-400 flex items-center gap-0.5">
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
                className="p-2 text-success-600 hover:bg-success-50 rounded-lg"
              >
                <Phone size={18} />
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* VMA + Allures */}
      {member.vma ? (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-neutral-400">VMA</p>
              <p className="text-xl font-bold text-primary">
                {member.vma} <span className="text-sm font-normal">km/h</span>
              </p>
            </div>
            {lastVmaDate && (
              <p className="text-[10px] text-neutral-400">
                MAJ {format(new Date(lastVmaDate), 'd MMM yyyy', { locale: fr })}
              </p>
            )}
          </div>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
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
                  <div key={key} className="rounded-lg p-2 border border-neutral-100 bg-white">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-[10px] font-bold text-neutral-500">{zone.label}</span>
                    </div>
                    <p className="text-xs font-bold text-neutral-900">{pace}</p>
                    <p className="text-[9px] text-neutral-400">{pct}%</p>
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
        </Card>
      ) : (
        <Card className="text-center">
          <p className="text-xs text-neutral-400">VMA non renseignee</p>
        </Card>
      )}

      {/* Régularité : jamais exposée aux autres athlètes */}
      {attendance && (isCoach || member.id === currentUser?.id) && (
        <Card>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            <Target size={14} className="text-primary" />
            Régularité
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Semaine', value: attendance.week },
              { label: 'Mois', value: attendance.month },
              { label: 'Saison', value: attendance.season },
            ] as const).map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-bold text-neutral-900 tabular">{formatAttendance(stat.value)}</p>
                {stat.value.rate !== null && (
                  <>
                    <p className="text-[10px] text-neutral-400 tabular">{stat.value.rate} %</p>
                    <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${stat.value.rate}%` }} />
                    </div>
                  </>
                )}
                <p className="text-[10px] text-neutral-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 mt-2">Comptée depuis l'arrivée au club, hors séances à venir.</p>
        </Card>
      )}

      {/* Heatmap */}
      {isCoach && <YearlyHeatmap sessions={heatmapSessions} />}

      {/* Palmares */}
      {memberRaces.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase">
              <Trophy size={14} className="text-accent" />
              Palmarès ({memberRaces.length})
            </h3>
            <Link to="/palmares" className="text-[10px] text-primary hover:underline">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {memberRaces.map(race => (
              <div key={race.id} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-neutral-900 truncate block">{race.race_name}</span>
                  <span className="text-neutral-400">{format(new Date(race.date), 'd MMM yyyy', { locale: fr })}</span>
                  {race.comment && (
                    <ExpandableText text={race.comment} maxLines={1} className="text-neutral-500 italic mt-0.5" />
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="font-bold text-primary">{race.time_duration}</span>
                  {race.distance_km && <span className="text-neutral-400 ml-1">{race.distance_km} km</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
