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
