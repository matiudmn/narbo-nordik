/**
 * Cache offline (lecture seule) des collections chargées au bootstrap.
 *
 * IndexedDB, sans nouvelle dépendance : localStorage est écarté (limite
 * ~5 Mo vite atteinte par les collections du club, API synchrone qui
 * bloquerait le thread principal sur des payloads de cette taille).
 *
 * Une seule base, un seul object store ('collections') : la clé du store
 * EST le nom de la collection ('sessions', 'users', ...), la valeur porte
 * les données déjà normalisées (mêmes objets que ceux posés en state par
 * bootstrap.ts) et l'horodatage du snapshot.
 *
 * Toutes les opérations sont best-effort côté appelant : IndexedDB peut être
 * indisponible (navigation privée stricte de Safari, quota dépassé, contexte
 * non sécurisé...). Ce module se contente de rejeter proprement ; c'est aux
 * appelants (bootstrap.ts, AuthContext) de catcher et logger via
 * captureError sans jamais faire échouer leur propre flux.
 */

const DB_NAME = 'narbo-nordik-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'collections';

export interface CacheEntry {
  data: unknown;
  cachedAt: number;
}

export interface OfflineState {
  isOffline: boolean;
  cachedAt: number | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Ouverture IndexedDB impossible'));
  });
}

/**
 * Écrit plusieurs collections en une seule transaction, avec un horodatage
 * commun (l'instant du snapshot). Retourne cet horodatage.
 */
export async function saveSnapshot(entries: Record<string, unknown>): Promise<number> {
  const cachedAt = Date.now();
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const [key, data] of Object.entries(entries)) {
        store.put({ data, cachedAt } satisfies CacheEntry, key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Ecriture cache impossible'));
    });
    return cachedAt;
  } finally {
    db.close();
  }
}

/**
 * Lit plusieurs collections. Les clés absentes du cache sont simplement
 * omises du résultat (pas d'erreur).
 */
export async function loadSnapshot(keys: string[]): Promise<Map<string, CacheEntry>> {
  const db = await openDb();
  try {
    return await new Promise<Map<string, CacheEntry>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const out = new Map<string, CacheEntry>();
      if (keys.length === 0) {
        resolve(out);
        return;
      }
      let pending = keys.length;
      for (const key of keys) {
        const req = store.get(key);
        req.onsuccess = () => {
          const entry = req.result as CacheEntry | undefined;
          if (entry) out.set(key, entry);
          pending -= 1;
          if (pending === 0) resolve(out);
        };
        req.onerror = () => reject(req.error ?? new Error('Lecture cache impossible'));
      }
    });
  } finally {
    db.close();
  }
}

/**
 * Purge complète du cache. À appeler à la déconnexion et si l'utilisateur
 * connecté change, car le cache d'un coach porte les lignes complètes de
 * get_users_for_coach (PII : email, téléphone, licence, date de naissance).
 */
export async function clearSnapshot(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Purge cache impossible'));
    });
  } finally {
    db.close();
  }
}
