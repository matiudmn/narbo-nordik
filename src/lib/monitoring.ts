import * as Sentry from '@sentry/react';

/**
 * Log local systématique + remontée Sentry si le SDK est initialisé
 * (Sentry.captureException est un no-op silencieux tant que Sentry.init
 * n'a pas été appelé, voir src/main.tsx).
 */
export function captureError(scope: string, error: unknown) {
  console.error(scope, error);
  Sentry.captureException(error, { tags: { scope } });
}
