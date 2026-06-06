import { describe, it, expect } from 'vitest';
import {
  parseDateRaw,
  classifyMacroType,
  detectFormat,
  resolveGroup,
  parseImport,
} from './importParser';
import type { Group } from '../types';

const GROUPS: Group[] = [
  { id: 'g-ess', name: 'Essentiel' },
  { id: 'g-ren', name: 'Renforcé' },
  { id: 'g-int', name: 'intermédiare' },
];

describe('parseDateRaw', () => {
  it('parse DD/MM avec année par défaut (régression bug timezone)', () => {
    // Bug trouvé en test Chrome : buildIsoDate comparait en UTC une date
    // construite en local → toutes les dates d'hiver (UTC+1) étaient rejetées.
    // 14/01 doit donner 2026-01-14, surtout PAS null.
    expect(parseDateRaw('14/01', 2026)).toBe('2026-01-14');
    expect(parseDateRaw('16/01', 2026)).toBe('2026-01-16');
    expect(parseDateRaw('01/01', 2026)).toBe('2026-01-01'); // bord d'année
    expect(parseDateRaw('31/12', 2026)).toBe('2026-12-31');
  });

  it('parse DD/MM/YYYY', () => {
    expect(parseDateRaw('14/01/2026', 2099)).toBe('2026-01-14');
  });

  it('parse une date ISO déjà formée', () => {
    expect(parseDateRaw('2025-12-15', 2026)).toBe('2025-12-15');
  });

  it('parse les dates françaises avec jour nommé', () => {
    expect(parseDateRaw('lundi 25 mai 2026', 2026)).toBe('2026-05-25');
    expect(parseDateRaw('dimanche 31 mai 2026', 2026)).toBe('2026-05-31');
    expect(parseDateRaw('25 mai 2026', 2026)).toBe('2026-05-25');
  });

  it('parse "25 mai" sans année avec defaultYear', () => {
    expect(parseDateRaw('25 mai', 2026)).toBe('2026-05-25');
  });

  it('rejette les dates impossibles (coquille du coach)', () => {
    expect(parseDateRaw('31/02', 2026)).toBeNull(); // 31 février n'existe pas
    expect(parseDateRaw('32/13', 2026)).toBeNull(); // mois 13, jour 32
    expect(parseDateRaw('00/00', 2026)).toBeNull();
    expect(parseDateRaw('30/02/2026', 2026)).toBeNull();
  });

  it('rejette le texte vide ou non parsable', () => {
    expect(parseDateRaw('', 2026)).toBeNull();
    expect(parseDateRaw('   ', 2026)).toBeNull();
    expect(parseDateRaw('bonjour', 2026)).toBeNull();
  });
});

describe('classifyMacroType', () => {
  it('classe les types explicites', () => {
    expect(classifyMacroType('VMA courte', '')).toBe('vma');
    expect(classifyMacroType('Seuil progressif', '')).toBe('seuil');
    expect(classifyMacroType('Côtes longues', '')).toBe('cotes');
    expect(classifyMacroType('Sortie longue', '')).toBe('sl');
    expect(classifyMacroType('Spécifique trail', '')).toBe('spe');
    expect(classifyMacroType('Activation', '')).toBe('recup');
  });

  it('classe la piste et le fractionné en VMA (régression test Chrome)', () => {
    // "PISTE 2X6X200M" était classé "Autre" avant le fix.
    expect(classifyMacroType('', 'Echauf | PISTE 2X6X200M | r200trotté')).toBe('vma');
    expect(classifyMacroType('', '8 x 200m rapide')).toBe('vma');
  });

  it('classe les courses / tests', () => {
    expect(classifyMacroType('France Trail Ventoux', 'Objectif championnat')).toBe('course');
    expect(classifyMacroType('Trail de Bize', '')).toBe('course');
  });

  it('classe en "other" ce qui ne matche rien', () => {
    expect(classifyMacroType('', 'blabla inconnu')).toBe('other');
  });
});

