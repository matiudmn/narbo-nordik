import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Auto-sauvegarde locale d'un brouillon de séance (côté coach).
 *
 * - Sauvegarde dans localStorage avec debounce 800ms quand `draft` change.
 * - Au mount, propose le brouillon existant (s'il y en a un) via `pendingDraft`.
 * - `clearDraft()` après publish pour repartir clean.
 * - Clé par utilisateur + (option) par contexte (création vs édition d'une séance précise).
 *
 * Usage :
 *   const draft = { title, date, groupId, ... };
 *   const { pendingDraft, dismissPendingDraft, clearDraft, savedAt } =
 *     useSessionAutosave(draft, { userId: user.id, key: 'new' });
 *
 *   useEffect(() => {
 *     if (pendingDraft) { ... restore form state ... }
 *   }, []);
 *
 *   const onPublish = async () => {
 *     await save(); clearDraft();
 *   };
 */

interface AutosaveOptions {
  /** ID utilisateur (clé localStorage) */
  userId: string | undefined;
  /** Discriminant : "new" pour une création, ou l'ID de la séance en édition */
  key: string;
  /** Délai de debounce en ms (défaut: 800ms) */
  debounceMs?: number;
  /** Sérialisation custom (optionnel — défaut JSON.stringify) */
  serialize?: <T>(draft: T) => string;
  /** Désérialisation custom */
  deserialize?: <T>(raw: string) => T | null;
}

interface AutosaveResult<T> {
  /** Brouillon trouvé dans localStorage au mount, null sinon. À utiliser pour restaurer le form. */
  pendingDraft: T | null;
  /** Marquer le brouillon comme "ignoré" sans l'effacer (le user a choisi de ne pas restaurer) */
  dismissPendingDraft: () => void;
  /** Effacer le brouillon (après publish réussi) */
  clearDraft: () => void;
  /** Timestamp ISO de la dernière sauvegarde (pour banner "Enregistré il y a Xs") */
  savedAt: string | null;
}

const STORAGE_PREFIX = 'session_draft';

function storageKey(userId: string | undefined, key: string): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}:${userId}:${key}`;
}

function isEmptyDraft(draft: unknown): boolean {
  if (!draft || typeof draft !== 'object') return true;
  return Object.values(draft as Record<string, unknown>).every((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  });
}

export function useSessionAutosave<T>(draft: T, options: AutosaveOptions): AutosaveResult<T> {
  const { userId, key, debounceMs = 800 } = options;
  const serialize = options.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = options.deserialize ?? ((raw: string) => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  });

  const skey = storageKey(userId, key);
  const [pendingDraft, setPendingDraft] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dismissedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Au mount : check si un brouillon existe
  useEffect(() => {
    if (!skey) return;
    try {
      const raw = window.localStorage.getItem(skey);
      if (!raw) return;
      const parsed = deserialize(raw);
      if (parsed && !isEmptyDraft(parsed)) {
        setPendingDraft(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skey]);

  // Auto-save debounced quand draft change
  useEffect(() => {
    if (!skey) return;
    // Pas de sauvegarde tant qu'un brouillon pending non traité subsiste
    if (pendingDraft && !dismissedRef.current) return;
    // Pas de sauvegarde si le form est vide
    if (isEmptyDraft(draft)) return;

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(skey, serialize(draft));
        setSavedAt(new Date().toISOString());
      } catch {
        /* localStorage plein ou bloqué — ignore silencieusement */
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, skey, pendingDraft]);

  const clearDraft = useCallback(() => {
    if (!skey) return;
    try {
      window.localStorage.removeItem(skey);
    } catch {
      /* ignore */
    }
    setPendingDraft(null);
    setSavedAt(null);
    dismissedRef.current = true;
  }, [skey]);

  const dismissPendingDraft = useCallback(() => {
    dismissedRef.current = true;
    setPendingDraft(null);
  }, []);

  return { pendingDraft, dismissPendingDraft, clearDraft, savedAt };
}
