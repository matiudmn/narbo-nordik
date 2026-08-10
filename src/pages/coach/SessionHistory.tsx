import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parse, isValid, isSameMonth, startOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight, CheckCircle, Users } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { getSessionCode } from '../../lib/calculations';
import { computeSessionParticipation, sumParticipationByGroup, NO_GROUP_KEY } from '../../lib/sessionGroups';
import { Badge, Card, EmptyState, SessionTypeBadge } from '../../components/ui';
import { KpiTrioCard } from '../../components/shared/KpiTrioCard';

const MONTH_PARAM = 'mois';
const MONTH_FORMAT = 'yyyy-MM';

// Date de référence au 1er du mois : `parse` complète les unités absentes du
// pattern avec celles de la référence. Avec `new Date()` un 31 août, parser
// "2026-02" donnerait le 31 février, normalisé en mars.
const MONTH_REF = new Date(2000, 0, 1);

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(2000, i, 1), 'MMMM', { locale: fr }),
}));

export default function SessionHistory() {
  const { sessions, validations, users, groups, preparations } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthKey = useMemo(() => {
    const raw = searchParams.get(MONTH_PARAM);
    const parsed = raw ? parse(raw, MONTH_FORMAT, MONTH_REF) : null;
    return parsed && isValid(parsed) ? format(parsed, MONTH_FORMAT) : format(new Date(), MONTH_FORMAT);
  }, [searchParams]);

  const month = useMemo(() => parse(monthKey, MONTH_FORMAT, MONTH_REF), [monthKey]);
  const goToMonth = (d: Date) => setSearchParams({ [MONTH_PARAM]: format(d, MONTH_FORMAT) });

  const monthLabel = format(month, 'MMMM yyyy', { locale: fr });
  const isCurrentMonth = isSameMonth(month, new Date());

  const monthSessions = useMemo(
    () =>
      sessions
        .filter((s) => !s.is_personal && isSameMonth(new Date(s.date), month))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [sessions, month]
  );

  const rows = useMemo(
    () => computeSessionParticipation(monthSessions, validations, users),
    [monthSessions, validations, users]
  );

  const totalsByGroup = useMemo(() => sumParticipationByGroup(rows), [rows]);
  const doneTotal = rows.reduce((total, row) => total + row.doneTotal, 0);

  // Une colonne par groupe du club, plus "Sans groupe" seulement si des
  // athlètes non affectés ont participé ce mois-ci.
  const columns = useMemo(() => {
    const cols = groups.map((g) => ({ key: g.id, label: g.name }));
    if ((totalsByGroup[NO_GROUP_KEY] ?? 0) > 0) cols.push({ key: NO_GROUP_KEY, label: 'Sans groupe' });
    return cols;
  }, [groups, totalsByGroup]);

  // Audience affichée en badge, partagée par le tableau (desktop) et la liste (mobile).
  const decorated = useMemo(
    () =>
      rows.map((row) => {
        const prep = preparations.find((p) => p.id === row.session.preparation_id);
        const group = groups.find((g) => g.id === row.session.group_id);
        if (prep) return { ...row, audience: { tone: 'warning' as const, label: prep.name } };
        if (group) return { ...row, audience: { tone: 'info' as const, label: group.name } };
        if (!row.groupsInferred) return { ...row, audience: { tone: 'neutral' as const, label: 'Tous' } };
        // Lister les groupes reconstitués n'a d'intérêt que s'ils ne sont pas
        // tous là : le détail chiffré est déjà dans les colonnes.
        const names =
          row.groupIds.length === groups.length
            ? 'Tous les groupes'
            : row.groupIds
                .map((id) => groups.find((g) => g.id === id)?.name)
                .filter((name): name is string => Boolean(name))
                .sort()
                .join(', ');
        return {
          ...row,
          audience: {
            tone: 'neutral' as const,
            label: `${names} (reconstitué)`,
            title: "Aucun groupe n'est enregistré sur cette séance : l'audience est reconstituée à partir des validations.",
          },
        };
      }),
    [rows, groups, preparations]
  );

  const activeAthletes = useMemo(() => {
    const monthSessionIds = new Set(monthSessions.map((s) => s.id));
    const ids = new Set<string>();
    validations.forEach((v) => {
      if (v.status === 'done' && monthSessionIds.has(v.session_id)) ids.add(v.user_id);
    });
    return ids.size;
  }, [monthSessions, validations]);

  const years = useMemo(() => {
    const seasons = sessions.filter((s) => !s.is_personal).map((s) => new Date(s.date).getFullYear());
    const current = new Date().getFullYear();
    const min = Math.min(current, month.getFullYear(), ...seasons);
    const max = Math.max(current, month.getFullYear(), ...seasons);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [sessions, month]);

  // Cible du raccourci proposé quand le mois affiché est vide.
  const latestMonthWithSessions = useMemo(() => {
    const dates = sessions.filter((s) => !s.is_personal).map((s) => new Date(s.date).getTime());
    return dates.length > 0 ? startOfMonth(new Date(Math.max(...dates))) : null;
  }, [sessions]);
  const jumpTarget = latestMonthWithSessions && !isSameMonth(latestMonthWithSessions, month) ? latestMonthWithSessions : null;

  return (
    <div className="py-4 space-y-4">
      <header>
        <h1 className="text-h1 font-display font-bold text-neutral-900">Historique des séances</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Choisis un mois passé et retrouve la participation de chaque groupe.
        </p>
      </header>

      {/* Sélecteur de mois : saut direct, sans avoir à remonter semaine par semaine */}
      <div className="space-y-1.5">
        <Card padding="sm" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToMonth(addMonths(month, -1))}
            aria-label="Mois précédent"
            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <select
              value={month.getMonth()}
              onChange={(e) => goToMonth(new Date(month.getFullYear(), Number(e.target.value), 1))}
              aria-label="Mois"
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value} className="capitalize">{m.label}</option>
              ))}
            </select>
            <select
              value={month.getFullYear()}
              onChange={(e) => goToMonth(new Date(Number(e.target.value), month.getMonth(), 1))}
              aria-label="Année"
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm tabular focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => goToMonth(addMonths(month, 1))}
            aria-label="Mois suivant"
            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </Card>
        {!isCurrentMonth && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => goToMonth(new Date())}
              className="text-xs text-primary font-medium hover:underline"
            >
              Revenir au mois en cours
            </button>
          </div>
        )}
      </div>

      <KpiTrioCard
        kpis={[
          {
            value: monthSessions.length,
            label: 'Séances',
            tone: 'primary',
            icon: <CalendarRange size={20} aria-hidden="true" />,
          },
          {
            value: doneTotal,
            label: 'Participations',
            tone: 'accent',
            icon: <CheckCircle size={20} aria-hidden="true" />,
          },
          {
            value: activeAthletes,
            label: 'Athlètes actifs',
            tone: 'success',
            icon: <Users size={20} aria-hidden="true" />,
          },
        ]}
      />

      {monthSessions.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={28} />}
          title={`Aucune séance en ${monthLabel}`}
          description="Choisis un autre mois pour retrouver le programme réalisé."
          actionLabel={jumpTarget ? `Aller à ${format(jumpTarget, 'MMMM yyyy', { locale: fr })}` : undefined}
          actionVariant="secondary"
          onAction={jumpTarget ? () => goToMonth(jumpTarget) : undefined}
        />
      ) : (
        <Card padding="none" className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">
                Séances de {monthLabel} et nombre de participations par groupe
              </caption>
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th scope="col" className="label-micro text-neutral-400 text-left px-3 py-2">Date</th>
                  <th scope="col" className="label-micro text-neutral-400 text-left px-3 py-2">Séance</th>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className="label-micro text-neutral-400 text-right px-3 py-2 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="label-micro text-neutral-400 text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {decorated.map(({ session, doneByGroup, doneTotal: sessionDone, audience }) => (
                  <tr key={session.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap text-neutral-500 tabular">
                      <span className="capitalize">{format(new Date(session.date), 'EEE d', { locale: fr })}</span>
                      <span className="block text-xs text-neutral-400">{format(new Date(session.date), 'HH:mm')}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-start gap-2">
                        <SessionTypeBadge type={session.session_type} iconOnly />
                        <div className="min-w-0">
                          <Link to={`/session/${session.id}`} className="font-medium text-neutral-900 hover:underline">
                            {session.title}
                            <span className="text-xs font-normal text-neutral-400 ml-1.5">
                              {getSessionCode(session, sessions)}
                            </span>
                          </Link>
                          <div className="mt-1">
                            <Badge tone={audience.tone} title={audience.title}>{audience.label}</Badge>
                          </div>
                        </div>
                      </div>
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 align-top text-right tabular">
                        {doneByGroup[c.key] ? (
                          <span className="font-medium text-neutral-900">{doneByGroup[c.key]}</span>
                        ) : (
                          <span className="text-neutral-300">0</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 align-top text-right tabular font-semibold text-neutral-900">
                      {sessionDone}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 border-t border-neutral-200">
                  <th scope="row" colSpan={2} className="px-3 py-2 text-left font-medium text-neutral-500">
                    Total du mois ({monthSessions.length} séance{monthSessions.length > 1 ? 's' : ''})
                  </th>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right tabular font-semibold text-neutral-900">
                      {totalsByGroup[c.key] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular font-bold text-neutral-900">{doneTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile : le tableau serait illisible, une carte par séance porte les mêmes chiffres. */}
      {monthSessions.length > 0 && (
        <div className="md:hidden space-y-2">
          {decorated.map(({ session, doneByGroup, doneTotal: sessionDone, audience }) => (
            <Card key={session.id} padding="sm">
              <div className="flex items-start gap-2">
                <SessionTypeBadge type={session.session_type} iconOnly />
                <div className="min-w-0 flex-1">
                  <Link to={`/session/${session.id}`} className="font-medium text-neutral-900 hover:underline">
                    {session.title}
                    <span className="text-xs font-normal text-neutral-400 ml-1.5">
                      {getSessionCode(session, sessions)}
                    </span>
                  </Link>
                  <p className="text-xs text-neutral-400 mt-0.5 first-letter:uppercase">
                    {format(new Date(session.date), 'EEEE d MMMM', { locale: fr })}
                    <span className="tabular"> · {format(new Date(session.date), 'HH:mm')}</span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-neutral-900 tabular shrink-0">{sessionDone}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge tone={audience.tone} title={audience.title}>{audience.label}</Badge>
                {columns
                  .filter((c) => doneByGroup[c.key])
                  .map((c) => (
                    <span key={c.key} className="text-xs text-neutral-500">
                      {c.label} <span className="font-semibold text-neutral-900 tabular">{doneByGroup[c.key]}</span>
                    </span>
                  ))}
              </div>
            </Card>
          ))}
          <Card padding="sm" className="flex items-center justify-between bg-neutral-50">
            <span className="text-sm text-neutral-500">
              Total du mois ({monthSessions.length} séance{monthSessions.length > 1 ? 's' : ''})
            </span>
            <span className="text-sm font-bold text-neutral-900 tabular">{doneTotal}</span>
          </Card>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
            {columns.map((c) => (
              <span key={c.key} className="text-xs text-neutral-500">
                {c.label} <span className="font-semibold text-neutral-900 tabular">{totalsByGroup[c.key] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        La participation est reconstituée à partir des validations, chaque athlète étant compté dans
        son groupe actuel. Les séances créées avant mai 2026 n'ont pas de groupe enregistré en base :
        leur audience est reconstituée à partir des validations et signalée « reconstitué ».
      </p>
    </div>
  );
}
