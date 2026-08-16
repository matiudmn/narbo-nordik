import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Layers, Grid3x3, Braces, Upload, Copy, Check, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../components/ui';
import {
  parseImport,
  detectFormat,
  MACRO_META,
  PLAN_ALL_GROUPS,
  type ImportFormat,
  type ParseResult,
} from '../../lib/importParser';
import { STATIC_SAMPLES, buildPlanSample, buildChatGptPrompt } from '../../lib/importSamples';

const FORMAT_TABS: { key: ImportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { key: 'plan', label: 'Saison complète (JSON)', hint: 'Une version par groupe', icon: Braces },
  { key: 'canonical', label: 'Plan structuré', hint: '5 colonnes (Semaine, Date, Jour, Type, Contenu)', icon: Layers },
  { key: 'matrix', label: 'Matrice hebdo', hint: 'Jours × groupes', icon: Grid3x3 },
  { key: 'simple', label: 'Liste simple', hint: 'Date + Séance', icon: FileText },
];

const FORMAT_LABELS: Record<ImportFormat, string> = {
  plan: 'Saison complète (JSON)',
  canonical: 'Plan structuré',
  matrix: 'Matrice hebdo',
  simple: 'Liste simple',
  unknown: 'non reconnu',
};

/** Valeur du sélecteur de correspondance désignant une séance pour tout le club. */
const MAP_TO_ALL = '__all__';

/** Rend le contenu d'une séance, splittant sur `|` si présent. React échappe le texte automatiquement. */
function ContentBlocks({ content }: { content: string }) {
  if (!content.includes('|')) {
    return <div className="text-sm text-neutral-700 leading-snug">{content}</div>;
  }
  const parts = content.split('|').map(p => p.trim()).filter(Boolean);
  return (
    <div className="space-y-1.5 mt-1">
      {parts.map((p, i) => (
        <div
          key={i}
          className="bg-white border border-neutral-200 rounded px-2.5 py-1.5 text-sm text-neutral-700 flex items-start gap-2"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900 text-white text-xs font-bold flex-shrink-0">
            {i + 1}
          </span>
          <span>{p}</span>
        </div>
      ))}
    </div>
  );
}

