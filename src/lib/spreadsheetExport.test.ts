import { describe, it, expect } from 'vitest';
import {
  blockIntensityLabel, formatBlocksForExport, resolveSessionGroups,
  buildSessionExportRows, toCsv, toCsvContent, exportFilename,
} from './spreadsheetExport';
import type { Session, SessionBlock, SessionValidation, User, Group } from '../types';

const block = (over: Partial<SessionBlock> = {}): SessionBlock => ({
  id: 'b1',
  type: 'travail',
  allure: 'vma',
  duration_seconds: 0,
  distance_meters: 400,
  repetitions: 8,
  rest_seconds: 90,
  rest_distance_meters: null,
  ...over,
});

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  date: '2026-05-12T18:30:00',
  title: 'Piste 8x400',
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
  created_at: '2026-05-01T00:00:00.000Z',
  ...over,
});

const validation = (over: Partial<SessionValidation> = {}): SessionValidation => ({
  id: 'v1',
  session_id: 's1',
  user_id: 'u1',
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
  created_at: '2026-05-12T20:00:00.000Z',
  ...over,
});

const athlete = (id: string, groupId: string | null): User => ({
  id,
  role: 'athlete',
  firstname: id,
  lastname: 'Test',
  vma: 15,
  vma_history: [],
  group_id: groupId,
  photo_url: null,
  is_public: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

const GROUPS: Group[] = [
  { id: 'g1', name: 'Essentiel' },
  { id: 'g2', name: 'Renforcé' },
];

// Mai 2026 en entier, bornes incluses.
const MAY = { start: new Date('2026-05-01T00:00:00'), end: new Date('2026-05-31T00:00:00') };

const buildInput = (over: Partial<Parameters<typeof buildSessionExportRows>[0]> = {}) => ({
  sessions: [] as Session[],
  validations: [] as SessionValidation[],
  users: [] as User[],
  groups: GROUPS,
  preparations: [],
  start: MAY.start,
  end: MAY.end,
  groupIds: null,
  ...over,
});

describe('blockIntensityLabel', () => {
  it('donne une plage de % VMA pour une zone à l allure', () => {
    expect(blockIntensityLabel(block({ allure: 'vma' }))).toBe('95-110% VMA');
    expect(blockIntensityLabel(block({ allure: 'aer' }))).toBe('50-60% VMA');
  });

  it('donne une cible d effort (et jamais de % VMA) pour la PMA en côte', () => {
    expect(blockIntensityLabel(block({ allure: 'pma' }))).toBe('≈ 90-95% FCmax · RPE 7-8');
  });

  it('respecte la cible d effort surchargée par le coach', () => {
    const b = block({ allure: 'pma', rpe_min: 6, rpe_max: 6, fcmax_min: 85, fcmax_max: 90 });
    expect(blockIntensityLabel(b)).toBe('≈ 85-90% FCmax · RPE 6');
  });
});

describe('formatBlocksForExport', () => {
  it('rend répétitions, distance, récupération et % VMA sur une ligne', () => {
    const blocks = [
      block({ id: 'b0', type: 'echauffement', allure: 'ef', repetitions: 1, distance_meters: null, duration_seconds: 1200 }),
      block({ id: 'b1' }),
    ];
    expect(formatBlocksForExport(blocks)).toBe(
      "Échauffement : 20' EF (55-70% VMA) | Travail : 8x400m VMA R=1'30 (95-110% VMA)"
    );
  });

  it('rend une chaîne vide sans blocs', () => {
    expect(formatBlocksForExport([])).toBe('');
  });
});

describe('resolveSessionGroups', () => {
  const groupIdByUserId = new Map<string, string | null>([
    ['u1', 'g1'], ['u2', 'g1'], ['u3', 'g2'], ['u4', null],
  ]);

  it('utilise group_id quand il est renseigné', () => {
    const resolved = resolveSessionGroups(session({ group_id: 'g2' }), [], groupIdByUserId);
    expect(resolved).toEqual({ groupIds: ['g2'], attribution: 'explicite' });
  });

  it('reconstitue le rattachement par les validations quand group_id est NULL', () => {
    const validations = [validation({ user_id: 'u1' }), validation({ id: 'v2', user_id: 'u3' })];
    const resolved = resolveSessionGroups(session(), validations, groupIdByUserId);
    expect(resolved.attribution).toBe('reconstituee');
    expect([...resolved.groupIds].sort()).toEqual(['g1', 'g2']);
  });

  it('compte aussi les séances manquées dans la reconstitution', () => {
    const validations = [validation({ user_id: 'u3', status: 'missed' })];
    expect(resolveSessionGroups(session(), validations, groupIdByUserId)).toEqual({
      groupIds: ['g2'], attribution: 'reconstituee',
    });
  });

  it('ignore les validateurs sans groupe', () => {
    const validations = [validation({ user_id: 'u4' })];
    expect(resolveSessionGroups(session(), validations, groupIdByUserId)).toEqual({
      groupIds: [], attribution: 'aucune',
    });
  });
});

describe('buildSessionExportRows', () => {
  it('ne garde que les séances de la période, bornes incluses', () => {
    const sessions = [
      session({ id: 'avant', date: '2026-04-30T18:30:00' }),
      session({ id: 'debut', date: '2026-05-01T08:00:00' }),
      session({ id: 'fin', date: '2026-05-31T21:00:00' }),
      session({ id: 'apres', date: '2026-06-01T08:00:00' }),
    ];
    const rows = buildSessionExportRows(buildInput({ sessions }));
    expect(rows.map(r => r.id)).toEqual(['debut', 'fin']);
  });

  it('exclut les séances personnelles des athlètes', () => {
    const sessions = [session({ id: 'club' }), session({ id: 'perso', is_personal: true })];
    expect(buildSessionExportRows(buildInput({ sessions })).map(r => r.id)).toEqual(['club']);
  });

  it('trie par date croissante', () => {
    const sessions = [
      session({ id: 'b', date: '2026-05-20T18:30:00' }),
      session({ id: 'a', date: '2026-05-05T18:30:00' }),
    ];
    expect(buildSessionExportRows(buildInput({ sessions })).map(r => r.id)).toEqual(['a', 'b']);
  });

  it('compte les validations faites par groupe, hors séances manquées', () => {
    const sessions = [session({ group_id: 'g1' })];
    const validations = [
      validation({ id: 'v1', user_id: 'u1' }),
      validation({ id: 'v2', user_id: 'u2' }),
      validation({ id: 'v3', user_id: 'u3' }),
      validation({ id: 'v4', user_id: 'u5', status: 'missed' }),
    ];
    const users = [athlete('u1', 'g1'), athlete('u2', 'g1'), athlete('u3', 'g2'), athlete('u5', 'g1')];
    const [row] = buildSessionExportRows(buildInput({ sessions, validations, users }));
    expect(row.validationsTotal).toBe(3);
    expect(row.validationsByGroup).toEqual({ g1: 2, g2: 1 });
    expect(row.validationsWithoutGroup).toBe(0);
  });

  it('isole les validations des athlètes sans groupe', () => {
    const sessions = [session({ group_id: 'g1' })];
    const validations = [validation({ id: 'v1', user_id: 'u1' }), validation({ id: 'v2', user_id: 'u4' })];
    const users = [athlete('u1', 'g1'), athlete('u4', null)];
    const [row] = buildSessionExportRows(buildInput({ sessions, validations, users }));
    expect(row.validationsTotal).toBe(2);
    expect(row.validationsByGroup).toEqual({ g1: 1 });
    expect(row.validationsWithoutGroup).toBe(1);
  });

  it('filtre sur le groupe explicite', () => {
    const sessions = [
      session({ id: 'g1-only', group_id: 'g1' }),
      session({ id: 'g2-only', group_id: 'g2' }),
    ];
    const rows = buildSessionExportRows(buildInput({ sessions, groupIds: ['g1'] }));
    expect(rows.map(r => r.id)).toEqual(['g1-only']);
  });

  it('filtre une séance à group_id NULL sur son rattachement reconstitué', () => {
    const sessions = [
      session({ id: 'ancienne-g2', date: '2026-05-04T18:30:00' }),
      session({ id: 'ancienne-g1', date: '2026-05-06T18:30:00' }),
    ];
    const validations = [
      validation({ id: 'v1', session_id: 'ancienne-g2', user_id: 'u3' }),
      validation({ id: 'v2', session_id: 'ancienne-g1', user_id: 'u1' }),
    ];
    const users = [athlete('u1', 'g1'), athlete('u3', 'g2')];
    const rows = buildSessionExportRows(buildInput({ sessions, validations, users, groupIds: ['g2'] }));
    expect(rows.map(r => r.id)).toEqual(['ancienne-g2']);
    expect(rows[0].groupLabel).toBe('Renforcé (reconstitué)');
    expect(rows[0].attribution).toBe('reconstituee');
  });

  it('garde les séances sans rattachement déductible quel que soit le filtre', () => {
    const sessions = [session({ id: 'pour-tous' })];
    const rows = buildSessionExportRows(buildInput({ sessions, groupIds: ['g1'] }));
    expect(rows.map(r => r.id)).toEqual(['pour-tous']);
    expect(rows[0].groupLabel).toBe('Tous');
    expect(rows[0].attribution).toBe('aucune');
  });

  it('formate date, type et contenu pour la feuille', () => {
    const sessions = [session({
      date: '2026-05-12T18:30:00',
      session_type: 'sortie_longue',
      description: 'Boucle du Moujan',
      blocks: [block({ type: 'echauffement', allure: 'ef', repetitions: 1, distance_meters: null, duration_seconds: 1200 })],
    })];
    const [row] = buildSessionExportRows(buildInput({ sessions }));
    expect(row.date).toBe('12/05/2026');
    expect(row.type).toBe('Sortie longue');
    expect(row.description).toBe('Boucle du Moujan');
    expect(row.content).toBe("Échauffement : 20' EF (55-70% VMA)");
  });
});

describe('toCsv', () => {
  it('préfixe un BOM UTF-8 et sépare par des point-virgules en CRLF', () => {
    const csv = toCsv(['Date', 'Titre'], [['12/05/2026', 'Piste']]);
    expect(csv).toBe('\uFEFFDate;Titre\r\n12/05/2026;Piste\r\n');
  });

  it('ne met des guillemets que si nécessaire, pour que les nombres restent des nombres', () => {
    const csv = toCsv(['a', 'b', 'c'], [['sans virgule', 3, 'avec ; séparateur']]);
    expect(csv).toContain('sans virgule;3;"avec ; séparateur"');
  });

  it('double les guillemets internes et préserve les retours à la ligne', () => {
    const csv = toCsv(['a'], [['il a dit "ok"\nligne 2']]);
    expect(csv).toContain('"il a dit ""ok""\nligne 2"');
  });
});

describe('toCsvContent', () => {
  const rows = [{
    id: 's1',
    date: '12/05/2026',
    title: 'Piste 8x400',
    type: 'Entraînement',
    groupLabel: 'Essentiel',
    attribution: 'explicite' as const,
    description: '',
    content: "Travail : 8x400m VMA R=1'30 (95-110% VMA)",
    validationsTotal: 3,
    validationsByGroup: { g1: 2 },
    validationsWithoutGroup: 0,
  }];

  it('émet une colonne de validations par groupe exporté', () => {
    const [header, line] = toCsvContent(rows, GROUPS).split('\r\n');
    expect(header).toBe(
      '\uFEFFDate;Titre;Type;Groupe;Description;Contenu;Validations (total);Val. Essentiel;Val. Renforcé'
    );
    expect(line.endsWith(';3;2;0')).toBe(true);
  });

  it("n'ajoute la colonne « sans groupe » que si elle porte une valeur", () => {
    expect(toCsvContent(rows, GROUPS)).not.toContain('Val. sans groupe');
    const withOrphan = [{ ...rows[0], validationsWithoutGroup: 1 }];
    expect(toCsvContent(withOrphan, GROUPS)).toContain('Val. sans groupe');
  });
});

describe('exportFilename', () => {
  it('nomme le fichier par les bornes de la période', () => {
    expect(exportFilename(new Date('2026-05-01T00:00:00'), new Date('2026-05-31T00:00:00')))
      .toBe('narbo-nordik-seances_2026-05-01_2026-05-31.csv');
  });
});
