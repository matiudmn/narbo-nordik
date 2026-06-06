/**
 * Theme global Chart.js — applique la palette + fonts Narbo Nordik
 * en une seule source de vérité.
 *
 * À appeler une fois au démarrage de l'app (main.tsx).
 */

import { Chart, defaults } from 'chart.js';

let applied = false;

export function applyChartTheme() {
  if (applied) return;
  applied = true;

  // Chaque set wrappé pour éviter de crasher tout l'init si une propriété
  // a changé entre versions Chart.js. Best-effort.
  const safe = (fn: () => void) => {
    try { fn(); } catch (e) { console.warn('[chartTheme]', e); }
  };

  safe(() => { defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif"; });
  safe(() => { defaults.font.size = 12; });
  safe(() => { defaults.color = '#475569'; });

  safe(() => {
    if (defaults.plugins?.tooltip) {
      defaults.plugins.tooltip.backgroundColor = 'rgb(15 23 42 / 0.95)';
      defaults.plugins.tooltip.titleColor = '#ffffff';
      defaults.plugins.tooltip.bodyColor = '#cbd5e1';
      defaults.plugins.tooltip.padding = 10;
      defaults.plugins.tooltip.cornerRadius = 8;
    }
  });

  safe(() => {
    if (defaults.plugins?.legend?.labels) {
      defaults.plugins.legend.labels.usePointStyle = true;
      defaults.plugins.legend.labels.padding = 12;
      defaults.plugins.legend.labels.boxWidth = 8;
      defaults.plugins.legend.labels.boxHeight = 8;
    }
  });

  safe(() => { defaults.responsive = true; });
  safe(() => { defaults.maintainAspectRatio = false; });
}

/** Palette utilitaire — pour les développeurs qui composent des charts manuellement */
export const CHART_COLORS = {
  primary: '#000000',
  accent: '#6CCBE6',
  accentSoft: 'rgba(108, 203, 230, 0.15)',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  neutral: '#94a3b8',
  // Session types
  sessionEntrainement: '#3b5bd9',
  sessionCourse: '#dc4a1e',
  sessionSortieLongue: '#16a34a',
  sessionRecuperation: '#64748b',
  sessionVelo: '#b45309',
  sessionMarche: '#7c3aed',
  sessionRenfo: '#be185d',
  sessionAer: '#0e7490',
} as const;

export type ChartColor = keyof typeof CHART_COLORS;

// Ensure Chart is exported for consumers that need it
export { Chart };
