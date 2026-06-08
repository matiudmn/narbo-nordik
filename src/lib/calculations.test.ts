import { describe, it, expect } from 'vitest';
import { pacePerKm, isEffortZone, blockEffortLabel, DEFAULT_ALLURE_ZONES, calculateBlockPace } from './calculations';

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

  it("n'affiche jamais 60 secondes (arrondi à la minute)", () => {
    // 3000 m en 1079 s -> 359.67 s/km -> 6:00 (et non 5:60)
    expect(pacePerKm(3000, 1079)).toBe('6:00');
  });
});

describe('zone PMA (effort, sans allure)', () => {
  it('PMA est une zone connue avec un libellé', () => {
    expect(DEFAULT_ALLURE_ZONES.pma).toBeDefined();
    expect(DEFAULT_ALLURE_ZONES.pma.label).toBe('PMA');
  });

  it('isEffortZone vrai pour PMA, faux pour VMA et les autres', () => {
    expect(isEffortZone('pma')).toBe(true);
    expect(isEffortZone('vma')).toBe(false);
    expect(isEffortZone('ef')).toBe(false);
  });

  it('blockEffortLabel donne une cible FCmax/RPE pour PMA, null sinon', () => {
    const label = blockEffortLabel('pma');
    expect(label).toContain('FCmax');
    expect(label).toContain('RPE');
    expect(blockEffortLabel('vma')).toBeNull();
  });

  it('calculateBlockPace reste calculable pour PMA (usage interne, non affiché)', () => {
    // On garde une estimation interne pour la durée des séries ; l'UI ne l'affiche pas.
    const p = calculateBlockPace(18.5, 'pma');
    expect(p.speedMin).toBeGreaterThan(0);
    expect(p.speedMax).toBeGreaterThan(0);
  });
});
