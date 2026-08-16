import { describe, it, expect } from 'vitest';
import { computeRiskScores } from './risk';
import type { User } from '../types';

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
});
