/**
 * Motion helpers — wrapper autour de `motion/react` avec :
 *  - Tokens partagés (DUR, EASE) pour cohérence transverse
 *  - Respect automatique de `prefers-reduced-motion`
 *  - Variants réutilisables (fadeIn, slideUp, scaleIn, stagger)
 *
 * Usage :
 *   import { motion, DUR, EASE, VARIANTS } from '@/lib/motion';
 *   <motion.div variants={VARIANTS.fadeIn} initial="hidden" animate="visible" />
 */

export { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, animate, useInView } from 'motion/react';
export type { Variants, Transition } from 'motion/react';

/* ============================================================
   Tokens
   ============================================================ */

export const DUR = {
  fast: 0.18,   // hover, tap
  base: 0.28,   // entrée d'élément, modal
  slow: 0.5,    // hero, takeover, stamp validation
  loop: 1.4,    // skeleton shimmer
} as const;

export const EASE = {
  /** expo out — entrée d'écran, défaut */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** standard inOut */
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** léger overshoot — validation, like */
  bounce: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
} as const;

/* ============================================================
   Variants prêts à l'emploi
   ============================================================ */

import type { Variants } from 'motion/react';

export const VARIANTS = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE.out } },
  } satisfies Variants,

  slideUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
  } satisfies Variants,

  slideDown: {
    hidden: { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
  } satisfies Variants,

  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: DUR.base, ease: EASE.out } },
  } satisfies Variants,

  /** Container pour stagger d'enfants */
  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  } satisfies Variants,

  /** Enfant à mettre dans staggerContainer */
  staggerItem: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
  } satisfies Variants,

  /** Bottom sheet mobile — slide depuis le bas */
  bottomSheet: {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: DUR.base, ease: EASE.out } },
    exit: { y: '100%', opacity: 0, transition: { duration: DUR.fast, ease: EASE.out } },
  } satisfies Variants,

  /** Modal centré — fade + scale */
  modal: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: DUR.fast, ease: EASE.out } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: DUR.fast, ease: EASE.out } },
  } satisfies Variants,
} as const;

/* ============================================================
   Spring presets
   ============================================================ */

export const SPRING = {
  /** Doux, pour layoutId (bottom nav, tabs) */
  smooth: { type: 'spring' as const, stiffness: 380, damping: 30 },
  /** Plus snappy */
  snappy: { type: 'spring' as const, stiffness: 500, damping: 35 },
  /** Bouncy, pour validation */
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 20 },
} as const;

/* ============================================================
   Haptiques mobile — feedback tactile sur PWA installée
   ============================================================ */

export function haptic(pattern: 'light' | 'medium' | 'strong' | 'success' | 'error' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const patterns: Record<typeof pattern, number | number[]> = {
    light: 10,
    medium: 20,
    strong: 40,
    success: [15, 30, 15],
    error: [40, 30, 40],
  };
  navigator.vibrate(patterns[pattern]);
}

/* ============================================================
   Confetti helper — célébration validation séance / VMA record
   ============================================================ */

export async function celebrate(intensity: 'subtle' | 'normal' | 'strong' = 'normal') {
  // Lazy-load canvas-confetti pour pas plomber le bundle initial
  const { default: confetti } = await import('canvas-confetti');

  const counts = { subtle: 30, normal: 80, strong: 160 };
  const spreads = { subtle: 50, normal: 70, strong: 100 };

  confetti({
    particleCount: counts[intensity],
    spread: spreads[intensity],
    origin: { y: 0.6 },
    colors: ['#6CCBE6', '#22c55e', '#FFD700', '#FC4C02'],
    disableForReducedMotion: true,
  });
}
