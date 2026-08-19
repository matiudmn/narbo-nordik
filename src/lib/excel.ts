/**
 * Lecture d'un classeur Excel (.xlsx / .xls) déposé sur la page Import.
 *
 * SheetJS est chargé dynamiquement : ~350 Ko qui ne concernent qu'un coach
 * déposant un fichier, ils ne doivent pas peser sur le bundle initial.
 */

import { detectFormat } from './importParser';

/**
 * Convertit un classeur en TSV, une feuille après l'autre. Le résultat passe
 * ensuite par `normalizeTabular` : les cellules multi-lignes que SheetJS
 * encadre de guillemets y sont aplaties en phases " | ".
 */
export async function excelToTsv(data: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  // `dateNF` compte à la LECTURE : SheetJS calcule le texte de la cellule (.w)
  // à ce moment, et `sheet_to_csv` le réutilise tel quel. Sans lui, une date
  // sort au format américain "5/25/26", que parseDateRaw ne sait pas lire.
  const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });

  const all: string[] = [];
  // Un onglet "Notes" ou "Légende" placé avant la feuille de saison fixait
  // l'en-tête du classeur entier : on ne retient comme feuilles de plan que
  // celles dont la première ligne est un en-tête reconnu.
  const plans: string[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const csv = XLSX.utils
      .sheet_to_csv(ws, { FS: '\t', RS: '\n', blankrows: false, dateNF: 'dd/mm/yyyy' })
      .replace(/\n+$/, '');
    if (!csv.trim()) continue;
    all.push(csv);
    if (detectFormat(csv.split('\n')[0]) !== 'unknown') plans.push(csv);
  }

  // Aucune feuille reconnue : on rend le contenu brut plutôt qu'une chaîne
  // vide, le coach voit ce qu'il a déposé et peut corriger.
  if (plans.length === 0) return all.join('\n');

  // Un classeur découpé par trimestre répète son en-tête sur chaque onglet :
  // on retire la première ligne des feuilles suivantes dès qu'elle est un
  // en-tête, sans comparer les libellés (une colonne HEURE en plus ou une
  // tabulation finale suffisaient à la faire passer pour une séance).
  return plans.map((csv, i) => (i === 0 ? csv : csv.split('\n').slice(1).join('\n'))).join('\n');
}
