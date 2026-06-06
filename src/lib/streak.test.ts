import { describe, it, expect } from 'vitest';
import { computeWeeklyStreak } from './streak';

// midi local pour éviter tout effet de bord de fuseau
const d = (s: string) => new Date(s + 'T12:00:00');

describe('computeWeeklyStreak', () => {
  // Référence : samedi 6 juin 2026 (semaine ISO du lundi 1er juin).
  const today = d('2026-06-06');

  it('retourne 0 sans séance', () => {
    expect(computeWeeklyStreak([], today)).toBe(0);
  });

  it('compte les semaines consécutives depuis la semaine en cours', () => {
    const dates = [d('2026-06-03'), d('2026-05-28'), d('2026-05-20')];
    expect(computeWeeklyStreak(dates, today)).toBe(3);
  });

  it('ne casse pas la série si la semaine en cours est encore vide', () => {
    const dates = [d('2026-05-28'), d('2026-05-21')];
    expect(computeWeeklyStreak(dates, today)).toBe(2);
  });

  it("s'arrête au premier trou", () => {
    const dates = [d('2026-06-03'), d('2026-05-20')]; // saut de la semaine du 25 mai
    expect(computeWeeklyStreak(dates, today)).toBe(1);
  });

  it('plusieurs séances la même semaine comptent pour une', () => {
    const dates = [d('2026-06-02'), d('2026-06-04'), d('2026-06-05')];
    expect(computeWeeklyStreak(dates, today)).toBe(1);
  });
});
