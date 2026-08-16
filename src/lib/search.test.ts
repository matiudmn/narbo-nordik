import { describe, it, expect } from 'vitest';
import {
  normalize, matchTokens, scoreMatch,
  buildSearchIndex, runSearch, applyAiFilters, sanitizeAiFilters, hasAnyFilter, isAthleteVisible,
  type SearchData, type SearchViewer,
} from './search';
import type {
  User, Session, SessionValidation, RaceResult, Group, NotificationPreferences,
} from '../types';

const NP: NotificationPreferences = {
  new_session: { in_app: true, email: true },
  palmares: { in_app: true, email: true },
  vma_update: { in_app: true, email: false },
  weekly_digest: { email: true },
};

function makeUser(o: Partial<User> & { id: string; firstname: string; lastname: string }): User {
  return {
    role: 'athlete', email: `${o.id}@test.fr`, vma: null, vma_history: [], group_id: null,
    phone: null, birth_date: null, license_number: null, photo_url: null, is_public: true,
    is_super_admin: false,
    notification_preferences: NP, created_at: '2026-01-01T00:00:00Z', ...o,
  };
}

function makeSession(o: Partial<Session> & { id: string; title: string }): Session {
  return {
    date: '2026-06-10T18:00:00Z', session_type: 'entrainement', terrain_options: [],
    location: null, location_url: null, description: null, group_id: null, preparation_id: null,
    target_distance: null, vma_percent_min: null, vma_percent_max: null, blocks: [],
    is_personal: false, created_by: 'coach', created_at: '2026-01-01T00:00:00Z', ...o,
  };
}

function makeValidation(o: Partial<SessionValidation> & { id: string; session_id: string; user_id: string }): SessionValidation {
  return {
    status: 'done', feedback: null, attachment_path: null, attachment_type: null,
    objective_reached: null, sensations: null, distance_m: null, duration_s: null,
    elevation_m: null, avg_hr: null, max_hr: null, avg_cadence: null, metrics_source: null,
    rpe: null, created_at: '2026-06-10T19:00:00Z', ...o,
  };
}

function makeRace(o: Partial<RaceResult> & { id: string; user_id: string; race_name: string }): RaceResult {
  return {
    race_type: 'route', distance_km: 42.2, date: '2026-04-01', time_duration: '3:30:00',
    is_label: false, comment: null, created_at: '2026-04-02T00:00:00Z', ...o,
  };
}

// --- Fixture club ---
const G1: Group = { id: 'g1', name: 'Compétition' };
const coach = makeUser({ id: 'coach', firstname: 'David', lastname: 'Nunez', role: 'coach' });
const amelie = makeUser({ id: 'a1', firstname: 'Amélie', lastname: 'Dupont', vma: 16.5, group_id: 'g1' });
const herve = makeUser({ id: 'a2', firstname: 'Hervé', lastname: 'Martin', vma: 14, group_id: 'g1' });
const damien = makeUser({ id: 'a3', firstname: 'Damien', lastname: 'Prive', vma: 15, group_id: 'g1', is_public: false });

const sGroup = makeSession({ id: 's_grp', title: 'Fractionné au seuil', group_id: 'g1', blocks: [
  { id: 'b1', type: 'travail', allure: 'sv1', duration_seconds: 600, distance_meters: null, repetitions: 4, rest_seconds: 60, rest_distance_meters: null },
] });
const sPersoHerve = makeSession({ id: 's_perso', title: 'Footing perso confidentiel', is_personal: true, created_by: 'a2' });

const vAmelie = makeValidation({ id: 'v_a1', session_id: 's_grp', user_id: 'a1', distance_m: 8000, duration_s: 2400 });
const vHerve = makeValidation({ id: 'v_a2', session_id: 's_grp', user_id: 'a2', distance_m: 12000, duration_s: 3600 });

const rAmelie = makeRace({ id: 'r1', user_id: 'a1', race_name: 'Marathon de Paris' });

const data: SearchData = {
  users: [coach, amelie, herve, damien], sessions: [sGroup, sPersoHerve],
  validations: [vAmelie, vHerve], raceResults: [rAmelie],
  preparations: [], groups: [G1], userPreparations: [],
};

const coachViewer: SearchViewer = { id: 'coach', role: 'coach', group_id: null, isSuperAdmin: false };
const amelieViewer: SearchViewer = { id: 'a1', role: 'athlete', group_id: 'g1', isSuperAdmin: false };
const damienViewer: SearchViewer = { id: 'a3', role: 'athlete', group_id: 'g1', isSuperAdmin: false };

describe('normalize', () => {
  it('lowercases and strips accents', () => {
    expect(normalize('Hervé')).toBe('herve');
    expect(normalize('  ÀÉÎÔÛ Ça ')).toBe('aeiou ca');
  });
});

describe('matchTokens', () => {
  it('is accent-insensitive', () => {
    expect(matchTokens('Amélie Dupont', 'amelie')).toBe(true);
    expect(matchTokens('Hervé Martin', 'herve')).toBe(true);
  });
  it('matches multiple tokens in any order', () => {
    expect(matchTokens('Amélie Dupont', 'dupont ame')).toBe(true);
    expect(matchTokens('Amélie Dupont', 'xyz')).toBe(false);
  });
});

