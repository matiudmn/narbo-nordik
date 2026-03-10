import { useState, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, ExternalLink, Shield, Cake, ChevronDown, Gauge, Target, Trophy, History } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';
import { getFFACategory, formatBirthDatePublic } from '../../lib/ffa';
import { getRacePaces, calculateRacePace, getVmaLevelIndex } from '../../lib/calculations';
import { useDebounce } from '../../hooks/useDebounce';
import Avatar from '../../components/Avatar';
import { getSeasonRange } from '../../lib/date-utils';
import type { User } from '../../types';

const MemberStats = memo(function MemberStats({ member }: { member: User }) {
  const { user: currentUser } = useAuth();
  const { sessions, validations, raceResults, userPreparations, clubSettings } = useData();
  const racePaces = getRacePaces(clubSettings?.race_paces);

  const lastVmaDate = member.vma_history.length > 0
    ? member.vma_history[member.vma_history.length - 1].date
    : null;

  const userPrepIds = useMemo(() =>
    userPreparations.filter(up => up.user_id === member.id).map(up => up.preparation_id),
    [userPreparations, member.id]
  );

  const attendance = useMemo(() => {
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

    return {
      week: calc(wStart, wEnd),
      month: calc(mStart, mEnd),
      season: calc(sStart, sEnd),
    };
  }, [member.id, member.group_id, sessions, validations, userPrepIds]);

  const lastRaces = useMemo(() => {
    return raceResults
      .filter(r => r.user_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [raceResults, member.id]);

  const rateColor = (rate: number) => rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400';

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* VMA + Allures */}
      {member.vma ? (
        <div className="bg-primary/5 rounded-lg p-3">
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
          {currentUser?.role === 'coach' && (
            <Link to={`/training-history?user=${member.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
              <History size={12} />
              Historique entrainement
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">VMA non renseignee</p>
        </div>
      )}

      {/* Assiduite */}
      <div className="bg-white rounded-lg border border-gray-100 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-2">
          <Target size={14} className="text-primary" />
          Assiduite
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

      {/* 4 derniers palmares */}
      {lastRaces.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-2">
            <Trophy size={14} className="text-accent" />
            Derniers palmares
          </h3>
          <div className="space-y-1.5">
            {lastRaces.map(race => (
              <div key={race.id} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{race.race_name}</span>
                  <span className="text-gray-400">{format(new Date(race.date), 'd MMM yyyy', { locale: fr })}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="font-bold text-primary">{race.time_duration}</span>
                  {race.distance_km && (
                    <span className="text-gray-400 ml-1">{race.distance_km} km</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function MemberCard({ member, groupName, prepName, isExpanded, onToggle }: {
  member: User;
  groupName?: string;
  prepName?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const category = member.birth_date ? getFFACategory(member.birth_date) : null;
  const birthday = member.birth_date ? formatBirthDatePublic(member.birth_date) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <Avatar user={member} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 flex items-center gap-1.5">
              {member.firstname} {member.lastname}
              {member.role === 'coach' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  <Shield size={10} />
                  Coach
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {member.vma && (
                <span className="text-xs text-primary font-bold">VMA {member.vma}</span>
              )}
              {groupName && (
                <span className="text-xs text-gray-500">{groupName}</span>
              )}
              {prepName && (
                <span className="text-xs text-amber-600 font-medium">{prepName}</span>
              )}
              {category && (
                <span className="text-xs text-accent font-medium">{category.code}</span>
              )}
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
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="WhatsApp"
                onClick={e => e.stopPropagation()}
              >
                <Phone size={18} />
              </a>
            )}
            {member.strava_id && (
              <a
                href={member.strava_id}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                title="Strava"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={18} />
              </a>
            )}
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>
      {isExpanded && <MemberStats member={member} />}
    </div>
  );
}

export default function Directory() {
  const { users, groups, preparations, userPreparations } = useData();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleUsers = useMemo(() => users.filter(u => u.email !== SUPER_ADMIN_EMAIL), [users]);

  const groupMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.name));
    return map;
  }, [groups]);

  const prepMap = useMemo(() => {
    const map = new Map<string, string>();
    userPreparations.forEach(up => {
      const prep = preparations.find(p => p.id === up.preparation_id);
      if (prep) map.set(up.user_id, prep.name);
    });
    return map;
  }, [userPreparations, preparations]);

  const sorted = useMemo(() => {
    let list = visibleUsers;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(u =>
        u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.firstname.localeCompare(b.firstname, 'fr'));
  }, [visibleUsers, debouncedSearch]);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">Athletes</h1>
        <span className="text-xs text-gray-400 font-medium">{sorted.length} membre{sorted.length > 1 ? 's' : ''}</span>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {sorted.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            groupName={member.group_id ? groupMap.get(member.group_id) : undefined}
            prepName={prepMap.get(member.id)}
            isExpanded={selectedId === member.id}
            onToggle={() => setSelectedId(prev => prev === member.id ? null : member.id)}
          />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun membre trouve</p>
      )}
    </div>
  );
}
