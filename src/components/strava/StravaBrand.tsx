/**
 * Strava brand components — built to comply with Strava Brand Guidelines.
 *
 * Reference: https://developers.strava.com/guidelines/
 *
 * If the official PNG/SVG assets are placed in /public/strava/,
 * the components will prefer those. Otherwise they fall back to
 * brand-compliant CSS/SVG approximations (orange #FC4C02 + wordmark).
 *
 * Required by Strava:
 *  - Every screen displaying Strava data must show attribution
 *    ("Powered by Strava" or "Compatible with Strava")
 *  - The "Connect with Strava" button uses Strava's official styling
 *  - The Strava wordmark, when used, follows brand colors and proportions
 */

import { useState } from 'react';

const STRAVA_ORANGE = '#FC4C02';

/* ------------------------------------------------------------
   StravaWordmark — the "STRAVA" word in brand style
   ------------------------------------------------------------ */

interface StravaWordmarkProps {
  /** Height in pixels (width auto-scales). Default: 16 */
  height?: number;
  /** Display variant. Default: "orange" (white on orange ctx use "white") */
  variant?: 'orange' | 'white';
  className?: string;
}

export function StravaWordmark({
  height = 16,
  variant = 'orange',
  className = '',
}: StravaWordmarkProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Try official asset first
  if (!imgFailed) {
    return (
      <img
        src={variant === 'white' ? '/strava/wordmark-white.svg' : '/strava/wordmark-orange.svg'}
        alt="Strava"
        height={height}
        style={{ height: `${height}px`, width: 'auto' }}
        className={className}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback: CSS-only wordmark that respects brand color & weight
  return (
    <span
      className={className}
      style={{
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontWeight: 900,
        fontSize: `${height}px`,
        letterSpacing: '0.04em',
        lineHeight: 1,
        color: variant === 'white' ? '#ffffff' : STRAVA_ORANGE,
        textTransform: 'uppercase',
      }}
      aria-label="Strava"
    >
      STRAVA
    </span>
  );
}

/* ------------------------------------------------------------
   PoweredByStrava — small attribution required on every screen
   showing Strava-sourced data
   ------------------------------------------------------------ */

interface PoweredByStravaProps {
  className?: string;
  /** "powered" (default) or "compatible" */
  label?: 'powered' | 'compatible';
}

export function PoweredByStrava({
  className = '',
  label = 'powered',
}: PoweredByStravaProps) {
  return (
    <p
      className={[
        'inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 uppercase tracking-wide',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>{label === 'powered' ? 'Powered by' : 'Compatible with'}</span>
      <StravaWordmark height={10} variant="orange" />
    </p>
  );
}

/* ------------------------------------------------------------
   ConnectWithStravaButton — official-style OAuth CTA
   ------------------------------------------------------------ */

interface ConnectWithStravaButtonProps {
  href: string;
  className?: string;
}

export function ConnectWithStravaButton({
  href,
  className = '',
}: ConnectWithStravaButtonProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Strava provides an official "btn_strava_connectwith_orange.png" asset.
  // We prefer it. If absent, we render a compliant approximation:
  //  - Orange bg (#FC4C02), white text
  //  - "Connect with Strava" wording (exact phrasing required)
  //  - Strava wordmark/logo on the right
  return (
    <a
      href={href}
      className={[
        'inline-flex items-center justify-center w-full max-w-xs',
        'rounded-md transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: STRAVA_ORANGE }}
    >
      {!imgFailed ? (
        <img
          src="/strava/btn_strava_connectwith_orange.png"
          alt="Connect with Strava"
          className="h-12 w-auto"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="flex items-center gap-2 px-5 py-3 text-white font-semibold text-sm">
          <span>Connect with</span>
          <StravaWordmark height={14} variant="white" />
        </span>
      )}
    </a>
  );
}
