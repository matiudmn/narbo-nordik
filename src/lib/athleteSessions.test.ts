import { describe, it, expect } from 'vitest';
import { filterSessionsForAthlete, getUserPrepIds } from './athleteSessions';
import type { Session, UserPreparation } from '../types';

// Utilisateur athlète de test, groupe "g1".
const ATHLETE = { id: 'u1', group_id: 'g1' };

// Fabrique de session minimale (les champs non pertinents au filtrage sont stubés).
function session(over: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-06-01T18:30:00Z',
    title: 'S',
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
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

describe('filterSessionsForAthlete — sans préparation active', () => {
  const sessions = [
    session({ id: 'grp', group_id: 'g1' }),          // séance de son groupe
    session({ id: 'other', group_id: 'g2' }),        // séance d'un autre groupe
    session({ id: 'global', group_id: null }),       // séance globale (tous)
    session({ id: 'perso', is_personal: true, created_by: 'u1' }), // sa séance perso
    session({ id: 'perso-autre', is_personal: true, created_by: 'u2' }), // perso d'un autre
  ];

  it('voit son groupe, les globales et ses persos ; pas les autres groupes ni les persos d\'autrui', () => {
    const visible = filterSessionsForAthlete(ATHLETE, sessions, []).map(f => f.session.id);
    expect(visible).toContain('grp');
    expect(visible).toContain('global');
    expect(visible).toContain('perso');
    expect(visible).not.toContain('other');
    expect(visible).not.toContain('perso-autre');
  });
});

describe('filterSessionsForAthlete — avec préparation active (fix Amandine)', () => {
  const prepIds = ['p1'];
  const sessions = [
    session({ id: 'grp', group_id: 'g1' }),                  // séance groupe → masquée
    session({ id: 'prep', preparation_id: 'p1' }),           // séance de SA prépa → visible
    session({ id: 'prep-autre', preparation_id: 'p2' }),     // prépa non souscrite → masquée
    session({ id: 'global', group_id: null }),               // globale → masquée en prépa (option b)
    session({ id: 'perso', is_personal: true, created_by: 'u1' }),
  ];

  it('masque tout le général (groupe ET globales), montre la prépa + persos', () => {
    // Décision David 06/2026 : la prépa est exclusive, le général disparaît.
    const r = filterSessionsForAthlete(ATHLETE, sessions, prepIds);
    const ids = r.map(f => f.session.id);
    expect(ids).toContain('prep');        // sa prépa
    expect(ids).toContain('perso');       // sa perso
    expect(ids).not.toContain('grp');     // groupe masqué
    expect(ids).not.toContain('global');  // globale masquée aussi (option b)
    expect(ids).not.toContain('prep-autre'); // prépa d'un autre athlète
  });

  it('avec includeGroupSessions, groupe ET globales réapparaissent en secondaire', () => {
    const r = filterSessionsForAthlete(ATHLETE, sessions, prepIds, { includeGroupSessions: true });
    const grp = r.find(f => f.session.id === 'grp');
    const global = r.find(f => f.session.id === 'global');
    expect(grp?.isSecondary).toBe(true);
    expect(global?.isSecondary).toBe(true);
  });
});

describe('filterSessionsForAthlete — athlète sans groupe', () => {
  const noGroup = { id: 'u9', group_id: null };
  const sessions = [
    session({ id: 'global', group_id: null }),
    session({ id: 'g1', group_id: 'g1' }),
  ];

  it('ne voit que les globales, jamais les séances d\'un groupe', () => {
    const ids = filterSessionsForAthlete(noGroup, sessions, []).map(f => f.session.id);
    expect(ids).toContain('global');
    expect(ids).not.toContain('g1');
  });
});

describe('getUserPrepIds', () => {
  it('extrait les preparation_id de l\'athlète', () => {
    const ups: UserPreparation[] = [
      { id: '1', user_id: 'u1', preparation_id: 'p1' },
      { id: '2', user_id: 'u1', preparation_id: 'p2' },
      { id: '3', user_id: 'u2', preparation_id: 'p3' },
    ];
    expect(getUserPrepIds('u1', ups).sort()).toEqual(['p1', 'p2']);
    expect(getUserPrepIds('u2', ups)).toEqual(['p3']);
    expect(getUserPrepIds('u3', ups)).toEqual([]);
  });
});
