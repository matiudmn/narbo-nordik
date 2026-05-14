import type { ReactNode } from 'react';

type Variant = 'night' | 'cyan' | 'success' | 'danger';

interface HeroBlockProps {
  /** Label en haut (micro, uppercase) */
  eyebrow?: string;
  /** Titre principal */
  title: ReactNode;
  /** Sous-titre / description */
  subtitle?: ReactNode;
  /** Métrique XL (chiffre) */
  metric?: ReactNode;
  /** Unité du chiffre */
  unit?: string;
  /** Variante de fond */
  variant?: Variant;
  /** CTA optionnel */
  cta?: ReactNode;
  className?: string;
}

const variantBg: Record<Variant, string> = {
  night: 'bg-gradient-to-br from-black via-neutral-900 to-neutral-800 text-white',
  cyan: 'bg-gradient-to-br from-accent-dark via-accent to-accent-light text-white',
  success: 'bg-gradient-to-br from-success-700 via-success-600 to-success-500 text-white',
  danger: 'bg-gradient-to-br from-danger-700 via-danger-600 to-danger-500 text-white',
};

/**
 * Bloc hero avec gradient signature, métrique XL et CTA optionnel.
 * Usage : Home (next session), VMA record takeover, splash page.
 */
export function HeroBlock({
  eyebrow,
  title,
  subtitle,
  metric,
  unit,
  variant = 'night',
  cta,
  className = '',
}: HeroBlockProps) {
  return (
    <div
      className={[
        'relative rounded-2xl p-6 overflow-hidden shadow-takeover',
        variantBg[variant],
        className,
      ].join(' ')}
    >
      {/* Glow décoratif */}
      <div
        className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative">
        {eyebrow && (
          <p className="label-micro text-white/60 mb-2">{eyebrow}</p>
        )}
        <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-white/70 mt-1">{subtitle}</p>}
        {metric !== undefined && (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-stat text-stat-xl leading-none">{metric}</span>
            {unit && <span className="text-base text-white/70">{unit}</span>}
          </div>
        )}
        {cta && <div className="mt-4">{cta}</div>}
      </div>
    </div>
  );
}
