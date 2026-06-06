import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Layers, Grid3x3, Check, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../components/ui';
import {
  parseImport,
  MACRO_META,
  type ImportFormat,
  type ParsedImportSession,
  type ParseResult,
} from '../../lib/importParser';

const FORMAT_TABS: { key: ImportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { key: 'canonical', label: 'Plan structuré', hint: '5 colonnes (Semaine, Date, Jour, Type, Contenu)', icon: Layers },
  { key: 'matrix', label: 'Matrice hebdo', hint: 'Jours × groupes', icon: Grid3x3 },
  { key: 'simple', label: 'Liste simple', hint: 'Date + Séance', icon: FileText },
];

/** Échantillons pour démo */
const SAMPLES: Record<ImportFormat, string> = {
  canonical: [
    'Semaine\tDate\tJour\tType de séance\tContenu détaillé',
    "S1\t14/01\tMardi\tVMA courte\t20' EF + éducatifs | 8–12 x 1' rapide / 1' récup | 10' retour au calme",
    "S1\t16/01\tJeudi\tSeuil\t20' EF | 2 x 10' seuil (récup 5') | 10' retour au calme",
    'S1\t19/01\tDimanche\tSortie nature\t1h30 vallonné, D+ modéré, EF, finish progressif',
    "S2\t21/01\tMardi\tCôtes courtes\tÉchauffement | 10–15 x 30'' côte (récup descente)",
    "S2\t23/01\tJeudi\tActivation\t30–40' EF + 5 lignes droites",
  ].join('\n'),
  matrix: [
    'semaine\tDATE\tGR ESSENTIEL\tGR INTERMEDIAIRE\tGROUPE RENFORCE',
    "21\tlundi 25 mai 2026\tRENFO et/ou EF30'\tRENFO et/ou EF30'\tRENFO et EF45'",
    '21\tmardi 26 mai 2026\tEchauf | PISTE 2X6X200M | r200trotté R400\tEchauf | PISTE 2X8X200M | r200trotté R400\tEchauf | PISTE 2X10X200M | r200trotté R400',
    '21\tmercredi 27 mai 2026\tRENFO ou vélo\tRENFO ou vélo\tRENFO ou vélo',
    '21\tjeudi 28 mai 2026\tMoujan échauff | 4× seuil progressif pyramide 5\'\tMoujan échauff | 4× seuil progressif pyramide 5\'\tMoujan échauff | 4× seuil progressif pyramide 5\'',
    '21\tdimanche 31 mai 2026\t\t\tCaroux SL 2000D+',
  ].join('\n'),
  simple: [
    'Date\tSéance',
    '2025-12-15\tFooting 50 min + gainage',
    '2025-12-16\tVMA 12×300 m',
    '2025-12-18\tCôtes 12×25 s',
    '2025-12-20\tSeuil 3×8 min',
    '2025-12-21\tSortie 1h20 vallonnée',
  ].join('\n'),
  unknown: '',
};

const SAMPLE_VALUES = Object.values(SAMPLES);