describe('detectFormat', () => {
  it('détecte le format canonique (5 colonnes)', () => {
    expect(detectFormat('Semaine\tDate\tJour\tType de séance\tContenu détaillé')).toBe('canonical');
  });

  it('détecte la matrice (DATE + colonnes groupes)', () => {
    expect(detectFormat('semaine\tDATE\tGR ESSENTIEL\tGR INTERMEDIAIRE')).toBe('matrix');
  });

  it('détecte la liste simple (Date + Séance)', () => {
    expect(detectFormat('Date\tSéance')).toBe('simple');
  });
});

describe('resolveGroup', () => {
  it('résout un nom exact (insensible accents/préfixe)', () => {
    expect(resolveGroup('GR ESSENTIEL', GROUPS)).toEqual({ groupId: 'g-ess', confidence: 'exact' });
    expect(resolveGroup('GROUPE RENFORCE', GROUPS)).toEqual({ groupId: 'g-ren', confidence: 'exact' });
  });

  it('ne devine pas un groupe mal orthographié en base (cas réel "intermédiare")', () => {
    // "GR INTERMEDIAIRE" (Excel) ne matche pas "intermédiare" (typo en base) :
    // les deux normalisés diffèrent → pas de faux match silencieux.
    const r = resolveGroup('GR INTERMEDIAIRE', GROUPS);
    expect(r.confidence).not.toBe('exact');
    // soit none, soit approx, mais surtout pas un match exact erroné
  });

  it('renvoie none pour un groupe introuvable', () => {
    expect(resolveGroup('Groupe Fantôme', GROUPS)).toEqual({ groupId: null, confidence: 'none' });
  });
});

describe('parseImport — format matrice (semaine 21 réelle)', () => {
  const matrix = [
    'semaine\tDATE\tGR ESSENTIEL\tGROUPE RENFORCE',
    "21\tlundi 25 mai 2026\tRENFO et/ou EF30'\tRENFO et EF45'",
    '21\tmardi 26 mai 2026\tEchauf | PISTE 2X6X200M\tEchauf | PISTE 2X10X200M',
    '21\tdimanche 31 mai 2026\t\tCaroux SL 2000D+',
  ].join('\n');

  it('parse les bonnes séances et ignore les cellules vides', () => {
    const r = parseImport(matrix, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    // 3 lignes x 2 groupes = 6 cellules, mais la cellule vide du dimanche/Essentiel est ignorée → 5
    expect(r.sessions.length).toBe(5);
    expect(r.skipped).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it('résout les groupes et classe les macro-types', () => {
    const r = parseImport(matrix, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    const piste = r.sessions.find(s => s.contentText.includes('PISTE'));
    expect(piste?.macroType).toBe('vma');
    expect(piste?.groupId).toBe('g-ess');
    const sl = r.sessions.find(s => s.contentText.includes('Caroux'));
    expect(sl?.macroType).toBe('sl');
    expect(sl?.groupId).toBe('g-ren');
  });
});

describe('parseImport — format canonique', () => {
  const canonical = [
    'Semaine\tDate\tJour\tType de séance\tContenu détaillé',
    "S1\t14/01\tMardi\tVMA courte\t20' EF | 8 x 200m | 10' retour",
    'S1\t19/01\tDimanche\tSortie nature\t1h30 vallonné',
  ].join('\n');

  it('parse les 2 séances avec dates et types corrects', () => {
    const r = parseImport(canonical, { defaultYear: 2026, groups: GROUPS, forceFormat: 'canonical' });
    expect(r.sessions).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.sessions[0].date).toBe('2026-01-14');
    expect(r.sessions[0].macroType).toBe('vma');
    expect(r.sessions[0].subType).toBe('VMA courte');
    expect(r.sessions[1].date).toBe('2026-01-19');
    expect(r.sessions[1].macroType).toBe('sl');
  });
});
