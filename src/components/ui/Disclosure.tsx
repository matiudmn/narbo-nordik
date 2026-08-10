import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, DUR, EASE, useReducedMotion } from '../../lib/motion';
import { Card } from './Card';
import { getDisclosureTriggerProps, getDisclosurePanelProps, toggleDisclosure, DISCLOSURE_HEADING_TAGS } from './disclosureAria';

export interface DisclosureProps {
  /** Titre toujours visible, affiché dans le bouton déclencheur */
  title: string;
  /** Icône optionnelle, affichée avant le titre */
  icon?: ReactNode;
  /** Sous-titre optionnel, sous le titre */
  subtitle?: string;
  /** Ouvert par défaut (replié sinon) */
  defaultOpen?: boolean;
  /**
   * Niveau de titre (h2-h6) qui enveloppe le bouton déclencheur, cf. pattern
   * WAI-ARIA accordion officiel. Purement sémantique (`display: contents`,
   * aucun changement visuel) : à choisir selon la hiérarchie de titres réelle
   * de la page hôte. Défaut : 3.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
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
 * `<button>` gère Espace/Entrée sans handler dédié). Le bouton est enveloppé
 * dans un heading (`headingLevel`) pour rester repérable dans la structure
 * de titres de la page, cf. pattern WAI-ARIA accordion officiel.
 */
export function Disclosure({ title, icon, subtitle, defaultOpen = false, headingLevel = 3, className = '', children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const triggerProps = getDisclosureTriggerProps(id, open);
  const panelProps = getDisclosurePanelProps(id);
  const reduceMotion = useReducedMotion();
  const HeadingTag = DISCLOSURE_HEADING_TAGS[headingLevel];

  return (
    <Card padding="none" className={['overflow-hidden', className].filter(Boolean).join(' ')}>
      <HeadingTag className="contents">
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
      </HeadingTag>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={panelProps.id}
            {...panelProps}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: reduceMotion ? { duration: 0.01 } : { duration: DUR.base, ease: EASE.out },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: reduceMotion ? { duration: 0.01 } : { duration: DUR.fast, ease: EASE.out },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-neutral-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