describe('scoreMatch', () => {
  it('ranks prefix above word-start above substring', () => {
    const prefix = scoreMatch('Amandine', 'ama');
    const wordStart = scoreMatch('Paul Amandine', 'ama');
    const substring = scoreMatch('Samanda', 'ama');
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(substring);
  });
});

describe('runSearch (coach)', () => {
  const index = buildSearchIndex(coachViewer, data);
  it('finds an athlete by accent-insensitive name', () => {
    const res = runSearch(index, 'herve');
    expect(res.some(r => r.kind === 'athlete' && r.id === 'a2')).toBe(true);
  });
  it('finds a session by intensity keyword (seuil)', () => {
    const res = runSearch(index, 'seuil');
    expect(res.some(r => r.kind === 'session' && r.id === 's_grp')).toBe(true);
  });
  it('offers an "Ouvrir la fiche" action on athletes', () => {
    const res = runSearch(index, 'amelie');
    const athlete = res.find(r => r.kind === 'athlete' && r.id === 'a1');
    expect(athlete?.action?.to).toBe('/coach/athlete/a1');
  });
});

describe('persona scope (security)', () => {
  it('an athlete cannot find another athlete personal session', () => {
    const index = buildSearchIndex(amelieViewer, data);
    const res = runSearch(index, 'confidentiel');
    expect(res.some(r => r.id === 's_perso')).toBe(false);
  });
  it('a coach can find any personal session', () => {
    const index = buildSearchIndex(coachViewer, data);
    const res = runSearch(index, 'confidentiel');
    expect(res.some(r => r.id === 's_perso')).toBe(true);
  });
  it('an athlete only sees their own validations via AI filters', () => {
    const res = applyAiFilters(amelieViewer, data, sanitizeAiFilters({ entity: 'validation', distance_km_min: 5 }));
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('v_a1');
  });
  it('a coach sees all validations matching a distance filter', () => {
    const res = applyAiFilters(coachViewer, data, sanitizeAiFilters({ entity: 'validation', distance_km_min: 10 }));
    expect(res.map(r => r.id)).toEqual(['v_a2']);
  });
});

describe('is_public gating (annuaire et recherche)', () => {
  it('isAthleteVisible: un coach ou le super-admin voient tout le monde', () => {
    expect(isAthleteVisible(damien, coachViewer)).toBe(true);
    expect(isAthleteVisible(damien, { id: 'x', role: 'athlete', isSuperAdmin: true })).toBe(true);
  });
  it('isAthleteVisible: un athlete ne voit pas un profil is_public=false autre que le sien', () => {
    expect(isAthleteVisible(damien, amelieViewer)).toBe(false);
  });
  it('isAthleteVisible: un athlete se voit toujours lui-meme, meme is_public=false', () => {
    expect(isAthleteVisible(damien, damienViewer)).toBe(true);
  });
  it('isAthleteVisible: un profil is_public=true reste visible pour les autres athletes', () => {
    const herveViewer: SearchViewer = { id: 'a2', role: 'athlete', group_id: 'g1', isSuperAdmin: false };
    expect(isAthleteVisible(amelie, herveViewer)).toBe(true);
  });

  it("un athlete ne trouve pas dans l'annuaire/la recherche un membre is_public=false", () => {
    const index = buildSearchIndex(amelieViewer, data);
    expect(index.some(item => item.base.kind === 'athlete' && item.base.id === 'a3')).toBe(false);
  });
  it('ce meme membre is_public=false se trouve lui-meme dans sa propre recherche', () => {
    const index = buildSearchIndex(damienViewer, data);
    expect(index.some(item => item.base.kind === 'athlete' && item.base.id === 'a3')).toBe(true);
  });
  it('un coach trouve un membre is_public=false dans la recherche', () => {
    const index = buildSearchIndex(coachViewer, data);
    expect(index.some(item => item.base.kind === 'athlete' && item.base.id === 'a3')).toBe(true);
  });
  it('applyAiFilters (entite athlete) respecte le meme gating pour les autres athletes', () => {
    const res = applyAiFilters(amelieViewer, data, sanitizeAiFilters({ entity: 'athlete' }));
    expect(res.some(r => r.id === 'a3')).toBe(false);
  });
});

describe('sanitizeAiFilters', () => {
  it('keeps valid values and rejects out-of-range / unknown', () => {
    const f = sanitizeAiFilters({
      entity: 'session', text: '  seuil  ', distance_km_min: 10, distance_km_max: 9999,
      vma_min: 'oops', status: 'bogus', date_from: '2026-06-01', date_to: 'nope', group_name: 'Perf',
    });
    expect(f.entity).toBe('session');
    expect(f.text).toBe('seuil');
    expect(f.distance_km_min).toBe(10);
    expect(f.distance_km_max).toBeNull(); // 9999 > 500
    expect(f.vma_min).toBeNull();
    expect(f.status).toBeNull();
    expect(f.date_from).toBe('2026-06-01');
    expect(f.date_to).toBeNull();
    expect(f.group_name).toBe('Perf');
    expect(hasAnyFilter(f)).toBe(true);
  });
  it('returns all-null for an empty object', () => {
    expect(hasAnyFilter(sanitizeAiFilters({}))).toBe(false);
  });
});
