/**
 * PostgREST plafonne toute réponse à 1000 lignes (max-rows par défaut) : un
 * `select('*')` sans borne rend silencieusement une collection amputée dès que
 * la table dépasse le seuil. Découvert le 05/09/2026 quand session_validations
 * a franchi 1038 lignes : les validations les plus récentes sortaient de la
 * fenêtre et revenaient « À valider » à chaque réouverture de l'app.
 *
 * Ce helper enchaîne les pages via `.range()` jusqu'à épuisement. Le fetch de
 * chaque page DOIT porter un ORDER BY stable (id en dernier critère) : sans
 * lui, PostgREST ne garantit aucun ordre et deux pages peuvent se chevaucher
 * ou se trouer. Une écriture concurrente entre deux pages peut malgré tout
 * dupliquer une ligne de bord, d'où la déduplication par id.
 */

interface PageResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
  status: number;
}

export const PAGE_SIZE = 1000;

export async function fetchAllPages<Row extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
): Promise<PageResult<Row>> {
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    if (page.error || !page.data) {
      return { data: null, error: page.error, status: page.status };
    }
    for (const row of page.data) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
      }
    }
    if (page.data.length < PAGE_SIZE) {
      return { data: rows, error: null, status: page.status };
    }
  }
}
