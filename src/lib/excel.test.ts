import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { excelToTsv } from './excel';
import { parseImport, normalizeTabular } from './importParser';
import type { Group } from '../types';

const GROUPS: Group[] = [
  { id: 'g-ess', name: 'Essentiel' },
  { id: 'g-ren', name: 'Renforcé' },
];

const HEADER = ['semaine', 'DATE', 'GR ESSENTIEL', 'GROUPE RENFORCE'];

/** Construit un .xlsx en mémoire, comme celui que déposerait le coach. */
function buildWorkbook(sheets: { name: string; rows: unknown[][] }[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}

describe('excelToTsv', () => {
  it('lit un classeur matrice : dates en JJ/MM/AAAA et cellule multi-lignes en phases', async () => {
    const buf = buildWorkbook([
      {
        name: 'Saison',
        rows: [
          HEADER,
          ['21', new Date(2026, 4, 25), "Echauf 20'\nPISTE 2X6X200M\nr200 trotté", "RENFO et EF45'"],
          ['21', new Date(2026, 4, 26), "EF 45'", 'Caroux SL 2000D+'],
        ],
      },
    ]);

    const tsv = await excelToTsv(buf);
    expect(tsv.split('\n')[0]).toBe(HEADER.join('\t'));
    expect(tsv).toContain('25/05/2026');

    const r = parseImport(normalizeTabular(tsv), {
      defaultYear: 2026,
      groups: GROUPS,
      forceFormat: 'matrix',
    });
    expect(r.errors).toHaveLength(0);
    // 2 dates x 2 groupes
    expect(r.sessions).toHaveLength(4);
    expect(r.sessions[0].date).toBe('2026-05-25');
    expect(r.sessions[0].groupId).toBe('g-ess');
    expect(r.sessions[0].contentText).toBe("Echauf 20' | PISTE 2X6X200M | r200 trotté");
    expect(r.sessions[0].macroType).toBe('vma');
    expect(r.sessions[3].date).toBe('2026-05-26');
    expect(r.sessions[3].groupId).toBe('g-ren');
  });

  it('ne compte qu\'une fois l\'en-tête répété sur un second onglet', async () => {
    const buf = buildWorkbook([
      { name: 'Trimestre 1', rows: [HEADER, ['21', new Date(2026, 4, 25), "EF 45'", 'SL 1h30']] },
      { name: 'Trimestre 2', rows: [HEADER, ['22', new Date(2026, 5, 1), "EF 50'", 'SL 2h']] },
    ]);

    const tsv = await excelToTsv(buf);
    expect(tsv.split('\n').filter(l => l.startsWith('semaine'))).toHaveLength(1);

    const r = parseImport(normalizeTabular(tsv), {
      defaultYear: 2026,
      groups: GROUPS,
      forceFormat: 'matrix',
    });
    expect(r.errors).toHaveLength(0);
    // 2 dates x 2 groupes, l'en-tête du 2e onglet n'a pas produit de ligne
    expect(r.sessions).toHaveLength(4);
    expect(r.sessions.map(s => s.date)).toEqual([
      '2026-05-25',
      '2026-05-25',
      '2026-06-01',
      '2026-06-01',
    ]);
  });
});
