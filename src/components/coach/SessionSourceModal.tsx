import { useEffect, useMemo, useState } from 'react';
import { Search, X, FileText, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, VARIANTS, SPRING } from '../../lib/motion';
import { TemplateCard } from './TemplateCard';
import { Button } from '../ui';
import {
  fetchTemplates,
  instantiateTemplate,
  incrementUsage,
  deleteTemplate,
  CATEGORY_LABELS,
  type InstantiatedTemplate,
} from '../../lib/sessionTemplates';
import type { SessionTemplate, TemplateCategory } from '../../types';

type Tab = 'template' | 'lastweek' | 'blank';

interface SessionSourceModalProps {
  open: boolean;
  onClose: () => void;
  /** Appelé quand le coach a choisi un template ou la duplication */
  onPickInstantiated: (draft: InstantiatedTemplate) => void;
  /** Appelé quand le coach choisit "Vide" — ouvre juste le form */
  onPickBlank: () => void;
  /** Sessions de la semaine passée à proposer en duplication */
  lastWeekSessions: { id: string; title: string; date: string; blocks: SessionTemplate['blocks']; session_type: SessionTemplate['session_type']; terrain_options: SessionTemplate['terrain_options']; description: string | null }[];
}

const TABS: { id: Tab; label: string; icon: typeof Search }[] = [
  { id: 'template', label: 'Template', icon: Sparkles },
  { id: 'lastweek', label: 'Semaine S-1', icon: Calendar },
  { id: 'blank', label: 'Vide', icon: FileText },
];

const CATEGORY_FILTERS: (TemplateCategory | 'all')[] = ['all', 'vma', 'seuil', 'endurance', 'sortie_longue', 'recup'];

export function SessionSourceModal({
  open,
  onClose,
  onPickInstantiated,
  onPickBlank,
  lastWeekSessions,
}: SessionSourceModalProps) {
  const [tab, setTab] = useState<Tab>('template');
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [templates, search, category]);

  const handleUseTemplate = async (tpl: SessionTemplate) => {
    const draft = instantiateTemplate(tpl);
    onPickInstantiated(draft);
    onClose();
    // Fire & forget
    void incrementUsage(tpl.id);
  };

  const handleDeleteTemplate = async (tpl: SessionTemplate) => {
    if (tpl.is_seed) return;
    if (!window.confirm(`Supprimer le template « ${tpl.name} » ?`)) return;
    const ok = await deleteTemplate(tpl.id);
    if (ok) setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
  };

  const handleUseLastWeek = (session: SessionSourceModalProps['lastWeekSessions'][number]) => {
    onPickInstantiated({
      title: session.title,
      description: session.description,
      session_type: session.session_type,
      terrain_options: session.terrain_options,
      blocks: session.blocks.map((b) => ({ ...b, id: `blk_dup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/50 flex items-end lg:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-source-title"
        >
          <motion.div
            key="sheet"
            variants={VARIANTS.bottomSheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="w-full lg:max-w-2xl bg-white rounded-t-2xl lg:rounded-2xl shadow-pop max-h-[90vh] flex flex-col safe-bottom"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
              <h2 id="session-source-title" className="text-base font-bold text-neutral-900">
                Nouvelle séance
              </h2>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="p-2 -mr-2 text-neutral-400 hover:text-neutral-700"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Source de la séance" className="flex gap-1 px-5 pt-3 border-b border-neutral-100 shrink-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                const selected = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(t.id)}
                    className={[
                      'relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
                      selected ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700',
                    ].join(' ')}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{t.label}</span>
                    {selected && (
                      <motion.span
                        layoutId="source-tab-underline"
                        className="absolute -bottom-px left-2 right-2 h-0.5 bg-primary rounded-full"
                        transition={SPRING.smooth}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'template' && (
                <>
                  {/* Search + filters */}
                  <div className="space-y-2 mb-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Rechercher un template…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        aria-label="Rechercher un template"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {CATEGORY_FILTERS.map((cat) => {
                        const selected = category === cat;
                        const label = cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat];
                        return (
                          <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={[
                              'text-xs px-2.5 py-1 rounded-full border transition-colors',
                              selected
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {loading && <p className="text-sm text-neutral-400 text-center py-6">Chargement…</p>}
                  {!loading && filteredTemplates.length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-8">
                      Aucun template ne correspond à ta recherche.
                    </p>
                  )}
                  <div className="space-y-2">
                    {filteredTemplates.map((tpl) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        onUse={handleUseTemplate}
                        onDelete={handleDeleteTemplate}
                      />
                    ))}
                  </div>
                </>
              )}

              {tab === 'lastweek' && (
                <>
                  {lastWeekSessions.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">
                      Aucune séance la semaine passée à dupliquer.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-500 mb-2">
                        Sélectionne une séance à reprendre cette semaine. La date sera à ajuster.
                      </p>
                      {lastWeekSessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleUseLastWeek(s)}
                          className="w-full text-left bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 p-4 hover:shadow-card-hover transition-all"
                        >
                          <p className="font-semibold text-neutral-900">{s.title}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                            {' · '}
                            {s.blocks.length} bloc{s.blocks.length > 1 ? 's' : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'blank' && (
                <div className="text-center py-8">
                  <FileText size={40} className="text-neutral-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-neutral-600 mb-4">
                    Repartir d'une séance vide et tout construire à la main.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onPickBlank();
                      onClose();
                    }}
                  >
                    Créer depuis une séance vide
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
