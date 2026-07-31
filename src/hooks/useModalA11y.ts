import { useEffect, useId, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

interface UseModalA11yOptions {
  /** Désactive la fermeture via Escape (ex. pendant un chargement bloquant). */
  disableEscape?: boolean;
  /** Élément à focuser à l'ouverture (sinon le premier élément focusable du conteneur). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

// Pile des modales ouvertes (au niveau module) : seule celle du sommet
// traite Escape/Tab, pour que les modales imbriquées (ex. ConfirmDialog
// dans SessionSourceModal) ne se ferment pas en cascade sur un seul Escape.
let modalStack: string[] = [];

// Verrou de scroll compté (au niveau module) : la valeur initiale de
// body.overflow n'est mémorisée qu'au passage 0 -> 1, et n'est restaurée
// qu'au retour à 0, pour que la fermeture d'une modale imbriquée ne
// déverrouille pas le scroll tant qu'une modale parente reste ouverte.
let scrollLockCount = 0;
let previousBodyOverflow = '';

function lockScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
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
  const id = useId();
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
    lockScroll();
    modalStack.push(id);

    const target =
      optionsRef.current.initialFocusRef?.current ??
      containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    const isTopModal = () => modalStack[modalStack.length - 1] === id;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopModal()) return;
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
      modalStack = modalStack.filter((modalId) => modalId !== id);
      unlockScroll();
      previouslyFocused.current?.focus?.();
    };
  }, [open, containerRef, id]);
}
