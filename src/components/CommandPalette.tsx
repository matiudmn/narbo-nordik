/**
 * Palette de recherche universelle (type Cmd+K).
 * Recherche locale instantanée + couche IA explicite. Navigation clavier,
 * groupes par type, action rapide "Changer la VMA" pour le coach.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, X, Loader2, CornerDownLeft,
  User, Activity, CheckCircle2, Trophy, Target, UsersRound, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUniversalSearch } from '../hooks/useUniversalSearch';
import { useDebounce } from '../hooks/useDebounce';
import { EmptyState } from './ui';
import { motion, haptic } from '../lib/motion';
import type { SearchKind, SearchResult } from '../lib/search';

const KIND_LABELS: Record<SearchKind, string> = {
  athlete: 'Athlètes', session: 'Séances', validation: 'Séances faites',
  race: 'Palmarès', preparation: 'Prépas', group: 'Groupes', command: 'Aller à',
};

const KIND_ICONS: Record<SearchKind, LucideIcon> = {
  athlete: User, session: Activity, validation: CheckCircle2,
  race: Trophy, preparation: Target, group: UsersRound, command: ArrowRight,
};

const KIND_ORDER: SearchKind[] = ['athlete', 'session', 'validation', 'race', 'preparation', 'group', 'command'];

function group(results: SearchResult[]) {
  const sections: { kind: SearchKind; items: SearchResult[] }[] = [];
  const flat: SearchResult[] = [];
  for (const kind of KIND_ORDER) {
    const items = results.filter(r => r.kind === kind);
    if (items.length === 0) continue;
    sections.push({ kind, items });
    flat.push(...items);
  }
  return { sections, flat };
}

function ResultRow({ result, selected, onActivate, onAction, onHover }: {
  result: SearchResult;
  selected: boolean;
  onActivate: () => void;
  onAction: () => void;
  onHover: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const Icon = KIND_ICONS[result.kind];

  return (
    <div ref={rowRef} className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onActivate}
        onMouseMove={onHover}
        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
          selected ? 'bg-accent/10' : 'hover:bg-gray-50'
        }`}
      >
        <span className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${selected ? 'bg-accent/20 text-accent' : 'bg-gray-100 text-gray-500'}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-gray-900 truncate">{result.title}</span>
          {result.subtitle && <span className="block text-xs text-gray-400 truncate">{result.subtitle}</span>}
        </span>
        {result.badge && (
          <span className="flex-shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {result.badge}
          </span>
        )}
      </button>
      {result.action && (
        <button
          type="button"
          onClick={onAction}
          className="flex-shrink-0 self-center text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 px-2.5 py-2 rounded-lg transition-colors"
        >
          {result.action.label}
        </button>
      )}
    </div>
  );
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { search, ai, runAi, clearAi } = useUniversalSearch();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(query, 180);

  // Focus au montage + lock du scroll de la page.
  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Toute frappe ramène en mode local (on abandonne un éventuel résultat IA).
  useEffect(() => { clearAi(); }, [query, clearAi]);

  const localResults = useMemo(() => search(debounced), [search, debounced]);

  const aiMode = ai.status !== 'idle';
  const displayed = aiMode ? ai.results : localResults;
  const { sections, flat } = useMemo(() => group(displayed), [displayed]);
  const flatIndex = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((r, i) => m.set(`${r.kind}:${r.id}`, i));
    return m;
  }, [flat]);

  useEffect(() => { setSelectedIndex(0); }, [debounced, aiMode, ai.results]);

  const activate = useCallback((r: SearchResult) => {
    haptic('light');
    navigate(r.to);
    onClose();
  }, [navigate, onClose]);

  const doAction = useCallback((r: SearchResult) => {
    if (!r.action) return;
    haptic('light');
    navigate(r.action.to);
    onClose();
  }, [navigate, onClose]);

  const canAi = query.trim().length >= 3;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, flat.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[selectedIndex]) { activate(flat[selectedIndex]); return; }
      if (canAi && !aiMode) runAi(query);
    }
  };

  const showInitial = !aiMode && debounced.trim().length < 2;
  const showEmpty = !showInitial && displayed.length === 0 && ai.status !== 'loading';

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Recherche">
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-x-0 top-0 w-full bg-white shadow-xl flex flex-col max-h-[88vh] rounded-b-2xl lg:left-1/2 lg:-translate-x-1/2 lg:top-20 lg:max-w-xl lg:rounded-2xl lg:max-h-[72vh] pt-[env(safe-area-inset-top)]"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.18 }}
        onKeyDown={onKeyDown}
      >
        {/* Champ */}
        <div className="flex items-center gap-2 px-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un athlète, une séance, un palmarès..."
            aria-label="Rechercher"
            className="flex-1 py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barre IA */}
        {ai.status === 'idle' && canAi && (
          <button
            type="button"
            onClick={() => runAi(query)}
            className="flex items-center gap-2 px-4 py-2.5 text-left border-b border-gray-100 hover:bg-accent/5 transition-colors"
          >
            <Sparkles size={16} className="text-accent flex-shrink-0" aria-hidden="true" />
            <span className="text-sm text-gray-700">
              Demander à l'IA : <span className="font-medium text-gray-900">{query.trim()}</span>
            </span>
          </button>
        )}
        {ai.status === 'loading' && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">
            <Loader2 size={16} className="text-accent animate-spin flex-shrink-0" aria-hidden="true" />
            L'IA analyse ta demande...
          </div>
        )}
        {ai.status === 'done' && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
            <Sparkles size={16} className="text-accent flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-xs text-gray-500 truncate">
              {ai.description ? `Filtré par IA : ${ai.description}` : 'Recherche IA'}
            </span>
            <button type="button" onClick={clearAi} className="text-xs font-medium text-accent hover:underline flex-shrink-0">
              Effacer
            </button>
          </div>
        )}
        {ai.status === 'error' && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 text-sm text-danger">
            <span className="flex-1">Recherche IA indisponible.</span>
            <button type="button" onClick={clearAi} className="text-xs font-medium text-gray-500 hover:underline flex-shrink-0">
              Fermer
            </button>
          </div>
        )}

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2">
          {showInitial && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-gray-400">
                Tape un nom d'athlète, un titre de séance, une course...
              </p>
              <p className="mt-1 text-xs text-gray-300">
                Astuce : pose une question à l'IA, par exemple « séances de seuil en juin ».
              </p>
            </div>
          )}

          {showEmpty && (
            <EmptyState
              icon={<Search size={28} />}
              title="Aucun résultat"
              description={aiMode ? 'Reformule ta demande à l\'IA.' : 'Essaie un autre mot, ou demande à l\'IA.'}
            />
          )}

          {sections.map(section => (
            <div key={section.kind} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {KIND_LABELS[section.kind]}
              </p>
              {section.items.map(item => {
                const idx = flatIndex.get(`${item.kind}:${item.id}`) ?? 0;
                return (
                  <ResultRow
                    key={`${item.kind}:${item.id}`}
                    result={item}
                    selected={idx === selectedIndex}
                    onActivate={() => activate(item)}
                    onAction={() => doAction(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Pied : aides clavier (desktop) */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><CornerDownLeft size={12} /> ouvrir</span>
          <span>↑ ↓ naviguer</span>
          <span>échap fermer</span>
        </div>
      </motion.div>
    </div>
  );
}
