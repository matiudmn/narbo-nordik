import { describe, it, expect } from 'vitest';
import {
  parseDateRaw,
  classifyMacroType,
  detectFormat,
  resolveGroup,
  parseImport,
  normalizeTabular,
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

describe('normalizeTabular', () => {
  it('laisse le texte intact tant qu\'un guillemet reste ouvert (saisie en cours)', () => {
    const typing = 'semaine\tDATE\tGR ESSENTIEL\n1\t25/05/2026\t"20 EF\n8x200';
    expect(normalizeTabular(typing)).toBe(typing);
  });

  it('convertit un CSV point-virgule (Excel France) en TSV lisible par le parser', () => {
    const csv = [
      'semaine;DATE;GR ESSENTIEL;GROUPE RENFORCE;intermédiare',
      "21;25/05/2026;RENFO et EF30';RENFO et EF45';EF 40'",
      "21;26/05/2026;PISTE 2X6X200M;PISTE 2X10X200M;PISTE 2X8X200M",
    ].join('\n');
    expect(normalizeTabular(csv).split('\n')[0]).toBe(
      'semaine\tDATE\tGR ESSENTIEL\tGROUPE RENFORCE\tintermédiare'
    );
    const r = parseImport(csv, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    // 2 dates x 3 groupes
    expect(r.sessions).toHaveLength(6);
    expect(r.errors).toHaveLength(0);
    expect(r.sessions[0].date).toBe('2026-05-25');
  });

  it('convertit un CSV virgule', () => {
    const csv = ['Date,Séance', "25/05/2026,EF 45'", '26/05/2026,PISTE 8x200m'].join('\n');
    expect(normalizeTabular(csv)).toBe(
      ['Date\tSéance', "25/05/2026\tEF 45'", '26/05/2026\tPISTE 8x200m'].join('\n')
    );
    const r = parseImport(csv, { defaultYear: 2026, groups: GROUPS });
    expect(r.detectedFormat).toBe('simple');
    expect(r.sessions).toHaveLength(2);
  });

  it('aplatit une cellule multi-lignes entre guillemets en phases " | "', () => {
    const csv = [
      'Date;Séance',
      '25/05/2026;"Echauf 20\'\nPISTE 2X6X200M ""rapide""\nr200 trotté"',
    ].join('\n');
    const r = parseImport(csv, { defaultYear: 2026, groups: GROUPS, forceFormat: 'simple' });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].contentText).toBe('Echauf 20\' | PISTE 2X6X200M "rapide" | r200 trotté');
  });

  it('laisse un TSV déjà propre inchangé (idempotence)', () => {
    // La virgule dans une cellule empêche le chemin rapide : la réémission
    // complète est bien exercée, et doit rendre exactement le même texte.
    const tsv = [
      'semaine\tDATE\tGR ESSENTIEL',
      "21\t25/05/2026\tEchauf, 20' | PISTE 2X6X200M | r200",
    ].join('\n');
    expect(normalizeTabular(tsv)).toBe(tsv);
    expect(normalizeTabular(normalizeTabular(tsv))).toBe(tsv);
  });

  it('laisse le texte JSON intact', () => {
    const json = '{"seances": [{"date": "2026-09-08", "groupes": {"Essentiel": "VMA, 8x300"}}]}';
    expect(normalizeTabular(json)).toBe(json);
    expect(normalizeTabular('```json\n' + json + '\n```')).toBe('```json\n' + json + '\n```');
  });

  it('garde intact un TSV collé depuis Excel avec une cellule multi-lignes', () => {
    // Excel encadre la cellule qui contient un retour à la ligne, même en TSV.
    const pasted = [
      'semaine\tDATE\tGR ESSENTIEL\tGROUPE RENFORCE',
      '21\t25/05/2026\t"Echauf\nPISTE 2X6X200M\nr200"\tSL 1h30',
      "21\t26/05/2026\tEF 45'\tSL 2h",
    ].join('\n');
    expect(normalizeTabular(pasted)).toBe(
      [
        'semaine\tDATE\tGR ESSENTIEL\tGROUPE RENFORCE',
        '21\t25/05/2026\tEchauf | PISTE 2X6X200M | r200\tSL 1h30',
        "21\t26/05/2026\tEF 45'\tSL 2h",
      ].join('\n')
    );
    const r = parseImport(pasted, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions).toHaveLength(4);
    expect(r.sessions[0].contentText).toBe('Echauf | PISTE 2X6X200M | r200');
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

describe('parseImport, format plan (JSON saison)', () => {
  const plan = JSON.stringify({
    version: 1,
    saison: '2026-2027',
    heure_par_defaut: '18:30',
    seances: [
      {
        date: '2026-09-08',
        titre: 'VMA courte',
        type: 'entrainement',
        groupes: {
          Essentiel: "20' EF | 8 x 1' rapide | 10' retour au calme",
          'intermédiare': "20' EF | 10 x 1' rapide | 10' retour au calme",
          'Renforcé': "20' EF | 12 x 1' rapide | 10' retour au calme",
        },
      },
      {
        date: '2026-09-13',
        heure: '09:00',
        type: 'sortie_longue',
        lieu: 'Massif de la Clape',
        groupes: {
          Essentiel: '1h15 vallonné',
          'Renforcé': '1h45 vallonné, finish progressif',
        },
      },
    ],
  });

  it('crée une ligne par séance et par groupe', () => {
    const r = parseImport(plan, { defaultYear: 2026, groups: GROUPS });
    // 3 groupes le 08/09 + 2 groupes le 13/09 (Intermédiaire absent) = 5 lignes
    expect(r.detectedFormat).toBe('plan');
    expect(r.sessions).toHaveLength(5);
    expect(r.errors).toHaveLength(0);
    expect(r.sessions.filter(s => s.date === '2026-09-08')).toHaveLength(3);
    expect(r.sessions.filter(s => s.date === '2026-09-13')).toHaveLength(2);
    expect(r.sessions[0].groupId).toBe('g-ess');
    expect(r.sessions[0].subType).toBe('VMA courte');
    expect(r.sessions[0].macroType).toBe('vma');
  });

  it('reprend heure, type et lieu, avec repli sur heure_par_defaut', () => {
    const r = parseImport(plan, { defaultYear: 2026, groups: GROUPS });
    const vma = r.sessions.find(s => s.date === '2026-09-08')!;
    expect(vma.time).toBe('18:30');
    expect(vma.sessionType).toBe('entrainement');
    expect(vma.location).toBeUndefined();
    const sl = r.sessions.find(s => s.date === '2026-09-13')!;
    expect(sl.time).toBe('09:00');
    expect(sl.sessionType).toBe('sortie_longue');
    expect(sl.location).toBe('Massif de la Clape');
    // Sans titre : premier segment du contenu
    expect(sl.subType).toBe('1h15 vallonné');
  });

  it('accepte un JSON en fences markdown (détecté sans forcer le format)', () => {
    const fenced = '```json\n' + plan + '\n```\nBon entraînement !';
    const r = parseImport(fenced, { defaultYear: 2026, groups: GROUPS });
    expect(r.detectedFormat).toBe('plan');
    expect(r.sessions).toHaveLength(5);
    expect(r.errors).toHaveLength(0);
  });

  it('accepte du texte avant et après les accolades', () => {
    const wrapped = 'Voici ta saison :\n' + plan + '\nDis-moi si tu veux ajuster.';
    const r = parseImport(wrapped, { defaultYear: 2026, groups: GROUPS, forceFormat: 'plan' });
    expect(r.sessions).toHaveLength(5);
    expect(r.errors).toHaveLength(0);
  });

  it('traite la clé "Tous" comme une séance globale', () => {
    const global = JSON.stringify({
      seances: [{ date: '2026-09-20', titre: 'Course du club', groupes: { TOUS: 'Trail de la Clape' } }],
    });
    const r = parseImport(global, { defaultYear: 2026, groups: GROUPS });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].targetType).toBe('group');
    expect(r.sessions[0].targetGroupName).toBe('Tous');
    expect(r.sessions[0].groupId).toBeNull();
  });

  it('refuse un groupe inconnu (erreur, une seule par nom)', () => {
    const unknown = JSON.stringify({
      seances: [
        { date: '2026-09-08', groupes: { Elite: 'VMA 10x400' } },
        { date: '2026-09-15', groupes: { Elite: 'Seuil 3x8' } },
      ],
    });
    const r = parseImport(unknown, { defaultYear: 2026, groups: GROUPS });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].unresolvedGroup).toBe('Elite');
    expect(r.errors[0].message).toContain('Essentiel');
    // Les lignes restent produites pour que le coach puisse les réassigner.
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0].groupId).toBeNull();
  });

  it('signale une date invalide avec son index et sa valeur brute', () => {
    const bad = JSON.stringify({
      seances: [
        { date: '2026-02-31', groupes: { Essentiel: 'VMA' } },
        { date: '2026-09-08', groupes: { Essentiel: 'Seuil' } },
      ],
    });
    const r = parseImport(bad, { defaultYear: 2026, groups: GROUPS });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].lineNumber).toBe(1);
    expect(r.errors[0].message).toContain('2026-02-31');
    expect(r.sessions).toHaveLength(1);
  });

  it('refuse un JSON sans "seances"', () => {
    const r = parseImport('{ "version": 1 }', { defaultYear: 2026, groups: GROUPS });
    expect(r.sessions).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('seances');
  });

  it('ignore les contenus vides ou de repos', () => {
    const rest = JSON.stringify({
      seances: [{ date: '2026-09-08', groupes: { Essentiel: 'repos', 'Renforcé': '', 'intermédiare': 'VMA 8x300' } }],
    });
    const r = parseImport(rest, { defaultYear: 2026, groups: GROUPS });
    expect(r.sessions).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.sessions[0].groupId).toBe('g-int');
  });

  it('traite un match approximatif comme un groupe non résolu', () => {
    // "Essentiel +" ne matche "Essentiel" que par inclusion : trop risqué pour
    // publier la séance, le coach tranche via le sélecteur de correspondance.
    const approx = JSON.stringify({
      seances: [
        { date: '2026-09-08', groupes: { 'Essentiel +': 'VMA 10x400' } },
        { date: '2026-09-15', groupes: { 'Essentiel +': 'Seuil 3x8' } },
      ],
    });
    const r = parseImport(approx, { defaultYear: 2026, groups: GROUPS });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].unresolvedGroup).toBe('Essentiel +');
    expect(r.warnings).toHaveLength(0);
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions.every(s => s.groupId === null)).toBe(true);
  });

  it('refuse un contenu de groupe qui n\'est pas du texte, null valant absence', () => {
    const bad = JSON.stringify({
      seances: [
        {
          date: '2026-09-08',
          groupes: { Essentiel: ['VMA', '8x300'], 'Renforcé': null, 'intermédiare': 'VMA 8x300' },
        },
      ],
    });
    const r = parseImport(bad, { defaultYear: 2026, groups: GROUPS });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('doit être un texte sur une ligne');
    expect(r.skipped).toBe(1);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].groupId).toBe('g-int');
  });

  it('refuse une séance dont "groupes" est un objet vide', () => {
    const empty = JSON.stringify({ seances: [{ date: '2026-09-08', groupes: {} }] });
    const r = parseImport(empty, { defaultYear: 2026, groups: GROUPS });
    expect(r.sessions).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('absente, vide ou mal formée');
  });

  it('avertit une seule fois par heure illisible et applique l\'heure de repli', () => {
    const times = JSON.stringify({
      heure_par_defaut: '18:30',
      seances: [
        { date: '2026-09-08', heure: '18h', groupes: { Essentiel: 'VMA' } },
        { date: '2026-09-15', heure: '18h', groupes: { Essentiel: 'Seuil' } },
      ],
    });
    const r = parseImport(times, { defaultYear: 2026, groups: GROUPS });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toContain('heure "18h" non lisible');
    expect(r.warnings[0].message).toContain('18:30 appliquée');
    expect(r.sessions[0].time).toBe('18:30');
  });

  it('avertit une seule fois pour un type inconnu répété', () => {
    const types = JSON.stringify({
      seances: [
        { date: '2026-09-08', type: 'fractionne', groupes: { Essentiel: 'VMA' } },
        { date: '2026-09-15', type: 'fractionne', groupes: { Essentiel: 'Seuil' } },
      ],
    });
    const r = parseImport(types, { defaultYear: 2026, groups: GROUPS });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toContain('type "fractionne" inconnu');
  });

  it('accepte JJ/MM/AAAA et refuse une date sans année', () => {
    const withYear = parseImport(
      JSON.stringify({ seances: [{ date: '08/09/2026', groupes: { Essentiel: 'VMA' } }] }),
      { defaultYear: 2026, groups: GROUPS }
    );
    expect(withYear.errors).toHaveLength(0);
    expect(withYear.sessions[0].date).toBe('2026-09-08');

    const noYear = parseImport(
      JSON.stringify({ seances: [{ date: '08/09', groupes: { Essentiel: 'VMA' } }] }),
      { defaultYear: 2026, groups: GROUPS }
    );
    expect(noYear.sessions).toHaveLength(0);
    expect(noYear.errors).toHaveLength(1);
    expect(noYear.errors[0].message).toContain('sans année');
  });

  it('explique une réponse coupée sans exposer le message du moteur JSON', () => {
    const truncated = '{"seances": [{"date": "2026-09-08", "groupes": {"Essentiel": "VMA"}}, {"date"';
    const r = parseImport(truncated, { defaultYear: 2026, groups: GROUPS, forceFormat: 'plan' });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('incomplète ou abîmée');
    expect(r.errors[0].message).toContain('trimestre');
    expect(r.errors[0].message).not.toMatch(/JSON|token/i);
  });

  it('oriente vers le bon onglet quand aucune accolade n\'est trouvée', () => {
    const r = parseImport('Date\tSéance', { defaultYear: 2026, groups: GROUPS, forceFormat: 'plan' });
    expect(r.errors[0].message).toContain('onglet');
  });
});

describe('parseImport, format matrice inchangé par les règles du format plan', () => {
  it('garde le match approximatif et son avertissement', () => {
    const matrix = ['semaine\tDATE\tEssentiel +', "21\t25/05/2026\tEF 45'"].join('\n');
    const r = parseImport(matrix, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].groupId).toBe('g-ess');
    expect(r.warnings.some(w => w.message.includes('approximation'))).toBe(true);
  });

  it('accepte toujours une date sans année', () => {
    const matrix = ['semaine\tDATE\tGR ESSENTIEL', "21\t25/05\tEF 45'"].join('\n');
    const r = parseImport(matrix, { defaultYear: 2026, groups: GROUPS, forceFormat: 'matrix' });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions[0].date).toBe('2026-05-25');
  });
});
