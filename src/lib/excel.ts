/**
 * Lecture d'un classeur Excel (.xlsx / .xls) déposé sur la page Import.
 *
 * SheetJS est chargé dynamiquement : ~350 Ko qui ne concernent qu'un coach
 * déposant un fichier, ils ne doivent pas peser sur le bundle initial.
 */

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

  const chunks: string[] = [];
  let header: string | null = null;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    let csv = XLSX.utils
      .sheet_to_csv(ws, { FS: '\t', RS: '\n', blankrows: false, dateNF: 'dd/mm/yyyy' })
      .replace(/\n+$/, '');
    if (!csv.trim()) continue;
    // Un classeur découpé par trimestre répète son en-tête sur chaque onglet :
    // on ne la garde que la première fois, sinon elle passerait pour une séance.
    if (header === null) {
      header = csv.split('\n')[0];
    } else if (csv === header) {
      continue;
    } else if (csv.startsWith(`${header}\n`)) {
      csv = csv.slice(header.length + 1);
    }
    chunks.push(csv);
  }

  return chunks.join('\n');
}
