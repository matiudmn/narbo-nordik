import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

interface UseModalA11yOptions {
  /** Désactive la fermeture via Escape (ex. pendant un chargement bloquant). */
  disableEscape?: boolean;
  /** Élément à focuser à l'ouverture (sinon le premier élément focusable du conteneur). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Comportement d'accessibilité partagé pour modales et bottom sheets :
 * verrouillage du scroll de fond, piège du focus (Tab / Shift+Tab),
 * fermeture Escape, et retour du focus au déclencheur à la fermeture.
 * Mécanisme repris de CommandPalette.
 */
export function useModalA11y(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: UseModalA11yOptions = {}
) {
  const onCloseRef = useRef(onClose);
  const optionsRef = useRef(options);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Refs "dernière valeur connue", synchronisées après le rendu (jamais pendant).
  useEffect(() => {
    onCloseRef.current = onClose;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const target =
      optionsRef.current.initialFocusRef?.current ??
      containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (optionsRef.current.disableEscape) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open, containerRef]);
}
