import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, DUR, EASE } from '../../lib/motion';

interface ZoneAccordionProps {
  /** Identifiant unique pour ARIA (ex: clé de zone) */
  id: string;
  /** Couleur du dot (hex direct car les zones ont déjà leurs propres couleurs) */
  color: string;
  /** Libellé principal de la zone (ex: "SV2", "Endurance fondamentale") */
  label: string;
  /** Sous-titre court (ex: "Seuil ventilatoire 2", "60-70%") */
  subtitle?: string;
  /** Aperçu compact à droite quand replié (ex: "60-70%", "85%") */
  summary?: string;
  /** Ouvert par défaut */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Accordéon par zone d'allure — refonte mobile critique d'AlluresTab.
 *
 * Avant : table 7 colonnes × 9 lignes en text-[8px], illisible.
 * Après : 9 cards repliées, chacune dépliée révèle 5 lignes lisibles
 *         (1 par niveau VMA) avec inputs pleine largeur.
 *
 * Pattern WAI-ARIA Accordion : aria-expanded, aria-controls, region.
 */
export function ZoneAccordion({
  id,
  color,
  label,
  subtitle,
  summary,
  defaultOpen = false,
  children,
}: ZoneAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `zone-${id}-panel`;
  const buttonId = `zone-${id}-button`;

  return (
    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-900">{label}</span>
            {subtitle && (
              <span className="text-xs text-neutral-500 truncate">{subtitle}</span>
            )}
          </div>
        </div>
        {summary && (
          <span className="text-xs font-semibold text-neutral-600 tabular shrink-0">
            {summary}
          </span>
        )}
        <ChevronDown
          size={18}
          className={`text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={panelId}
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: DUR.base, ease: EASE.out } }}
            exit={{ height: 0, opacity: 0, transition: { duration: DUR.fast, ease: EASE.out } }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-neutral-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
