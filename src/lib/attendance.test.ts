import { describe, it, expect } from 'vitest';
import { computeAttendance, computeClubParticipation, formatAttendance } from './attendance';
import type { Session, SessionValidation, UserPreparation } from '../types';

const d = (s: string) => new Date(s + 'T12:00:00');

function session(id: string, date: string, extra: Partial<Session> = {}): Session {
  return {
    id,
    date: d(date).toISOString(),
    title: id,
    session_type: 'entrainement',
    terrain_options: [],
    location: null,
    location_url: null,
    description: null,
    group_id: 'g1',
    preparation_id: null,
    target_distance: null,
    vma_percent_min: null,
    vma_percent_max: null,
    blocks: [],
    is_personal: false,
    created_by: 'coach',
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

function done(sessionId: string, userId = 'u1'): SessionValidation {
  return {
    id: `${sessionId}-${userId}`,
    session_id: sessionId,
    user_id: userId,
    status: 'done',
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
    created_at: '2026-01-01T00:00:00Z',
  };
}

const range = { start: d('2026-09-01'), end: d('2027-08-31') };
const now = d('2026-11-15');

describe('computeAttendance', () => {
  it('ignore les séances antérieures à l\'arrivée de l\'athlète', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-11-01T10:00:00Z' };
    const sessions = [
      session('s1', '2026-09-10'),
      session('s2', '2026-10-10'),
      session('s3', '2026-11-05'),
      session('s4', '2026-11-12'),
    ];
    const r = computeAttendance(user, sessions, [done('s4')], [], range, now);
    expect(r).toEqual({ done: 1, total: 2, rate: 50 });
  });

  it('compte la séance du jour d\'arrivée même si le compte est créé plus tard dans la journée', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-11-01T18:00:00Z' };
    const r = computeAttendance(user, [session('s1', '2026-11-01')], [done('s1')], [], range, now);
    expect(r).toEqual({ done: 1, total: 1, rate: 100 });
  });

  it('ne compte pas les séances à venir', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-08-01T00:00:00Z' };
    const sessions = [session('s1', '2026-11-10'), session('s2', '2026-11-20')];
    const r = computeAttendance(user, sessions, [done('s1')], [], range, now);
    expect(r).toEqual({ done: 1, total: 1, rate: 100 });
  });

  it('inclut la séance du jour même', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-08-01T00:00:00Z' };
    const sessions = [session('s1', '2026-11-15')];
    expect(computeAttendance(user, sessions, [], [], range, now).total).toBe(1);
  });

  it('exclut les séances perso du ratio', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-08-01T00:00:00Z' };
    const sessions = [
      session('s1', '2026-11-10'),
      session('p1', '2026-11-11', { is_personal: true, created_by: 'u1', group_id: null }),
    ];
    const r = computeAttendance(user, sessions, [done('p1')], [], range, now);
    expect(r).toEqual({ done: 0, total: 1, rate: 0 });
  });

  it('retourne rate null quand rien n\'est à compter', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-11-14T00:00:00Z' };
    const r = computeAttendance(user, [session('s1', '2026-11-10')], [], [], range, now);
    expect(r).toEqual({ done: 0, total: 0, rate: null });
    expect(formatAttendance(r)).toBe('-');
  });

  it('respecte la règle prépa stricte (seule la prépa compte)', () => {
    const user = { id: 'u1', group_id: 'g1', created_at: '2026-08-01T00:00:00Z' };
    const sessions = [
      session('s1', '2026-11-10'),
      session('prep1', '2026-11-11', { group_id: null, preparation_id: 'prepA' }),
    ];
    const r = computeAttendance(user, sessions, [done('prep1')], ['prepA'], range, now);
    expect(r).toEqual({ done: 1, total: 1, rate: 100 });
    expect(formatAttendance(r)).toBe('1/1');
  });
});

describe('computeClubParticipation', () => {
  const membre = (id: string, group_id: string | null) => ({
    id,
    group_id,
    created_at: '2026-09-01T00:00:00Z',
  });
  const inscrit = (user_id: string, preparation_id: string): UserPreparation => ({
    id: `${user_id}-${preparation_id}`,
    user_id,
    preparation_id,
  });

  it('ne compte une séance de prépa que pour ses inscrits, pas pour tout le club', () => {
    // Régression du 31/08/2026 : une séance de prépa a group_id null, et la page
    // Club comptait alors TOUS les membres au dénominateur.
    const membres = [membre('u1', 'g1'), membre('u2', 'g1'), membre('u3', 'g2')];
    const sessions = [session('prep1', '2026-11-10', { group_id: null, preparation_id: 'prepA' })];
    const r = computeClubParticipation(membres, sessions, [done('prep1', 'u1')], [inscrit('u1', 'prepA')], range, now);
    expect(r).toEqual({ done: 1, total: 1, rate: 100 });
  });

  it('compte une séance globale pour tous les membres', () => {
    const membres = [membre('u1', 'g1'), membre('u2', 'g2')];
    const sessions = [session('s1', '2026-11-10', { group_id: null })];
    const r = computeClubParticipation(membres, sessions, [done('s1', 'u1')], [], range, now);
    expect(r).toEqual({ done: 1, total: 2, rate: 50 });
  });

  it('ne compte une séance de groupe que pour les membres de ce groupe', () => {
    const membres = [membre('u1', 'g1'), membre('u2', 'g2')];
    const sessions = [session('s1', '2026-11-10', { group_id: 'g1' })];
    const r = computeClubParticipation(membres, sessions, [done('s1', 'u1')], [], range, now);
    expect(r).toEqual({ done: 1, total: 1, rate: 100 });
  });

  it('un membre en prépa ne compte pas sur le programme général du club', () => {
    const membres = [membre('u1', 'g1'), membre('u2', 'g1')];
    const sessions = [
      session('s1', '2026-11-10', { group_id: 'g1' }),
      session('prep1', '2026-11-11', { group_id: null, preparation_id: 'prepA' }),
    ];
    const r = computeClubParticipation(membres, sessions, [], [inscrit('u1', 'prepA')], range, now);
    // u1 n'est attendu que sur sa prépa, u2 seulement sur la séance de groupe.
    expect(r).toEqual({ done: 0, total: 2, rate: 0 });
  });

  it('rate null quand il n\'y a rien à compter', () => {
    const r = computeClubParticipation([membre('u1', 'g1')], [], [], [], range, now);
    expect(r).toEqual({ done: 0, total: 0, rate: null });
  });
});
