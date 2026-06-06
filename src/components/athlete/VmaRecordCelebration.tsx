import { useEffect, useRef } from 'react';
import { Trophy, X } from 'lucide-react';
import { motion, AnimatePresence, DUR, EASE, celebrate, haptic } from '../../lib/motion';
import { Button, RollingNumber } from '../ui';

interface VmaRecordCelebrationProps {
  open: boolean;
  previousVma: number;
  newVma: number;
  onClose: () => void;
}

/**
 * Wow moment "Nouvelle VMA record" — full-screen takeover animé
 * déclenché à la 1ère ouverture de l'app après une mise à jour VMA
 * qui dépasse l'historique max.
 *
 * Composé de :
 *   - Backdrop noir avec gradient cyan glow
 *   - Trophy icon qui scale + rotate
 *   - Rolling numbers de previousVma vers newVma
 *   - Confetti automatique à l'ouverture
 *   - Haptic success
 *   - CTA de fermeture
 */
export function VmaRecordCelebration({
  open,
  previousVma,
  newVma,
  onClose,
}: VmaRecordCelebrationProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (open && !firedRef.current) {
      firedRef.current = true;
      haptic('success');
      void celebrate('normal');
    }
    if (!open) firedRef.current = false;
  }, [open]);

  // Escape pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const diff = newVma - previousVma;
  const pct = ((diff / previousVma) * 100).toFixed(1);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="vma-celeb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vma-celeb-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(108,203,230,0.25), transparent 60%), linear-gradient(135deg, #000000 0%, #0a1626 50%, #0d2a3a 100%)',
          }}
        >
          {/* Close button discret */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center transition-colors safe-top"
          >
            <X size={20} aria-hidden="true" />
          </button>

          <div className="text-center text-white max-w-sm">
            {/* Trophy animé */}
            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: DUR.slow, ease: EASE.bounce, delay: 0.1 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 shadow-takeover mb-6"
            >
              <Trophy size={48} strokeWidth={2.5} className="text-white" aria-hidden="true" />
            </motion.div>

            {/* Eyebrow */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, delay: 0.3, ease: EASE.out }}
              className="label-micro text-accent mb-2"
            >
              Nouvelle VMA record
            </motion.p>

            {/* Title */}
            <motion.h2
              id="vma-celeb-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, delay: 0.4, ease: EASE.out }}
              className="font-display text-2xl font-bold mb-1"
            >
              Bravo, tu progresses !
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, delay: 0.5, ease: EASE.out }}
              className="text-sm text-white/70 mb-6"
            >
              Ton coach vient de mettre à jour ta VMA.
            </motion.p>

            {/* Numbers */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: DUR.slow, delay: 0.55, ease: EASE.out }}
              className="flex items-center justify-center gap-3 mb-4"
            >
              <span className="text-3xl text-white/40 font-stat tabular line-through">{previousVma}</span>
              <span className="text-white/40">→</span>
              <span className="font-stat text-stat-xl text-accent leading-none tabular">
                <RollingNumber value={newVma} duration={1} format={(v) => v.toFixed(1)} />
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DUR.base, delay: 1.2 }}
              className="text-xs text-white/60 mb-8"
            >
              <span className="text-accent font-semibold tabular">
                +{diff.toFixed(1)} km/h (+{pct}%)
              </span>
              {' · '}Tes allures viennent d'être recalculées.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, delay: 1.4, ease: EASE.out }}
            >
              <Button variant="accent" size="lg" onClick={onClose}>
                Je découvre mes nouvelles allures
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
