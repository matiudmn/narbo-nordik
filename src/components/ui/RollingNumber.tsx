import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, DUR, EASE } from '../../lib/motion';

interface RollingNumberProps {
  /** Valeur cible */
  value: number;
  /** Durée de l'animation (en secondes). Défaut: DUR.slow */
  duration?: number;
  /** Formatter optionnel (défaut: toLocaleString FR avec tabular nums) */
  format?: (v: number) => string;
  className?: string;
}

/**
 * Nombre qui s'anime de 0 (ou valeur précédente) vers `value`.
 * Tabular nums pour éviter le shift.
 */
export function RollingNumber({ value, duration, format, className = '' }: RollingNumberProps) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => {
    const n = Math.round(v);
    return format ? format(n) : n.toLocaleString('fr-FR');
  });

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: duration ?? DUR.slow,
      ease: EASE.out,
    });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={`tabular ${className}`}>{rounded}</motion.span>;
}
