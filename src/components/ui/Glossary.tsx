import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * Glossaire des termes techniques running affichés dans l'app.
 * À enrichir au fur et à mesure.
 */
const GLOSSARY: Record<string, { label: string; definition: string }> = {
  VMA: {
    label: 'VMA',
    definition:
      'Vitesse Maximale Aérobie : ta vitesse à consommation d\'oxygène maximale. Sert de base à toutes tes allures d\'entraînement.',
  },
  SV1: {
    label: 'SV1',
    definition:
      "Seuil ventilatoire 1 (~78% VMA). Allure tenable longtemps, souffle contrôlé. Développe l'endurance aérobie.",
  },
  SV2: {
    label: 'SV2',
    definition:
      "Seuil ventilatoire 2 (~85% VMA). Rythme « semi », travail du seuil lactique, inconfort maîtrisé.",
  },
  AER: {
    label: 'AER',
    definition:
      "Allure échauffement / récupération (~55% VMA). Footing très facile, conversation possible. Sert à l'échauffement et au retour au calme.",
  },
  EF: {
    label: 'EF',
    definition:
      "Endurance fondamentale (~65% VMA). Allure conversationnelle. Le socle de tout entraînement running.",
  },
  AM: {
    label: 'AM',
    definition:
      "Aérobie modéré (~75% VMA). Rythme soutenu régulier qui renforce le volume aérobie.",
  },
  AS42: {
    label: 'AS42',
    definition: "Allure spécifique marathon — le rythme exact de ta course cible sur 42,195 km.",
  },
  AS21: {
    label: 'AS21',
    definition: "Allure spécifique semi-marathon — le rythme exact de ta course cible sur 21,1 km.",
  },
  AS10: {
    label: 'AS10',
    definition: "Allure spécifique 10 km — le rythme exact de ta course cible sur 10 km.",
  },
  AS5: {
    label: 'AS5',
    definition: "Allure spécifique 5 km — le rythme exact de ta course cible sur 5 km.",
  },
  'D+': {
    label: 'D+',
    definition:
      "Dénivelé positif (cumul de montée en mètres). Critère clé en trail et sortie longue.",
  },
  Nordik: {
    label: 'Nordik',
    definition:
      "Le « like » du club : donne un Nordik aux séances et perfs qui te motivent. Tu peux en recevoir aussi.",
  },
};

export type GlossaryTerm = keyof typeof GLOSSARY;

interface GlossaryProps {
  term: GlossaryTerm | string;
  /** Texte affiché (par défaut = term). */
  children?: ReactNode;
  className?: string;
}

/**
 * Met en évidence un terme technique avec un tooltip explicatif au clic / hover.
 * Mobile-friendly : se ferme au tap-outside ou Escape.
 *
 * @example
 *   <Glossary term="VMA">VMA</Glossary> 16.5 km/h
 */
export function Glossary({ term, children, className = '' }: GlossaryProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const entry = GLOSSARY[term as GlossaryTerm];
  if (!entry) {
    // Si le terme n'est pas dans le glossaire, on rend juste le texte sans tooltip
    return <>{children ?? term}</>;
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        // Ferme si le clic n'est pas sur le trigger ET pas sur le tooltip
        const tooltip = document.querySelector(`[data-glossary-tooltip="${term}"]`);
        if (!tooltip?.contains(e.target as Node)) setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, term]);

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Définition : ${entry.label}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={[
          'inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 decoration-neutral-400 hover:decoration-accent transition-colors cursor-help',
          className,
        ].join(' ')}
      >
        {children ?? entry.label}
        <Info size={11} className="text-neutral-400" aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          data-glossary-tooltip={term}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 max-w-[calc(100vw-2rem)] bg-neutral-900 text-white text-xs rounded-lg p-3 shadow-pop animate-fade-in"
        >
          <span className="block font-bold mb-1 text-accent">{entry.label}</span>
          <span className="block leading-snug text-neutral-200">{entry.definition}</span>
        </span>
      )}
    </span>
  );
}
