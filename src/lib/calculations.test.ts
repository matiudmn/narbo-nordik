import { describe, it, expect } from 'vitest';
import { pacePerKm, isEffortZone, blockEffortLabel, DEFAULT_ALLURE_ZONES, calculateBlockPace } from './calculations';
import type { SessionBlock, AllureZone } from '../types';

const mkBlock = (allure: AllureZone, o: Partial<SessionBlock> = {}): SessionBlock => ({
  id: 'b', type: 'travail', allure, duration_seconds: 0, distance_meters: 400,
  repetitions: 8, rest_seconds: 0, rest_distance_meters: 400, ...o,
});

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

  it('blockEffortLabel : defaut adouci (RPE 7-8, FCmax 90-95) pour PMA, null sinon', () => {
    const label = blockEffortLabel(mkBlock('pma'));
    expect(label).toContain('FCmax');
    expect(label).toContain('RPE 7-8');
    expect(label).toContain('90-95');
    expect(label).not.toContain('10'); // jamais RPE 10 par defaut (retour David)
    expect(blockEffortLabel(mkBlock('vma'))).toBeNull();
  });

  it('blockEffortLabel : la cible est surchargeable par bloc (RPE/FCmax)', () => {
    const label = blockEffortLabel(mkBlock('pma', { rpe_min: 6, rpe_max: 6, fcmax_min: 85, fcmax_max: 90 }));
    expect(label).toContain('RPE 6'); // min === max -> valeur unique
    expect(label).not.toContain('RPE 6-6');
    expect(label).toContain('85-90');
  });

  it('calculateBlockPace reste calculable pour PMA (usage interne, non affiché)', () => {
    // On garde une estimation interne pour la durée des séries ; l'UI ne l'affiche pas.
    const p = calculateBlockPace(18.5, 'pma');
    expect(p.speedMin).toBeGreaterThan(0);
    expect(p.speedMax).toBeGreaterThan(0);
  });
});
