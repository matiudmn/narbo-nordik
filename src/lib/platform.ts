/**
 * Détections de plateforme, réservées à l'aide à l'installation.
 *
 * Samsung Browser émet bien `beforeinstallprompt`, mais fabrique lui-même le
 * paquet d'installation avec un niveau d'API périmé : Play Protect le rejette
 * avec « Appli dangereuse bloquée ». Défaut Samsung connu depuis avril 2026,
 * non corrigé, qui touche toutes les applications de ce type. L'application ne
 * peut pas le corriger, seulement éviter d'y envoyer les membres.
 */

function userAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function touchPoints(): number {
  return typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0);
}

export function isSamsungBrowser(): boolean {
  return userAgent().includes('SamsungBrowser/');
}

/** iPhone, iPod, et iPad (moderne inclus : il s'annonce en Macintosh tactile). */
export function isIos(): boolean {
  const ua = userAgent();
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return ua.includes('Macintosh') && touchPoints() > 0;
}

export function isAndroid(): boolean {
  return userAgent().includes('Android');
}

/** Le bandeau d'installation ne vise que le mobile : sur desktop, c'est du bruit. */
export function isMobileDevice(): boolean {
  return isIos() || isAndroid();
}
