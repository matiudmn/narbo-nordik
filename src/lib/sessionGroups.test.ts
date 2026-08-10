import { describe, it, expect } from 'vitest';
import { computeSessionParticipation, sumParticipationByGroup, NO_GROUP_KEY } from './sessionGroups';
import type { Session, SessionValidation, SessionStatus } from '../types';

function session(over: Partial<Session>): Session {
  return {
    id: 's1',
    date: '2026-03-10T18:30:00Z',
    title: 'Fractionné',
    session_type: 'entrainement',
    terrain_options: [],
    location: null,
    location_url: null,
    description: null,
    group_id: null,
    preparation_id: null,
    target_distance: null,
    vma_percent_min: null,
    vma_percent_max: null,
    blocks: [],
    is_personal: false,
    created_by: 'coach',
    created_at: '2026-03-01T00:00:00Z',
    ...over,
  };
}

function validation(sessionId: string, userId: string, status: SessionStatus = 'done'): SessionValidation {
  return {
    id: `${sessionId}-${userId}`,
    session_id: sessionId,
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
    created_at: '2026-03-10T20:00:00Z',
  };
}

// Trois athlètes, un par groupe + un sans groupe.
const USERS = [
  { id: 'a-ess', group_id: 'g-essentiel' },
  { id: 'a-int', group_id: 'g-intermediaire' },
  { id: 'a-ren', group_id: 'g-renforce' },
  { id: 'a-sans', group_id: null },
];

describe('computeSessionParticipation', () => {
  it('déduit les groupes des validations quand group_id est NULL (séances < mai 2026)', () => {
    const s = session({ id: 'mars', group_id: null });
    const [row] = computeSessionParticipation(
      [s],
      [validation('mars', 'a-ren'), validation('mars', 'a-int')],
      USERS,
    );

    expect(row.doneByGroup).toEqual({ 'g-renforce': 1, 'g-intermediaire': 1 });
    expect(row.doneTotal).toBe(2);
    expect(row.groupIds.sort()).toEqual(['g-intermediaire', 'g-renforce']);
    expect(row.groupsInferred).toBe(true);
  });

  it('garde group_id comme audience quand il est renseigné, même si un autre groupe a validé', () => {
    const s = session({ id: 'mai', group_id: 'g-renforce' });
    const [row] = computeSessionParticipation(
      [s],
      [validation('mai', 'a-ren'), validation('mai', 'a-int')],
      USERS,
    );

    expect(row.groupIds).toEqual(['g-renforce']);
    expect(row.groupsInferred).toBe(false);
    // La participation reste celle du terrain, pas celle de l'audience posée.
    expect(row.doneByGroup).toEqual({ 'g-renforce': 1, 'g-intermediaire': 1 });
  });

  it('ne compte que les validations `done`', () => {
    const [row] = computeSessionParticipation(
      [session({ id: 'mars' })],
      [
        validation('mars', 'a-ren', 'done'),
        validation('mars', 'a-int', 'missed'),
        validation('mars', 'a-ess', 'pending'),
      ],
      USERS,
    );

    expect(row.doneTotal).toBe(1);
    expect(row.doneByGroup).toEqual({ 'g-renforce': 1 });
  });

  it('range les athlètes sans groupe (ou inconnus) sous NO_GROUP_KEY, hors groupes déduits', () => {
    const [row] = computeSessionParticipation(
      [session({ id: 'mars' })],
      [validation('mars', 'a-sans'), validation('mars', 'compte-supprime')],
      USERS,
    );

    expect(row.doneByGroup).toEqual({ [NO_GROUP_KEY]: 2 });
    expect(row.groupIds).toEqual([]);
    expect(row.groupsInferred).toBe(false);
  });

  it('ignore les validations des autres séances', () => {
    const rows = computeSessionParticipation(
      [session({ id: 's1' }), session({ id: 's2' })],
      [validation('s1', 'a-ren'), validation('s2', 'a-ess'), validation('s2', 'a-int')],
      USERS,
    );

    expect(rows[0].doneTotal).toBe(1);
    expect(rows[1].doneTotal).toBe(2);
  });
});

describe('sumParticipationByGroup', () => {
  it('additionne les participations de toutes les séances du mois', () => {
    const rows = computeSessionParticipation(
      [session({ id: 's1' }), session({ id: 's2' })],
      [
        validation('s1', 'a-ren'),
        validation('s1', 'a-int'),
        validation('s2', 'a-ren'),
        validation('s2', 'a-sans'),
      ],
      USERS,
    );

    expect(sumParticipationByGroup(rows)).toEqual({
      'g-renforce': 2,
      'g-intermediaire': 1,
      [NO_GROUP_KEY]: 1,
    });
  });

  it('renvoie un objet vide sans séance', () => {
    expect(sumParticipationByGroup([])).toEqual({});
  });
});