export default function Import() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, sessions, importSessionsBulk } = useData();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<ImportFormat>('plan');
  const [paste, setPaste] = useState<string>('');
  const [defaultYear, setDefaultYear] = useState<number>(new Date().getFullYear());
  const [defaultGroupId, setDefaultGroupId] = useState<string>('');
  // Correspondance manuelle « nom du fichier -> groupe du club » pour les noms
  // que le parser n'a pas su résoudre. Tant qu'un nom reste sans réponse,
  // l'import est bloqué : sans cela la séance partirait en séance GLOBALE,
  // visible par tout le club.
  const [groupMapping, setGroupMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Que faire des séances qui semblent déjà exister : les ignorer (défaut) ou les créer quand même.
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'create'>('skip');

  const samples = useMemo<Record<ImportFormat, string>>(
    () => ({ ...STATIC_SAMPLES, plan: buildPlanSample(groups) }),
    [groups]
  );
  const sampleValues = useMemo(() => Object.values(samples), [samples]);

  // Au changement de format : recharge l'échantillon correspondant, mais
  // seulement si la zone est vide ou contient un échantillon non modifié
  // (on ne veut pas écraser un vrai tableau collé par le coach). Dérivé pendant
  // le rendu (comparaison au format précédent) plutôt que dans un effect : évite
  // un rendu intermédiaire avec l'ancien texte avant le nouvel échantillon.
  const [prevFormat, setPrevFormat] = useState(format);
  if (format !== prevFormat) {
    setPrevFormat(format);
    if (paste === '' || sampleValues.includes(paste)) {
      setPaste(samples[format]);
    }
  }

  /**
   * Point d'entrée unique du texte (frappe, collage, fichier, glisser-déposer).
   * Bascule sur l'onglet JSON quand le contenu en est manifestement un : le
   * coach n'a pas à savoir quel onglet correspond au fichier de ChatGPT.
   * ChatGPT préfixe souvent sa réponse d'une phrase, d'où les 5 premières
   * lignes non vides plutôt que la seule première.
   */
  function applyText(text: string) {
    setPaste(text);
    const heads = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 5);
    if (heads.some(l => detectFormat(l) === 'plan')) {
      setFormat('plan');
      return;
    }
    // Un tableau collé alors que l'onglet JSON est actif : on suit le contenu.
    // Un onglet tabulaire choisi à la main n'est jamais écrasé.
    if (format === 'plan') {
      const tabular = detectFormat(heads[0] ?? '');
      if (tabular !== 'unknown') setFormat(tabular);
    }
  }

  async function loadFile(file: File | undefined | null) {
    if (!file) return;
    try {
      applyText(await file.text());
      toast.success(`${file.name} chargé`);
    } catch {
      toast.error('Fichier illisible');
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildChatGptPrompt(groups));
      toast.success('Prompt copié');
    } catch {
      toast.error('Copie impossible, sélectionne le texte à la main');
    }
  }

  // Reparse à chaque changement
  const result: ParseResult = useMemo(
    () => parseImport(paste, { defaultYear, groups, forceFormat: format }),
    [paste, defaultYear, groups, format]
  );

  // Les messages du format JSON portent déjà leur repère ("Séance 12") : le
  // préfixe "Ligne N" n'a de sens que pour les formats tabulaires.
  const linePrefix = (lineNumber: number) =>
    result.detectedFormat !== 'plan' && lineNumber > 0 ? `Ligne ${lineNumber} : ` : '';

  // Compteur de cellules par macro-type
  const macroDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of result.sessions) {
      counts[s.macroType] = (counts[s.macroType] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [result.sessions]);

  // Noms de groupes écrits par le coach que le parser n'a pas résolus (matrice
  // comme JSON). "Tous" n'en fait pas partie : c'est une séance globale voulue.
  const unresolvedNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of result.sessions) {
      if (s.targetType === 'group' && !s.groupId && s.targetGroupName && s.targetGroupName !== PLAN_ALL_GROUPS) {
        names.add(s.targetGroupName);
      }
    }
    return [...names];
  }, [result.sessions]);

  const pendingNames = unresolvedNames.filter(n => !groupMapping[n]);
  // Une erreur de groupe cesse de bloquer dès que le coach a choisi une cible.
  const blockingErrors = result.errors.filter(e => !e.unresolvedGroup || !groupMapping[e.unresolvedGroup]);

  // Résolution finale (groupe, titre) + détection de doublon pour chaque séance parsée.
  // Doublon = même jour + même groupe + même contenu qu'une séance déjà en base,
  // ou qu'une ligne déjà planifiée plus haut dans le même import.
  const planned = useMemo(() => {
    const seen = new Set<string>();
    return result.sessions.map(s => {
      const mapped = !s.groupId && s.targetGroupName ? groupMapping[s.targetGroupName] : undefined;
      const resolved = s.groupId ?? (mapped && mapped !== MAP_TO_ALL ? mapped : null);
      // Le groupe par défaut ne sert qu'aux formats qui n'encodent aucune cible
      // (canonique, liste simple) : il ne doit jamais écraser un "Tous".
      const groupId = s.targetType === 'group' ? resolved : resolved || defaultGroupId || null;
      // Titre : le sous-type s'il existe (formats canonique et JSON), sinon le
      // 1er segment du contenu (avant le 1er "|"), tronqué. Évite les titres
      // génériques "Lundi : séance" pour les formats matrice/simple.
      const firstSegment = s.contentText.split('|')[0].trim().slice(0, 60);
      const title = s.subType || firstSegment || 'Séance importée';
      const content = s.contentText.trim();
      const key = `${s.date}|${groupId ?? ''}|${content}`;
      const isDuplicate =
        seen.has(key) ||
        sessions.some(
          ex =>
            !ex.is_personal &&
            ex.date.substring(0, 10) === s.date &&
            (ex.group_id ?? null) === groupId &&
            (ex.description ?? '').trim() === content
        );
      seen.add(key);
      return { parsed: s, groupId, title, isDuplicate };
    });
  }, [result.sessions, defaultGroupId, groupMapping, sessions]);

  // Lignes groupées par semaine pour l'aperçu. La clé porte l'année ISO : une
  // saison couvre deux années civiles, et S37 doit rester distincte d'une S37
  // de l'année suivante (même découpage que le récapitulatif).
  const rowsByWeek = useMemo(() => {
    const byWeek: Record<string, typeof planned> = {};
    for (const p of planned) {
      const d = parseISO(p.parsed.date);
      const key =
        p.parsed.week ||
        (p.parsed.format === 'plan'
          ? `S${getISOWeek(d)} · ${getISOWeekYear(d)}`
          : p.parsed.date.substring(0, 7)) ||
        'Autre';
      if (!byWeek[key]) byWeek[key] = [];
      byWeek[key].push(p);
    }
    return Object.entries(byWeek);
  }, [planned]);

  const duplicateCount = planned.filter(p => p.isDuplicate).length;
  const toCreate = useMemo(
    () => (onDuplicate === 'skip' ? planned.filter(p => !p.isDuplicate) : planned),
    [planned, onDuplicate]
  );
  const toCreateCount = toCreate.length;

  // Récapitulatif avant validation : semaines / séances / groupes.
  const summary = useMemo(() => {
    const weeks = new Set<string>();
    const uniqueSessions = new Set<string>();
    const targetGroups = new Set<string>();
    for (const p of toCreate) {
      const d = parseISO(p.parsed.date);
      weeks.add(`${getISOWeekYear(d)}-${getISOWeek(d)}`);
      uniqueSessions.add(`${p.parsed.date}|${p.title}`);
      targetGroups.add(p.groupId ?? PLAN_ALL_GROUPS);
    }
    return { weeks: weeks.size, sessions: uniqueSessions.size, groups: targetGroups.size };
  }, [toCreate]);

  // Validation : peut-on créer ?
  const needsDefaultGroup = result.sessions.some(s => s.targetType !== 'group');
  const canImport =
    user?.role === 'coach' &&
    toCreateCount > 0 &&
    blockingErrors.length === 0 &&
    pendingNames.length === 0 &&
    (!needsDefaultGroup || !!defaultGroupId);

  async function handleImport() {
    if (!user || !canImport || importing) return;
    setImporting(true);

    const skipped = planned.length - toCreate.length;

    const rows = toCreate.map(p => ({
      date: new Date(`${p.parsed.date}T${p.parsed.time ?? '18:30'}:00`).toISOString(),
      title: p.title,
      session_type: p.parsed.sessionType ?? ('entrainement' as const),
      terrain_options: [],
      location: p.parsed.location ?? null,
      location_url: null,
      description: p.parsed.contentText,
      group_id: p.groupId,
      preparation_id: null,
      target_distance: null,
      vma_percent_min: null,
      vma_percent_max: null,
      blocks: [],
      is_personal: false,
      created_by: user.id,
    }));

    try {
      // Insertion atomique côté base : tout ou rien, et UNE seule notification
      // par athlète au lieu d'une par séance créée.
      const res = await importSessionsBulk(rows);
      if ('error' in res) {
        toast.error(`Import échoué : ${res.error}`);
        return;
      }
      const suffix = skipped > 0 ? ` · ${skipped} doublon${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}` : '';
      toast.success(`${res.created} séances créées${suffix} · retrouve-les dans le planning`);
      navigate('/coach');
    } catch (e) {
      toast.error(`Import échoué : ${e instanceof Error ? e.message : 'erreur inattendue'}`);
    } finally {
      setImporting(false);
    }
  }

  if (user?.role !== 'coach') {
    return (
      <div className="py-8 text-center text-neutral-500">
        Cette page est réservée au coach.
      </div>
    );
  }

  return (
    <div className="pt-4 pb-24 max-w-6xl mx-auto px-4 lg:px-6">
      {/* HEADER */}
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
          Import en lot
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-neutral-900">
          Importe ton plan, l'app crée les séances
        </h1>
        <p className="text-sm text-neutral-500 mt-2 max-w-3xl">
          Une saison entière au format JSON, avec la variante de chaque groupe, ou un tableau
          Excel collé en Cmd-V. Tu peux aussi déposer ton fichier dans la zone de collage.
          Texte gardé tel quel, aucun découpage imposé.
        </p>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        {FORMAT_TABS.map(t => {
          const Icon = t.icon;
          const active = format === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFormat(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                active
                  ? 'bg-primary text-white font-semibold shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              <span className={`text-xs ${active ? 'text-white/70' : 'text-neutral-400'}`}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {/* AIDE DU FORMAT JSON */}
      {format === 'plan' && (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 mb-4">
          <ol className="text-sm text-neutral-600 space-y-1 list-decimal list-inside">
            <li>Copie le prompt ci-dessous dans ChatGPT et décris-lui ta saison.</li>
            <li>Colle sa réponse ici, ou dépose le fichier .json dans la zone de collage.</li>
            <li>Vérifie l'aperçu, puis lance l'import.</li>
          </ol>
          <button
            type="button"
            onClick={copyPrompt}
            className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
          >
            <Copy size={15} />
            Copier le prompt ChatGPT
          </button>
        </div>
      )}

      {/* OPTIONS GLOBALES */}
      <div className="flex items-center gap-4 mb-4 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <label className="text-neutral-500 text-xs uppercase tracking-wider font-semibold">Année (dates "DD/MM")</label>
          <input
            type="number"
            min={2020}
            max={2030}
            value={defaultYear}
            onChange={e => setDefaultYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-20 px-2 py-1 border border-neutral-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {needsDefaultGroup && (
          <div className="flex items-center gap-2">
            <label className="text-neutral-500 text-xs uppercase tracking-wider font-semibold">
              Groupe cible
            </label>
            <select
              value={defaultGroupId}
              onChange={e => setDefaultGroupId(e.target.value)}
              className="px-2 py-1 border border-neutral-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Sélectionner un groupe</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {!defaultGroupId && (
              <span className="text-xs text-warning-700">requis pour ce format</span>
            )}
          </div>
        )}
      </div>

      {/* DETECTION BAR */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 mb-4 flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 font-semibold">
          <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          Détection
        </div>
        <div>
          <span className="text-neutral-500">Format lu</span>{' '}
          <span className="font-semibold">{FORMAT_LABELS[result.detectedFormat]}</span>
        </div>
        <div>
          <span className="text-neutral-500">Lignes</span>{' '}
          <span className="font-semibold text-success-700 text-base">{result.sessions.length}</span>
        </div>
        <div>
          <span className="text-neutral-500">Ignorées</span>{' '}
          <span className="font-mono font-semibold text-neutral-600">{result.skipped}</span>
        </div>
        {blockingErrors.length > 0 && (
          <div>
            <span className="text-danger-600 font-semibold">{blockingErrors.length} erreur{blockingErrors.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {result.warnings.length > 0 && (
          <div>
            <span className="text-warning-600 font-semibold">{result.warnings.length} avertissement{result.warnings.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* GRID 2 COLONNES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT : TEXTAREA */}
        <div
          className={`bg-white border rounded-lg overflow-hidden ${dragging ? 'border-primary ring-2 ring-primary/20' : 'border-neutral-200'}`}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            void loadFile(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="bg-neutral-50 border-b border-neutral-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Zone de collage</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Upload size={13} />
                Charger un fichier
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,.txt,.csv,.tsv"
                className="hidden"
                onChange={e => {
                  void loadFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => setPaste(samples[format])}
                className="text-xs text-primary hover:underline"
              >
                Charger échantillon
              </button>
              <button
                type="button"
                onClick={() => setPaste('')}
                className="text-xs text-neutral-400 hover:text-danger-500"
              >
                Vider
              </button>
            </div>
          </div>
          <textarea
            value={paste}
            onChange={e => applyText(e.target.value)}
            rows={20}
            spellCheck={false}
            placeholder="Colle la réponse de ChatGPT ou ton tableau Excel ici (Cmd-V), ou dépose ton fichier…"
            className="w-full p-3 border-0 focus:outline-none resize-none font-mono text-xs leading-relaxed"
            style={{ tabSize: 16 }}
          />
          <div className="bg-neutral-50 border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>Cmd+V pour coller, ou glisse ton fichier ici</span>
            <span className="font-mono">{paste.length} car.</span>
          </div>
        </div>

        {/* RIGHT : PREVIEW */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-3 py-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Aperçu classé par semaine</div>
            <div className="text-xs text-neutral-500">
              <span className="font-mono font-semibold text-neutral-900">{result.sessions.length}</span> ligne{result.sessions.length > 1 ? 's' : ''}
            </div>
          </div>
          <div className="p-3 max-h-[600px] overflow-y-auto space-y-4">

            {/* Errors */}
            {blockingErrors.length > 0 && (
              <div className="bg-danger-50 border border-danger-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-danger-700 font-semibold text-sm">
                  <AlertTriangle size={14} /> Erreurs de lecture
                </div>
                {blockingErrors.slice(0, 5).map((e, i) => (
                  <div key={i} className="text-xs text-danger-700">
                    {linePrefix(e.lineNumber)}{e.message}
                  </div>
                ))}
                {blockingErrors.length > 5 && (
                  <div className="text-xs text-danger-700">… et {blockingErrors.length - 5} autres</div>
                )}
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-warning-50 border border-warning-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-warning-700 font-semibold text-sm">
                  <Info size={14} /> Avertissements
                </div>
                {result.warnings.slice(0, 5).map((w, i) => (
                  <div key={i} className="text-xs text-warning-700">
                    {linePrefix(w.lineNumber)}{w.message}
                  </div>
                ))}
                {result.warnings.length > 5 && (
                  <div className="text-xs text-warning-700">… et {result.warnings.length - 5} autres</div>
                )}
              </div>
            )}

            {/* Sessions par semaine */}
            {result.sessions.length === 0 && result.errors.length === 0 && (
              <div className="text-center py-8 text-neutral-400 text-sm">
                Colle ton plan pour voir l'aperçu
              </div>
            )}

            {rowsByWeek.map(([week, rows]) => (
              <div key={week}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-neutral-900 text-white px-2 py-0.5 rounded font-mono text-xs font-bold">
                    {week}
                  </span>
                  <span className="text-xs text-neutral-500">{rows.length} ligne{rows.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2 ml-2">
                  {rows.map(p => {
                    const s = p.parsed;
                    const macro = MACRO_META[s.macroType];
                    // Badge de groupe : ce qui compte est le groupe du CLUB
                    // réellement visé (résolution ou correspondance manuelle).
                    // Le nom écrit dans le fichier ne reste qu'en second.
                    const fileName = s.targetGroupName;
                    const clubName = p.groupId ? groups.find(g => g.id === p.groupId)?.name : undefined;
                    const toAll =
                      !p.groupId &&
                      (fileName === PLAN_ALL_GROUPS || (!!fileName && groupMapping[fileName] === MAP_TO_ALL));
                    const groupLabel = clubName ?? (toAll ? PLAN_ALL_GROUPS : fileName);
                    return (
                      <div
                        key={`${s.lineNumber}-${fileName || ''}`}
                        className="bg-neutral-50 rounded-lg p-2.5 border-l-4"
                        style={{ borderLeftColor: macro.color }}
                      >
                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-semibold"
                              style={{ background: macro.tint, color: macro.ink }}
                            >
                              {macro.label}
                            </span>
                            {s.subType && (
                              <span className="text-xs text-neutral-500 font-mono">{s.subType}</span>
                            )}
                            {groupLabel && (
                              <span className="text-xs text-neutral-600 bg-white border border-neutral-200 px-1.5 py-0.5 rounded">
                                {groupLabel}
                                {fileName && fileName !== groupLabel && (
                                  <span className="text-neutral-400"> · {fileName}</span>
                                )}
                                {!p.groupId && !toAll && fileName && (
                                  <span className="text-warning-600"> ✗</span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-500 font-mono">
                            {/* Évite "Lundi lundi 25 mai" : on n'ajoute le jour que si dateRaw ne le contient pas déjà */}
                            {s.day && !s.dateRaw.toLowerCase().startsWith(s.day.toLowerCase()) ? `${s.day} ` : ''}{s.dateRaw}
                            {s.time ? ` · ${s.time}` : ''}
                          </span>
                        </div>
                        <ContentBlocks content={s.contentText} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DISTRIBUTION */}
      {result.sessions.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 mt-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">
            Distribution par macro-type
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {macroDistribution.map(([k, n]) => {
              const meta = MACRO_META[k as keyof typeof MACRO_META];
              const pct = Math.round((n / result.sessions.length) * 100);
              return (
                <div
                  key={k}
                  className="px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-2"
                  style={{ background: meta.tint, color: meta.ink }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                  <span className="font-mono opacity-70">
                    {n} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-neutral-100">
            {macroDistribution.map(([k, n]) => {
              const meta = MACRO_META[k as keyof typeof MACRO_META];
              const pct = (n / result.sessions.length) * 100;
              return (
                <div
                  key={k}
                  style={{ width: `${pct}%`, background: meta.color }}
                  title={`${meta.label} ${Math.round(pct)}%`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* GROUPES NON RECONNUS */}
      {unresolvedNames.length > 0 && (
        <div className="bg-warning-50 border border-warning-100 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-warning-700">
                {unresolvedNames.length} nom{unresolvedNames.length > 1 ? 's' : ''} de groupe non reconnu{unresolvedNames.length > 1 ? 's' : ''}
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                Indique à quel groupe du club correspond chaque nom de ton fichier. Sans correspondance,
                la séance serait créée pour tout le club : l'import reste bloqué.
              </p>
              <div className="mt-3 space-y-2">
                {unresolvedNames.map(name => (
                  <div key={name} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-mono text-xs bg-white border border-neutral-200 rounded px-2 py-1 text-neutral-700">
                      {name}
                    </span>
                    <span className="text-neutral-400 text-xs">vers</span>
                    <select
                      value={groupMapping[name] ?? ''}
                      onChange={e => setGroupMapping(prev => ({ ...prev, [name]: e.target.value }))}
                      className="px-2 py-1 border border-neutral-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Choisir un groupe</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                      <option value={MAP_TO_ALL}>Tous les groupes (séance club)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLONS */}
      {duplicateCount > 0 && (
        <div className="bg-warning-50 border border-warning-100 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-warning-700">
                {duplicateCount} séance{duplicateCount > 1 ? 's' : ''} semble{duplicateCount > 1 ? 'nt' : ''} déjà exister
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                Même date, même groupe et même contenu qu'une séance déjà en base, ou qu'une ligne
                précédente du même import. Évite de créer des doublons.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="onDuplicate"
                    checked={onDuplicate === 'skip'}
                    onChange={() => setOnDuplicate('skip')}
                    style={{ accentColor: 'var(--color-warning)' }}
                  />
                  <span className="text-neutral-700">
                    Ignorer les doublons <span className="text-neutral-400">(créer {planned.length - duplicateCount} nouvelle{planned.length - duplicateCount > 1 ? 's' : ''})</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="onDuplicate"
                    checked={onDuplicate === 'create'}
                    onChange={() => setOnDuplicate('create')}
                    style={{ accentColor: 'var(--color-warning)' }}
                  />
                  <span className="text-neutral-700">
                    Importer quand même <span className="text-neutral-400">(créer les {planned.length})</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA BAR */}
      <div className="bg-neutral-900 text-white rounded-xl p-4 mt-4 flex items-center justify-between gap-3 flex-wrap sticky bottom-2 shadow-lg">
        <div>
          <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-1">Prêt à créer</div>
          <div className="text-base">
            <span className="font-mono font-bold text-accent text-2xl mr-1">
              {toCreateCount}
            </span>
            {toCreateCount > 1 ? 'lignes seront créées' : 'ligne sera créée'}
          </div>
          <div className="text-white/60 text-sm mt-1">
            {summary.weeks} semaine{summary.weeks > 1 ? 's' : ''}, {summary.sessions} séance{summary.sessions > 1 ? 's' : ''},{' '}
            {summary.groups} groupe{summary.groups > 1 ? 's' : ''}
          </div>
          {pendingNames.length > 0 && (
            <div className="text-warning-100 text-sm mt-1">
              Associe d'abord {pendingNames.join(', ')} à un groupe du club.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/coach')}
            className="px-4 py-2.5 border border-white/20 rounded-lg text-sm hover:bg-white/10"
            disabled={importing}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport || importing}
            className="px-5 py-2.5 bg-accent text-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Check size={16} />
                {toCreateCount > 1 ? `Créer les ${toCreateCount} lignes` : 'Créer la ligne'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
