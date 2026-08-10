/**
 * Logique pure du pattern WAI-ARIA Disclosure, extraite de Disclosure.tsx
 * pour rester testable sans DOM (aucune dépendance React ici).
 */

/** Props ARIA du bouton déclencheur, dérivées de l'état ouvert/fermé. */
export function getDisclosureTriggerProps(id: string, open: boolean) {
  return {
    id: `${id}-trigger`,
    'aria-expanded': open,
    'aria-controls': `${id}-panel`,
  } as const;
}

/** Props ARIA du panneau de contenu : région labellisée par le bouton. */
export function getDisclosurePanelProps(id: string) {
  return {
    id: `${id}-panel`,
    role: 'region' as const,
    'aria-labelledby': `${id}-trigger`,
  };
}

/**
 * Inverse l'état ouvert/fermé. Utilisée en `setOpen(toggleDisclosure)` :
 * le clic souris et l'activation clavier (Espace/Entrée sur un <button>
 * natif) déclenchent tous deux le même `onClick`, donc la même bascule.
 */
export function toggleDisclosure(open: boolean): boolean {
  return !open;
}

/**
 * Nom de balise du heading (h2-h6) qui enveloppe le bouton déclencheur,
 * cf. pattern WAI-ARIA accordion officiel (le bouton est enveloppé dans un
 * élément heading pour rester repérable dans la structure de titres).
 * Table statique (pas de fonction) : react-hooks/static-components (7.x)
 * interdit d'utiliser en tant que tag JSX une valeur issue d'un appel de
 * fonction, seul un accès de propriété direct passe la règle.
 */
export const DISCLOSURE_HEADING_TAGS = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<2 | 3 | 4 | 5 | 6, string>;
