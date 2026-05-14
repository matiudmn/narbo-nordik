import { useEffect } from 'react';
import { motion, AnimatePresence, VARIANTS } from '../../lib/motion';
import { X, Target, Smile } from 'lucide-react';
import { Button } from '../ui';
import type { ObjectiveReached, Sensations } from '../../types';

interface QuickSurveySheetProps {
  open: boolean;
  sessionTitle: string;
  /** Réponse choisie pour l'objectif (null si pas encore répondu) */
  objective: ObjectiveReached | null;
  /** Réponse choisie pour les sensations */
  sensations: Sensations | null;
  onObjectiveChange: (v: ObjectiveReached) => void;
  onSensationsChange: (v: Sensations) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}

const OBJECTIVE_OPTIONS: { value: ObjectiveReached; label: string; emoji: string }[] = [
  { value: 'oui', label: 'Oui', emoji: '🎯' },
  { value: 'partiel', label: 'Partiel', emoji: '🙂' },
  { value: 'non', label: 'Non', emoji: '😕' },
];

const SENSATIONS_OPTIONS: { value: Sensations; label: string; emoji: string }[] = [
  { value: 'excellentes', label: 'Excellentes', emoji: '🤩' },
  { value: 'bonnes', label: 'Bonnes', emoji: '💪' },
  { value: 'mauvaises', label: 'Mauvaises', emoji: '😓' },
];

/**
 * Bottom sheet déclenché 2s après une validation 1-tap depuis Home.
 * Sondage optionnel : objectif atteint + sensations. Bouton "Plus tard"
 * pour passer sans perdre la validation.
 */
export function QuickSurveySheet({
  open,
  sessionTitle,
  objective,
  sensations,
  onObjectiveChange,
  onSensationsChange,
  onSave,
  onClose,
  loading = false,
}: QuickSurveySheetProps) {
  // Escape ferme
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
          aria-labelledby="quicksurvey-title"
        >
          <motion.div
            key="sheet"
            variants={VARIANTS.bottomSheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="w-full lg:max-w-md bg-white rounded-t-2xl lg:rounded-2xl shadow-pop safe-bottom"
          >
            {/* Drag handle mobile */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 bg-neutral-200 rounded-full" aria-hidden="true" />
            </div>

            <div className="px-6 pt-4 pb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-micro text-success-600">Séance validée</p>
                <h2 id="quicksurvey-title" className="text-base font-semibold text-neutral-900 mt-0.5 truncate">
                  {sessionTitle}
                </h2>
                <p className="text-sm text-neutral-500 mt-1">Comment ça s'est passé ?</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer le sondage"
                className="shrink-0 -mr-2 -mt-1 p-2 text-neutral-400 hover:text-neutral-700"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Objectif */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={14} className="text-neutral-400" aria-hidden="true" />
                  <span className="label-micro text-neutral-500">Objectif atteint ?</span>
                </div>
                <div className="flex gap-2" role="radiogroup" aria-label="Objectif atteint">
                  {OBJECTIVE_OPTIONS.map((opt) => {
                    const selected = objective === opt.value;
                    return (
                      <button
                        key={opt.value}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onObjectiveChange(opt.value)}
                        className={[
                          'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all',
                          selected
                            ? 'bg-accent/15 border-accent text-accent-dark font-semibold'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300',
                        ].join(' ')}
                      >
                        <span className="text-2xl" aria-hidden="true">{opt.emoji}</span>
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sensations */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Smile size={14} className="text-neutral-400" aria-hidden="true" />
                  <span className="label-micro text-neutral-500">Tes sensations</span>
                </div>
                <div className="flex gap-2" role="radiogroup" aria-label="Tes sensations">
                  {SENSATIONS_OPTIONS.map((opt) => {
                    const selected = sensations === opt.value;
                    return (
                      <button
                        key={opt.value}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onSensationsChange(opt.value)}
                        className={[
                          'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all',
                          selected
                            ? 'bg-accent/15 border-accent text-accent-dark font-semibold'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300',
                        ].join(' ')}
                      >
                        <span className="text-2xl" aria-hidden="true">{opt.emoji}</span>
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
              <Button
                variant="accent"
                size="md"
                fullWidth
                loading={loading}
                disabled={!objective && !sensations}
                onClick={onSave}
              >
                Enregistrer mon ressenti
              </Button>
              <Button variant="ghost" size="md" fullWidth onClick={onClose} disabled={loading}>
                Plus tard
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
