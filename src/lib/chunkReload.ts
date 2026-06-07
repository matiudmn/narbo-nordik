/**
 * Résilience aux décalages de chunks après déploiement.
 *
 * Contexte : l'app est une PWA (vite-plugin-pwa / Workbox). Après un déploiement
 * Vercel, une session déjà ouverte peut conserver un index.js (servi par le
 * service worker) qui référence d'anciens hash de chunks lazy (React.lazy /
 * import dynamique). Le premier import() d'une route lazy échoue alors, avec une
 * erreur du type "Failed to fetch dynamically imported module", et
 * l'ErrorBoundary affiche un écran d'erreur jusqu'au rechargement manuel.
 *
 * Stratégie : recharger la page une seule fois pour récupérer l'index.html à
 * jour (le nouveau service worker, déjà actif, sert le nouvel index.html). Un
 * garde-fou anti-boucle (horodatage en sessionStorage) évite de recharger en
 * continu si le chunk est réellement introuvable (hors-ligne, asset supprimé).
 *
 * On ne force PAS le contournement du cache : un rechargement normal passe par
 * le service worker à jour, ce qui préserve le fonctionnement hors-ligne.
 */

// Clé + fenêtre du garde-fou anti-boucle. Si deux échecs surviennent à moins de
// RELOAD_WINDOW_MS d'intervalle, le rechargement n'a rien résolu : on laisse
// l'erreur remonter plutôt que de boucler.
const RELOAD_AT_KEY = 'nn:chunk-reload-at';
const RELOAD_WINDOW_MS = 10_000;

/**
 * Indique si une erreur correspond à un échec de chargement de module dynamique.
 * Les messages diffèrent selon les navigateurs, d'où plusieurs motifs.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!message) return false;

  return (
    // Chrome / Edge
    message.includes('Failed to fetch dynamically imported module') ||
    // Firefox
    message.includes('error loading dynamically imported module') ||
    // Safari
    message.includes('Importing a module script failed') ||
    // Variante Vite sur l'échec de préchargement d'une feuille de style
    message.includes('Unable to preload CSS')
  );
}

/**
 * Lit l'horodatage du dernier rechargement forcé (0 si absent ou storage
 * indisponible, par exemple en navigation privée stricte).
 */
function readLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Recharge la page une seule fois pour récupérer les chunks à jour.
 *
 * @returns true si un rechargement a été déclenché ; false si un rechargement
 *          vient déjà d'avoir lieu (garde anti-boucle) : l'appelant doit alors
 *          laisser l'erreur remonter (ErrorBoundary).
 */
export function reloadForChunkError(): boolean {
  const now = Date.now();
  if (now - readLastReloadAt() < RELOAD_WINDOW_MS) {
    return false;
  }
  try {
    sessionStorage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    // Storage indisponible : on tente quand même le rechargement, sans garde-fou.
  }
  window.location.reload();
  return true;
}

/**
 * Enregistre le handler global de l'événement `vite:preloadError`, émis par
 * Vite quand un import dynamique échoue. À appeler une fois au démarrage.
 */
export function registerChunkErrorReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    // Si on déclenche le rechargement, on empêche Vite de relancer l'erreur
    // (inutile : la page va naviguer). Sinon (garde anti-boucle), on laisse
    // l'erreur remonter pour que l'ErrorBoundary propose un écran d'action.
    if (reloadForChunkError()) {
      event.preventDefault();
    }
  });
}
