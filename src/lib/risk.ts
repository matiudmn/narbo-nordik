/**
 * Score de risque athlète — combine 3 facteurs pour signaler au coach
 * les athlètes à rappeler en priorité.
 *
 * Formule :
 *   score = 0.4 × normalizeDays(joursDepuisDerniereValidation, [7,45])
 *         + 0.3 × pctSensationsNegatives30j
 *         + 0.3 × normalizeDays(joursSansFeedback, [14,60])
 *
 * Bandes :
 *   0-39   → 'ok'       (aucune action)
 *   40-64  → 'attention' (à surveiller)
 *   65-100 → 'risque'    (à rappeler en priorité)
 */

import { differenceInDays } from 'date-fns';
import type { User, Session, SessionValidation } from '../types';

export type RiskBand = 'ok' | 'attention' | 'risque';

export interface RiskScore {
  athlete: User;
  score: number;             // 0-100
  band: RiskBand;
  factors: {
    daysSinceLastValidation: number;
    daysWithoutFeedback: number;
    pctNegativeSensations30d: number;
  };
  /** Top facteurs lisibles pour affichage UI */
  reasons: string[];
}

/** Normalise un nombre de jours dans [lo, hi] vers [0, 1]. */
function normalizeDays(days: number, [lo, hi]: [number, number]): number {
  if (days === Infinity) return 1;
  if (days <= lo) return 0;
  if (days >= hi) return 1;
  return (days - lo) / (hi - lo);
}

export function computeRiskScores(
  athletes: User[],
  sessions: Session[],
  validations: SessionValidation[],
  now: Date = new Date()
): RiskScore[] {
  // Index : session_id → date pour lookup rapide
  const sessionDate = new Map(sessions.map((s) => [s.id, new Date(s.date)]));

  // Pour chaque athlète, calculer ses 3 facteurs
  const scores: RiskScore[] = athletes.map((athlete) => {
    const myValidations = validations.filter((v) => v.user_id === athlete.id);

    // Dernière validation "done" — quelle date de séance ?
    let lastDoneDate: Date | null = null;
    for (const v of myValidations) {
      if (v.status !== 'done') continue;
      const d = sessionDate.get(v.session_id);
      if (!d) continue;
      if (!lastDoneDate || d > lastDoneDate) lastDoneDate = d;
    }
    const daysSinceLastValidation = lastDoneDate
      ? differenceInDays(now, lastDoneDate)
      : Infinity;

    // Jours sans feedback texte (sensations + feedback texte combinés)
    let lastFeedbackDate: Date | null = null;
    for (const v of myValidations) {
      const hasFeedback = Boolean(v.feedback) || Boolean(v.sensations);
      if (!hasFeedback) continue;
      const created = new Date(v.created_at);
      if (!lastFeedbackDate || created > lastFeedbackDate) lastFeedbackDate = created;
    }
    const daysWithoutFeedback = lastFeedbackDate
      ? differenceInDays(now, lastFeedbackDate)
      : Infinity;

    // % sensations négatives sur les 30 derniers jours
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = myValidations.filter(
      (v) => v.sensations && new Date(v.created_at) >= thirtyDaysAgo
    );
    const negative = recent.filter((v) => v.sensations === 'mauvaises').length;
    const pctNegativeSensations30d = recent.length > 0 ? negative / recent.length : 0;

    // Score 0-100
    const raw =
      0.4 * normalizeDays(daysSinceLastValidation, [7, 45]) +
      0.3 * pctNegativeSensations30d +
      0.3 * normalizeDays(daysWithoutFeedback, [14, 60]);
    const score = Math.round(raw * 100);

    // Band
    const band: RiskBand = score >= 65 ? 'risque' : score >= 40 ? 'attention' : 'ok';

    // Raisons lisibles (top 3)
    const reasons: string[] = [];
    if (daysSinceLastValidation === Infinity) {
      reasons.push('Aucune séance validée');
    } else if (daysSinceLastValidation >= 21) {
      reasons.push(`Inactif depuis ${daysSinceLastValidation} jours`);
    } else if (daysSinceLastValidation >= 10) {
      reasons.push(`${daysSinceLastValidation} jours sans séance validée`);
    }
    if (pctNegativeSensations30d >= 0.5 && recent.length >= 2) {
      reasons.push(`${Math.round(pctNegativeSensations30d * 100)}% sensations négatives (30j)`);
    }
    if (daysWithoutFeedback >= 30 && daysWithoutFeedback !== Infinity) {
      reasons.push(`Pas de feedback depuis ${daysWithoutFeedback} jours`);
    } else if (daysWithoutFeedback === Infinity) {
      reasons.push('Jamais de feedback');
    }

    return {
      athlete,
      score,
      band,
      factors: {
        daysSinceLastValidation,
        daysWithoutFeedback,
        pctNegativeSensations30d,
      },
      reasons: reasons.slice(0, 3),
    };
  });

  // Tri décroissant
  return scores.sort((a, b) => b.score - a.score);
}

/** Helper pour obtenir uniquement le top N à risque (band ≥ 'attention'). */
export function topRiskAthletes(scores: RiskScore[], n: number = 5): RiskScore[] {
  return scores.filter((s) => s.band !== 'ok').slice(0, n);
}
