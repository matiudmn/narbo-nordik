import { describe, it, expect } from 'vitest';
import { computeRiskScores } from './risk';
import type { User, SessionValidation } from '../types';

const now = new Date('2026-11-15T12:00:00');

function athlete(id: string, createdAt: string): User {
  return {
    id,
    firstname: id,
    lastname: id,
    email: `${id}@test.fr`,
    role: 'athlete',
    group_id: 'g1',
    vma: null,
    vma_history: [],
    photo_url: null,
    is_public: true,
    created_at: createdAt,
  };
}

describe('computeRiskScores', () => {
  it('ne signale pas un nouvel inscrit (moins de 21 jours) sans validation', () => {
    const [score] = computeRiskScores([athlete('geraldine', '2026-11-05T00:00:00Z')], [], [], now);
    expect(score.band).toBe('ok');
    expect(score.reasons).toEqual([]);
  });

  it('signale un athlète installé qui n\'a jamais rien validé', () => {
    const [score] = computeRiskScores([athlete('ancien', '2026-01-05T00:00:00Z')], [], [], now);
    expect(score.band).toBe('risque');
    expect(score.reasons).toContain('Aucune séance validée');
  });

  it('ignore le motif et les sensations d\'une séance déclarée non faite', () => {
    const missed = validation('v1', 'ancien', 'missed', {
      feedback: 'pas pu venir',
      sensations: 'mauvaises',
      created_at: '2026-11-13T00:00:00Z',
    });
    const [score] = computeRiskScores([athlete('ancien', '2026-01-05T00:00:00Z')], [], [missed], now);
    // Le motif d'une séance manquée n'est pas un signal d'engagement :
    // la fenêtre sans feedback reste bornée à l'arrivée, pas au motif d'hier.
    expect(score.factors.daysWithoutFeedback).toBeGreaterThan(60);
    expect(score.factors.pctNegativeSensations30d).toBe(0);
  });

  it('compte le feedback et les sensations d\'une séance faite', () => {
    const done = validation('v2', 'ancien', 'done', {
      feedback: 'bonne séance',
      sensations: 'mauvaises',
      created_at: '2026-11-13T00:00:00Z',
    });
    const [score] = computeRiskScores([athlete('ancien', '2026-01-05T00:00:00Z')], [], [done], now);
    expect(score.factors.daysWithoutFeedback).toBe(2);
    expect(score.factors.pctNegativeSensations30d).toBe(1);
  });
});

function validation(
  id: string,
  userId: string,
  status: SessionValidation['status'],
  extra: Partial<SessionValidation>
): SessionValidation {
  return {
    id,
    session_id: 's-inconnue',
    user_id: userId,
    status,
    feedback: null,
    attachment_path: null,
    attachment_type: null,
    objective_reached: null,
    sensations: null,
    distance_m: null,
    duration_s: null,
    elevation_m: null,
    avg_hr: null,
    max_hr: null,
    avg_cadence: null,
    metrics_source: null,
    rpe: null,
    created_at: '2026-11-13T00:00:00Z',
    ...extra,
  };
}
