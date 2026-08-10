import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveSnapshot, loadSnapshot, clearSnapshot } from './offline-cache';

/**
 * Stub maison d'IndexedDB (pas de fake-indexeddb dans les devDependencies,
 * cf. package.json, et l'environnement vitest est 'node' donc aucun global
 * IndexedDB n'existe par défaut). Couvre uniquement le sous-ensemble utilisé
 * par offline-cache.ts : open/onupgradeneeded, une transaction par appel,
 * un seul object store, get/put/clear. Le comportement async est simulé via
 * des microtasks, dans l'ordre où IndexedDB les livre réellement (requêtes
 * individuelles avant `oncomplete` de la transaction).
 */
class FakeRequest<T> {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: T | undefined;
  error: Error | null = null;
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private ops: Promise<void>[] = [];
  private backing: Map<string, unknown>;

  constructor(backing: Map<string, unknown>) {
    this.backing = backing;
  }

  objectStore() {
    return {
      get: (key: string): FakeRequest<unknown> => {
        const req = new FakeRequest<unknown>();
        this.ops.push(new Promise((resolve) => {
          queueMicrotask(() => {
            req.result = this.backing.get(key);
            req.onsuccess?.();
            resolve();
          });
        }));
        return req;
      },
      put: (value: unknown, key: string): FakeRequest<unknown> => {
        const req = new FakeRequest<unknown>();
        this.ops.push(new Promise((resolve) => {
          queueMicrotask(() => {
            this.backing.set(key, value);
            req.onsuccess?.();
            resolve();
          });
        }));
        return req;
      },
      clear: (): FakeRequest<unknown> => {
        const req = new FakeRequest<unknown>();
        this.ops.push(new Promise((resolve) => {
          queueMicrotask(() => {
            this.backing.clear();
            req.onsuccess?.();
            resolve();
          });
        }));
        return req;
      },
    };
  }

  /** Programme `oncomplete` une fois toutes les requêtes de cette transaction résolues. */
  _finalize() {
    queueMicrotask(() => {
      Promise.all(this.ops).then(() => this.oncomplete?.());
    });
  }
}

class FakeDatabase {
  private stores = new Map<string, Map<string, unknown>>();
  objectStoreNames = { contains: (name: string) => this.stores.has(name) };

  createObjectStore(name: string) {
    this.stores.set(name, new Map());
  }

  transaction(storeName: string) {
    const backing = this.stores.get(storeName);
    if (!backing) throw new Error(`store inconnu: ${storeName}`);
    const tx = new FakeTransaction(backing);
    tx._finalize();
    return tx;
  }

  close() {}
}

function installFakeIndexedDB() {
  const databases = new Map<string, FakeDatabase>();
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    open(name: string) {
      const req = new FakeRequest<FakeDatabase>() as FakeRequest<FakeDatabase> & { onupgradeneeded: (() => void) | null };
      req.onupgradeneeded = null;
      queueMicrotask(() => {
        let db = databases.get(name);
        const isNew = !db;
        if (!db) {
          db = new FakeDatabase();
          databases.set(name, db);
        }
        req.result = db;
        if (isNew) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

function uninstallFakeIndexedDB() {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
}

describe('offline-cache', () => {
  beforeEach(() => {
    installFakeIndexedDB();
  });

  afterEach(() => {
    uninstallFakeIndexedDB();
  });

  it('écrit puis relit plusieurs collections avec un cachedAt commun', async () => {
    const before = Date.now();
    const cachedAt = await saveSnapshot({ sessions: [{ id: 's1' }], users: [{ id: 'u1' }] });
    expect(cachedAt).toBeGreaterThanOrEqual(before);

    const snapshot = await loadSnapshot(['sessions', 'users', 'groups']);
    expect(snapshot.get('sessions')).toEqual({ data: [{ id: 's1' }], cachedAt });
    expect(snapshot.get('users')).toEqual({ data: [{ id: 'u1' }], cachedAt });
    // Clé jamais écrite : absente du résultat, pas d'erreur.
    expect(snapshot.has('groups')).toBe(false);
  });

  it('loadSnapshot renvoie une Map vide sans rien avoir été écrit', async () => {
    const snapshot = await loadSnapshot(['sessions', 'users']);
    expect(snapshot.size).toBe(0);
  });

  it('loadSnapshot([]) résout immédiatement avec une Map vide', async () => {
    const snapshot = await loadSnapshot([]);
    expect(snapshot.size).toBe(0);
  });

  it('un second saveSnapshot écrase seulement les clés qu’il porte', async () => {
    await saveSnapshot({ sessions: ['v1'], groups: ['g1'] });
    const secondCachedAt = await saveSnapshot({ sessions: ['v2'] });

    const snapshot = await loadSnapshot(['sessions', 'groups']);
    expect(snapshot.get('sessions')).toEqual({ data: ['v2'], cachedAt: secondCachedAt });
    // groups n'était pas dans le second snapshot : conservé tel quel.
    expect(snapshot.get('groups')?.data).toEqual(['g1']);
  });

  it('clearSnapshot vide le cache', async () => {
    await saveSnapshot({ sessions: ['v1'] });
    await clearSnapshot();
    const snapshot = await loadSnapshot(['sessions']);
    expect(snapshot.size).toBe(0);
  });

  it('rejette proprement quand IndexedDB est indisponible (au lieu de faire planter l’appelant)', async () => {
    uninstallFakeIndexedDB();
    await expect(saveSnapshot({ sessions: ['v1'] })).rejects.toThrow();
    await expect(loadSnapshot(['sessions'])).rejects.toThrow();
    await expect(clearSnapshot()).rejects.toThrow();
  });
});