/** Rend le contenu d'une séance, splittant sur `|` si présent. React échappe le texte automatiquement. */
function ContentBlocks({ content }: { content: string }) {
  if (!content.includes('|')) {
    return <div className="text-sm text-gray-700 leading-snug">{content}</div>;
  }
  const parts = content.split('|').map(p => p.trim()).filter(Boolean);
  return (
    <div className="space-y-1.5 mt-1">
      {parts.map((p, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-sm text-gray-700 flex items-start gap-2"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 text-white text-xs font-bold flex-shrink-0">
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
  const { groups, sessions, addSessionsBulk } = useData();
  const toast = useToast();

  const [format, setFormat] = useState<ImportFormat>('canonical');
  const [paste, setPaste] = useState<string>(SAMPLES.canonical);
  const [defaultYear, setDefaultYear] = useState<number>(new Date().getFullYear());
  const [defaultGroupId, setDefaultGroupId] = useState<string>('');
  const [parseTimeMs, setParseTimeMs] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  // Que faire des séances qui semblent déjà exister : les ignorer (défaut) ou les créer quand même.
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'create'>('skip');

  // Reparse à chaque changement
  const result: ParseResult = useMemo(() => {
    const start = performance.now();
    const r = parseImport(paste, { defaultYear, groups, forceFormat: format });
    setParseTimeMs(Math.round((performance.now() - start) * 10) / 10);
    return r;
  }, [paste, defaultYear, groups, format]);

  // Au changement de format : recharge l'échantillon correspondant, mais
  // seulement si la zone est vide ou contient un échantillon non modifié
  // (on ne veut pas écraser un vrai tableau collé par le coach).
  useEffect(() => {
    if (paste === '' || SAMPLE_VALUES.includes(paste)) {
      setPaste(SAMPLES[format]);
    }
    // `paste` lu mais hors deps : volontaire, on ne réagit qu'au changement de format.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  // Compteur de cellules par macro-type
  const macroDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of result.sessions) {
      counts[s.macroType] = (counts[s.macroType] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [result.sessions]);

  // Sessions groupées par semaine pour l'affichage
  const sessionsByWeek = useMemo(() => {
    const byWeek: Record<string, ParsedImportSession[]> = {};
    for (const s of result.sessions) {
      const key = s.week || s.date.substring(0, 7) || 'Autre';
      if (!byWeek[key]) byWeek[key] = [];
      byWeek[key].push(s);
    }
    return Object.entries(byWeek);
  }, [result.sessions]);

  // Résolution finale (groupe, titre) + détection de doublon pour chaque séance parsée.
  // Doublon = même jour + même groupe + même contenu qu'une séance déjà en base.
  const planned = useMemo(() => {
    return result.sessions.map(s => {
      const groupId = s.groupId || defaultGroupId || null;
      // Titre : le sous-type s'il existe (format canonique), sinon le 1er
      // segment du contenu (avant le 1er "|"), tronqué. Évite les titres
      // génériques "Lundi — séance" pour les formats matrice/simple.
      const firstSegment = s.contentText.split('|')[0].trim().slice(0, 60);
      const title = s.subType || firstSegment || 'Séance importée';
      const content = s.contentText.trim();
      const isDuplicate = sessions.some(
        ex =>
          !ex.is_personal &&
          ex.date.substring(0, 10) === s.date &&
          (ex.group_id ?? null) === groupId &&
          (ex.description ?? '').trim() === content
      );
      return { parsed: s, groupId, title, isDuplicate };
    });
  }, [result.sessions, defaultGroupId, sessions]);

  const duplicateCount = planned.filter(p => p.isDuplicate).length;
  const toCreateCount = onDuplicate === 'skip' ? planned.length - duplicateCount : planned.length;

  // Validation : peut-on créer ?
  const needsDefaultGroup = result.sessions.some(s => s.targetType !== 'group');
  const canImport =
    user?.role === 'coach' &&
    toCreateCount > 0 &&
    result.errors.length === 0 &&
    (!needsDefaultGroup || !!defaultGroupId);

  async function handleImport() {
    if (!user || !canImport || importing) return;
    setImporting(true);

    // Filtre les doublons selon le choix du coach, puis construit les payloads.
    const toCreate = onDuplicate === 'skip' ? planned.filter(p => !p.isDuplicate) : planned;
    const skipped = planned.length - toCreate.length;

    const rows = toCreate.map(p => ({
      date: new Date(`${p.parsed.date}T18:30:00`).toISOString(),
      title: p.title,
      session_type: 'entrainement' as const,
      terrain_options: [],
      location: null,
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
      // Insertion atomique : tout ou rien, pas d'état partiel ni de doublons à mi-parcours.
      const res = await addSessionsBulk(rows);
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
      <div className="py-8 text-center text-gray-500">
        Cette page est réservée au coach.
      </div>
    );
  }

  return (
    <div className="pt-4 pb-24 max-w-6xl mx-auto px-4 lg:px-6">
      {/* HEADER */}
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
          Import en lot
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
          Colle ton Excel — l'app crée les séances
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Cmd-A puis Cmd-C sur ton tableau Excel, puis Cmd-V dans la zone ci-dessous.
          L'app détecte les jours, les groupes, et crée les séances d'un coup.
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
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              <span className={`text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {/* OPTIONS GLOBALES */}
      <div className="flex items-center gap-4 mb-4 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Année (dates "DD/MM")</label>
          <input
            type="number"
            min={2020}
            max={2030}
            value={defaultYear}
            onChange={e => setDefaultYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {needsDefaultGroup && (
          <div className="flex items-center gap-2">
            <label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
              Groupe cible
            </label>
            <select
              value={defaultGroupId}
              onChange={e => setDefaultGroupId(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— Sélectionner —</option>
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
        <div className="ml-auto text-xs text-gray-500">
          Parsing : <span className="font-mono font-semibold">{parseTimeMs}</span> ms
        </div>
      </div>

      {/* DETECTION BAR */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 font-semibold">
          <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          Détection
        </div>
        <div>
          <span className="text-gray-500">Format</span>{' '}
          <span className="font-semibold">{result.detectedFormat}</span>
        </div>
        <div>
          <span className="text-gray-500">Séances</span>{' '}
          <span className="font-semibold text-success-700 text-base">{result.sessions.length}</span>
        </div>
        <div>
          <span className="text-gray-500">Ignorées</span>{' '}
          <span className="font-mono font-semibold text-gray-600">{result.skipped}</span>
        </div>
        {result.errors.length > 0 && (
          <div>
            <span className="text-danger-600 font-semibold">{result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}</span>
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Zone de collage</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaste(SAMPLES[format])}
                className="text-xs text-primary hover:underline"
              >
                Charger échantillon
              </button>
              <button
                type="button"
                onClick={() => setPaste('')}
                className="text-xs text-gray-400 hover:text-danger-500"
              >
                Vider
              </button>
            </div>
          </div>
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            rows={20}
            spellCheck={false}
            placeholder="Colle ton tableau Excel ici (Cmd-V)…"
            className="w-full p-3 border-0 focus:outline-none resize-none font-mono text-xs leading-relaxed"
            style={{ tabSize: 16 }}
          />
          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Cmd+V pour coller depuis Excel</span>
            <span className="font-mono">{paste.length} car.</span>
          </div>
        </div>

        {/* RIGHT : PREVIEW */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Aperçu classé par semaine</div>
            <div className="text-xs text-gray-500">
              <span className="font-mono font-semibold text-gray-900">{result.sessions.length}</span> séance{result.sessions.length > 1 ? 's' : ''}
            </div>
          </div>
          <div className="p-3 max-h-[600px] overflow-y-auto space-y-4">

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="bg-danger-50 border border-danger-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-danger-700 font-semibold text-sm">
                  <AlertTriangle size={14} /> Erreurs de parsing
                </div>
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} className="text-xs text-danger-700">
                    Ligne {e.lineNumber} : {e.message}
                  </div>
                ))}
                {result.errors.length > 5 && (
                  <div className="text-xs text-danger-700">… et {result.errors.length - 5} autres</div>
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
                    {w.lineNumber > 0 ? `Ligne ${w.lineNumber} : ` : ''}{w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Sessions par semaine */}
            {result.sessions.length === 0 && result.errors.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Colle ton tableau pour voir l'aperçu
              </div>
            )}

            {sessionsByWeek.map(([week, sess]) => (
              <div key={week}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-gray-900 text-white px-2 py-0.5 rounded font-mono text-xs font-bold">
                    {week}
                  </span>
                  <span className="text-xs text-gray-500">{sess.length} séance{sess.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2 ml-2">
                  {sess.map(s => {
                    const macro = MACRO_META[s.macroType];
                    return (
                      <div
                        key={`${s.lineNumber}-${s.targetGroupName || ''}`}
                        className="bg-gray-50 rounded-lg p-2.5 border-l-4"
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
                              <span className="text-xs text-gray-500 font-mono">{s.subType}</span>
                            )}
                            {s.targetGroupName && (
                              <span className="text-xs text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                {s.targetGroupName}
                                {!s.groupId && <span className="text-warning-600"> ✗</span>}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 font-mono">
                            {/* Évite "Lundi lundi 25 mai" : on n'ajoute le jour que si dateRaw ne le contient pas déjà */}
                            {s.day && !s.dateRaw.toLowerCase().startsWith(s.day.toLowerCase()) ? `${s.day} ` : ''}{s.dateRaw}
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
        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
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
          <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
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

      {/* DOUBLONS */}
      {duplicateCount > 0 && (
        <div className="bg-warning-50 border border-warning-100 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-warning-700">
                {duplicateCount} séance{duplicateCount > 1 ? 's' : ''} semble{duplicateCount > 1 ? 'nt' : ''} déjà exister
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Même date, même groupe et même contenu qu'une séance déjà en base. Évite de créer des doublons.
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
                  <span className="text-gray-700">
                    Ignorer les doublons <span className="text-gray-400">(créer {planned.length - duplicateCount} nouvelle{planned.length - duplicateCount > 1 ? 's' : ''})</span>
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
                  <span className="text-gray-700">
                    Importer quand même <span className="text-gray-400">(créer les {planned.length})</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA BAR */}
      <div className="bg-gray-900 text-white rounded-xl p-4 mt-4 flex items-center justify-between gap-3 flex-wrap sticky bottom-2 shadow-lg">
        <div>
          <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-1">Prêt à créer</div>
          <div className="text-base">
            <span className="font-mono font-bold text-accent text-2xl mr-1">
              {toCreateCount}
            </span>
            {toCreateCount > 1 ? 'séances seront créées' : 'séance sera créée'}
            <span className="text-white/60 text-sm ml-2">· texte du coach préservé tel quel</span>
          </div>
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
                {toCreateCount > 1 ? `Créer les ${toCreateCount} séances` : 'Créer la séance'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
