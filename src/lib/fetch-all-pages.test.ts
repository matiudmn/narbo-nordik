import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages, PAGE_SIZE } from './fetch-all-pages';

interface Row { id: string }

const makeRows = (from: number, count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `row-${from + i}` }));

describe('fetchAllPages', () => {
  it('rend une page unique telle quelle quand la table tient sous le plafond', async () => {
    const fetchPage = vi.fn(async () => ({ data: makeRows(0, 42), error: null, status: 200 }));
    const result = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
    expect(result.data).toHaveLength(42);
    expect(result.error).toBeNull();
  });

  it('enchaîne les pages jusqu\'à épuisement quand la table dépasse le plafond', async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? makeRows(0, PAGE_SIZE) : makeRows(PAGE_SIZE, 38),
      error: null,
      status: 200,
    }));
    const result = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, PAGE_SIZE, 2 * PAGE_SIZE - 1);
    expect(result.data).toHaveLength(PAGE_SIZE + 38);
    expect(result.data?.at(-1)?.id).toBe(`row-${PAGE_SIZE + 37}`);
  });

  it('s\'arrête sur une page pleine suivie d\'une page vide (total multiple exact du plafond)', async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? makeRows(0, PAGE_SIZE) : [],
      error: null,
      status: 200,
    }));
    const result = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(PAGE_SIZE);
  });

  it('propage l\'enveloppe d\'erreur de la page fautive (status 0 réseau compris)', async () => {
    const fetchPage = vi.fn(async (from: number) =>
      from === 0
        ? { data: makeRows(0, PAGE_SIZE), error: null, status: 200 }
        : { data: null, error: { message: 'Failed to fetch' }, status: 0 },
    );
    const result = await fetchAllPages(fetchPage);
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Failed to fetch');
    expect(result.status).toBe(0);
  });

  it('déduplique par id une ligne à cheval sur deux pages (écriture concurrente)', async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? makeRows(0, PAGE_SIZE) : [{ id: `row-${PAGE_SIZE - 1}` }, ...makeRows(PAGE_SIZE, 3)],
      error: null,
      status: 200,
    }));
    const result = await fetchAllPages(fetchPage);
    expect(result.data).toHaveLength(PAGE_SIZE + 3);
    expect(new Set(result.data?.map(r => r.id)).size).toBe(PAGE_SIZE + 3);
  });
});
