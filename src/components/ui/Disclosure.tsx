import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, DUR, EASE } from '../../lib/motion';
import { Card } from './Card';
import { getDisclosureTriggerProps, getDisclosurePanelProps, toggleDisclosure } from './disclosureAria';

export interface DisclosureProps {
  /** Titre toujours visible, affiché dans le bouton déclencheur */
  title: string;
  /** Icône optionnelle, affichée avant le titre */
  icon?: ReactNode;
  /** Sous-titre optionnel, sous le titre */
  subtitle?: string;
  /** Ouvert par défaut (replié sinon) */
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Disclosure : primitive accordéon WAI-ARIA réutilisable.
 * Fondation du pattern "résumé + détails" (C9, UX double persona) :
 * le titre/résumé restent toujours visibles, le contenu détaillé
 * est replié par défaut et se déplie à la demande.
 *
 * Pattern WAI-ARIA Disclosure : bouton `aria-expanded` + `aria-controls`,
 * région `role="region"` labellisée par le bouton, clavier natif (le
 * `<button>` gère Espace/Entrée sans handler dédié).
 */
export function Disclosure({ title, icon, subtitle, defaultOpen = false, className = '', children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const triggerProps = getDisclosureTriggerProps(id, open);
  const panelProps = getDisclosurePanelProps(id);

  return (
    <Card padding="none" className={['overflow-hidden', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        {...triggerProps}
        onClick={() => setOpen(toggleDisclosure)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-neutral-900">{title}</span>
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          size={18}
          className={`text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={panelProps.id}
            {...panelProps}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: DUR.base, ease: EASE.out } }}
            exit={{ height: 0, opacity: 0, transition: { duration: DUR.fast, ease: EASE.out } }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-neutral-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
