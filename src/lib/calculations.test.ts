import { describe, it, expect } from 'vitest';
import { pacePerKm } from './calculations';

describe('pacePerKm', () => {
  it('retourne null si distance ou durée manquante ou nulle', () => {
    expect(pacePerKm(null, 1800)).toBeNull();
    expect(pacePerKm(5000, null)).toBeNull();
    expect(pacePerKm(0, 1800)).toBeNull();
    expect(pacePerKm(5000, 0)).toBeNull();
  });

  it('calcule une allure correcte', () => {
    // 10 km en 50 min = 5:00 /km
    expect(pacePerKm(10000, 3000)).toBe('5:00');
    // 5 km en 26 min = 5:12 /km
    expect(pacePerKm(5000, 1560)).toBe('5:12');
  });

  it('arrondit les secondes', () => {
    // 8200 m en 2440 s -> 297.56 s/km -> 4:58
    expect(pacePerKm(8200, 2440)).toBe('4:58');
  });
});
