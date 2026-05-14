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

  defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
  defaults.font.size = 12;
  defaults.color = '#475569'; // neutral-600

  // Tooltip — dark
  defaults.plugins.tooltip.backgroundColor = 'rgb(15 23 42 / 0.95)'; // neutral-900
  defaults.plugins.tooltip.titleColor = '#ffffff';
  defaults.plugins.tooltip.bodyColor = '#cbd5e1'; // neutral-300
  defaults.plugins.tooltip.borderColor = 'transparent';
  defaults.plugins.tooltip.padding = 10;
  defaults.plugins.tooltip.cornerRadius = 8;
  defaults.plugins.tooltip.titleFont = { weight: 'bold' as const, size: 13, family: defaults.font.family as string };
  defaults.plugins.tooltip.bodyFont = { size: 12, family: defaults.font.family as string };

  // Legend
  defaults.plugins.legend.labels.usePointStyle = true;
  defaults.plugins.legend.labels.padding = 12;
  defaults.plugins.legend.labels.boxWidth = 8;
  defaults.plugins.legend.labels.boxHeight = 8;

  // Grid color
  defaults.borderColor = '#e2e8f0'; // neutral-200

  // Sane defaults responsive
  defaults.responsive = true;
  defaults.maintainAspectRatio = false;
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
