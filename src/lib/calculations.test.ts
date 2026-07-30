import { describe, it, expect } from 'vitest';
import {
  pacePerKm, isEffortZone, blockEffortLabel, DEFAULT_ALLURE_ZONES, calculateBlockPace,
  getSessionCode, estimateBlockEffortSeconds, calculateSessionTotalSeconds,
} from './calculations';
import type { SessionBlock, AllureZone, Session } from '../types';

const mkBlock = (allure: AllureZone, o: Partial<SessionBlock> = {}): SessionBlock => ({
  id: 'b', type: 'travail', allure, duration_seconds: 0, distance_meters: 400,
  repetitions: 8, rest_seconds: 0, rest_distance_meters: 400, ...o,
});

const mkSession = (o: Partial<Session> = {}): Session => ({
  id: 's', date: '2026-06-15', title: 'Séance', session_type: 'entrainement',
  terrain_options: [], location: null, location_url: null, description: null,
  group_id: null, preparation_id: null, target_distance: null,
  vma_percent_min: null, vma_percent_max: null, blocks: [], is_personal: false,
  created_by: 'coach', created_at: '2026-06-01', ...o,
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

describe('getSessionCode (numerotation ISO week/year)', () => {
  it('regroupe correctement une paire a cheval sur 28/12/2026 (S53 2026) et 01/01/2027 (aussi S53 annee ISO 2026)', () => {
    // 28/12/2026 = lundi, semaine ISO 53 de l'annee ISO 2026.
    // 01/01/2027 = vendredi, appartient encore a la semaine ISO 53 de l'annee ISO 2026
    // (getFullYear() vaudrait 2026 et 2027 respectivement : sans getISOWeekYear,
    // les deux séances sont numerotees comme seules dans leur "semaine/annee").
    const s1 = mkSession({ id: 'a', date: '2026-12-28' });
    const s2 = mkSession({ id: 'b', date: '2027-01-01' });
    const all = [s1, s2];
    expect(getSessionCode(s1, all)).toBe('S53-1/2');
    expect(getSessionCode(s2, all)).toBe('S53-2/2');
  });

  it('cas nominal en milieu d\'annee : deux seances la meme semaine sont numerotees 1/2 et 2/2', () => {
    // 15/06/2026 (lundi) et 17/06/2026 (mercredi) : meme semaine ISO, meme annee.
    const s1 = mkSession({ id: 'a', date: '2026-06-15' });
    const s2 = mkSession({ id: 'b', date: '2026-06-17' });
    const all = [s1, s2];
    expect(getSessionCode(s1, all)).toBe('S25-1/2');
    expect(getSessionCode(s2, all)).toBe('S25-2/2');
  });

  it('passage semaine 52/53 -> semaine 1 : deux seances de semaines ISO differentes ne sont jamais groupees ensemble', () => {
    // 30/12/2025 (mercredi) = semaine ISO 1 de l'annee ISO 2026 (getFullYear() = 2025 !).
    // 05/01/2026 (lundi) = semaine ISO 2 de 2026.
    const s1 = mkSession({ id: 'a', date: '2025-12-30' });
    const s2 = mkSession({ id: 'b', date: '2026-01-05' });
    const all = [s1, s2];
    expect(getSessionCode(s1, all)).toBe('S1-1/1');
    expect(getSessionCode(s2, all)).toBe('S2-1/1');
  });
});

describe('estimateBlockEffortSeconds / calculateSessionTotalSeconds (bloc distance sans VMA)', () => {
  it('avec VMA : estime la duree du bloc a partir de la zone d\'allure', () => {
    const block = mkBlock('ef', { duration_seconds: 0, distance_meters: 1000, repetitions: 1, rest_seconds: 0, rest_distance_meters: null });
    const seconds = estimateBlockEffortSeconds(block, 15);
    expect(seconds).toBeGreaterThan(0);
  });

  it('sans VMA : un bloc distance ne doit plus tomber a 0 (allure de repli)', () => {
    const block = mkBlock('ef', { duration_seconds: 0, distance_meters: 1000, repetitions: 1, rest_seconds: 0, rest_distance_meters: null });
    const seconds = estimateBlockEffortSeconds(block, undefined);
    expect(seconds).toBeGreaterThan(0);
  });

  it('calculateSessionTotalSeconds : une seance avec un bloc distance et sans VMA renvoie une duree totale non nulle', () => {
    const block = mkBlock('ef', { duration_seconds: 0, distance_meters: 1000, repetitions: 1, rest_seconds: 0, rest_distance_meters: null });
    const total = calculateSessionTotalSeconds([block], undefined);
    expect(total).toBeGreaterThan(0);
  });
});
