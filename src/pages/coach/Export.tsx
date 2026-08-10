import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, FileSpreadsheet, CalendarRange, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card, Button, EmptyState, useToast } from '../../components/ui';
import { getAllureZones } from '../../lib/calculations';
import { downloadBlob } from '../../lib/shareExport';
import { buildSessionExportRows, toCsvContent, exportFilename } from '../../lib/spreadsheetExport';

type PeriodMode = 'mois' | 'plage';

/** Nombre de séances affichées dans l'aperçu (le fichier, lui, les contient toutes). */
const PREVIEW_LIMIT = 20;

const inputClass =
  'px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

/** `yyyy-MM` vers une date locale. Repli sur le mois courant si la saisie est vide ou invalide. */
function parseMonth(value: string): Date {
  const parsed = new Date(`${value}-01T00:00:00`);
  return isValid(parsed) ? parsed : startOfMonth(new Date());
}

/** `yyyy-MM-dd` vers une date locale (et non UTC, comme le ferait `new Date('2026-05-01')`). */
function parseDay(value: string, fallback: Date): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return isValid(parsed) ? parsed : fallback;
}

export default function Export() {
  const { user } = useAuth();
  const { sessions, validations, users, groups, preparations, clubSettings } = useData();
  const toast = useToast();

  const [mode, setMode] = useState<PeriodMode>('mois');
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  // On mémorise les groupes DÉcochés, pas les cochés : tout est sélectionné par
  // défaut sans dépendre de `groups`, qui est encore vide au premier rendu quand
  // la page est ouverte directement (rechargement, lien profond) pendant le
  // bootstrap. Un groupe créé plus tard arrive coché, lui aussi.
  const [deselectedGroupIds, setDeselectedGroupIds] = useState<string[]>([]);

  const { start, end } = useMemo(() => {
    if (mode === 'mois') {
      const base = parseMonth(month);
      return { start: startOfMonth(base), end: endOfMonth(base) };
    }
    const now = new Date();
    return { start: parseDay(from, startOfMonth(now)), end: parseDay(to, endOfMonth(now)) };
  }, [mode, month, from, to]);

  const isRangeInverted = end.getTime() < start.getTime();
  const allGroupsSelected = deselectedGroupIds.length === 0;
  const columnGroups = useMemo(
    () => groups.filter(g => !deselectedGroupIds.includes(g.id)),
    [groups, deselectedGroupIds]
  );
  // `null` = aucun filtre de groupe, ce que le lib traite comme « tous ».
  const groupFilter = useMemo(
    () => (allGroupsSelected ? null : columnGroups.map(g => g.id)),
    [allGroupsSelected, columnGroups]
  );

  const rows = useMemo(() => {
    if (isRangeInverted) return [];
    return buildSessionExportRows({
      sessions, validations, users, groups, preparations,
      zones: getAllureZones(clubSettings?.allure_zones),
      start, end, groupIds: groupFilter,
    });
  }, [sessions, validations, users, groups, preparations, clubSettings, start, end, groupFilter, isRangeInverted]);

  const reconstructedCount = rows.filter(r => r.attribution === 'reconstituee').length;

  const toggleGroup = (id: string) => {
    setDeselectedGroupIds(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]));
  };

  const handleDownload = () => {
    const csv = toCsvContent(rows, columnGroups);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, exportFilename(start, end));
    toast.success(`${rows.length} séance${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''}`);
  };

  if (user?.role !== 'coach') {
    return <div className="py-8 text-center text-neutral-500">Cette page est réservée au coach.</div>;
  }

  return (
    <div className="py-4 space-y-4">
      <header>
        <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Export tableur</p>
        <h1 className="text-h1 font-display font-bold text-neutral-900">Récupère tes séances dans Excel</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
          Choisis une période et tes groupes : l'app génère un fichier CSV qui s'ouvre d'un
          double-clic dans Excel, avec le contenu détaillé des séances et le nombre de validations
          par groupe.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* PÉRIODE */}
        <Card>
          <h2 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
            <CalendarRange size={18} className="text-primary" aria-hidden="true" />
            Période
          </h2>

          <div className="flex items-center gap-1 mb-3">
            {(['mois', 'plage'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  mode === value
                    ? 'bg-primary text-white font-semibold'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {value === 'mois' ? 'Un mois' : 'Plage de dates'}
              </button>
            ))}
          </div>

          {mode === 'mois' ? (
            <div>
              <label htmlFor="export-month" className="block text-xs text-neutral-500 mb-1">
                Mois
              </label>
              <input
                id="export-month"
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="export-from" className="block text-xs text-neutral-500 mb-1">Du</label>
                <input id="export-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="export-to" className="block text-xs text-neutral-500 mb-1">Au</label>
                <input id="export-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          <p className="text-xs text-neutral-500 mt-3">
            {isRangeInverted ? (
              <span className="text-danger-600 font-medium">
                La date de fin précède la date de début.
              </span>
            ) : (
              <>
                Du {format(start, 'd MMMM yyyy', { locale: fr })} au{' '}
                {format(end, 'd MMMM yyyy', { locale: fr })}, bornes incluses.
              </>
            )}
          </p>
        </Card>

        {/* GROUPES */}
        <Card>
          <fieldset>
            <legend className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
              <Users size={18} className="text-primary" aria-hidden="true" />
              Groupes
            </legend>

            {groups.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Aucun groupe défini pour l'instant : toutes les séances du club seront exportées.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {groups.map(group => {
                    const checked = !deselectedGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'bg-accent/10 border-accent text-neutral-900'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(group.id)}
                          style={{ accentColor: 'var(--color-accent)' }}
                        />
                        {group.name}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setDeselectedGroupIds(allGroupsSelected ? groups.map(g => g.id) : [])}
                  className="text-xs text-primary hover:underline mt-3"
                >
                  {allGroupsSelected ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </>
            )}

            <p className="text-xs text-neutral-500 mt-3">
              Les séances d'avant mai 2026 n'ont pas de groupe enregistré : leur rattachement est
              reconstitué à partir des athlètes qui les ont validées. Celles qui restent sans
              rattachement sont marquées « Tous » et toujours incluses.
            </p>
          </fieldset>
        </Card>
      </div>

      {/* APERÇU */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
          <h2 className="flex items-center gap-2 font-bold text-neutral-900">
            <FileSpreadsheet size={18} className="text-primary" aria-hidden="true" />
            Aperçu
          </h2>
          <span className="text-sm text-neutral-500">
            <span className="font-semibold text-neutral-900">{rows.length}</span> séance{rows.length > 1 ? 's' : ''}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={28} aria-hidden="true" />}
            title="Aucune séance sur cette sélection"
            description={
              isRangeInverted
                ? 'Corrige les dates : la fin doit venir après le début.'
                : 'Élargis la période ou coche un autre groupe pour retrouver tes séances.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th scope="col" className="text-left font-medium px-4 py-2 whitespace-nowrap">Date</th>
                    <th scope="col" className="text-left font-medium px-4 py-2">Titre</th>
                    <th scope="col" className="text-left font-medium px-4 py-2 whitespace-nowrap">Type</th>
                    <th scope="col" className="text-left font-medium px-4 py-2 whitespace-nowrap">Groupe</th>
                    <th scope="col" className="text-left font-medium px-4 py-2">Contenu</th>
                    <th scope="col" className="text-right font-medium px-4 py-2 whitespace-nowrap">Validations</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map(row => (
                    <tr key={row.id} className="border-t border-neutral-100 align-top">
                      <td className="px-4 py-2 whitespace-nowrap text-neutral-600">{row.date}</td>
                      <td className="px-4 py-2 font-medium text-neutral-900">{row.title}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-neutral-600">{row.type}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-neutral-600">{row.groupLabel}</td>
                      <td className="px-4 py-2 text-neutral-500 min-w-[18rem]">
                        {row.content || <span className="text-neutral-300">texte libre</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-neutral-900">{row.validationsTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-neutral-500 border-t border-neutral-100">
              {rows.length > PREVIEW_LIMIT && (
                <>Aperçu des {PREVIEW_LIMIT} premières séances, les {rows.length - PREVIEW_LIMIT} autres sont dans le fichier. </>
              )}
              Le fichier ajoute la description complète et une colonne de validations par groupe.
              {reconstructedCount > 0 && (
                <> {reconstructedCount} séance{reconstructedCount > 1 ? 's ont' : ' a'} un rattachement reconstitué.</>
              )}
            </p>
          </>
        )}
      </Card>

      {/* TÉLÉCHARGEMENT */}
      <div className="sticky bottom-2 bg-primary text-white rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap shadow-card-hover">
        <div>
          <p className="text-xs uppercase tracking-wider text-accent font-semibold">Prêt à télécharger</p>
          <p className="text-sm text-white/70 mt-0.5">
            Fichier CSV, séparateur point-virgule, prêt pour Excel.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={handleDownload}
          disabled={rows.length === 0}
          leftIcon={<Download size={16} aria-hidden="true" />}
        >
          Télécharger {rows.length > 0 && `(${rows.length})`}
        </Button>
      </div>
    </div>
  );
}
