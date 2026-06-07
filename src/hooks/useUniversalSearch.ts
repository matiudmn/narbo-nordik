/**
 * Hook de recherche universelle.
 *  - Index local construit en mémoire (mémoïsé sur les données + le viewer).
 *  - Recherche locale instantanée via runSearch.
 *  - Couche IA explicite (runAi) : appelle l'edge function qui traduit la phrase
 *    en filtres structurés, puis applique ces filtres LOCALEMENT (donc scopés
 *    par persona). L'IA ne voit jamais les données du club, seulement la phrase.
 */

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { callEdgeFunction } from '../lib/supabase';
import {
  buildSearchIndex, runSearch, applyAiFilters, sanitizeAiFilters, describeAiFilters,
  hasAnyFilter, type SearchResult, type SearchViewer, type SearchData,
} from '../lib/search';

export interface AiState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: SearchResult[];
  description: string;
  error: string | null;
}

const IDLE_AI: AiState = { status: 'idle', results: [], description: '', error: null };

export function useUniversalSearch() {
  const { effectiveUser, isSuperAdmin } = useAuth();
  const { users, sessions, validations, raceResults, preparations, groups, userPreparations } = useData();

  // effectiveUser vient du contexte d'auth : son identité ne change qu'aux
  // changements d'auth (login, impersonation), pas à chaque rendu. On peut donc
  // dépendre de l'objet directement.
  const viewer = useMemo<SearchViewer | null>(
    () => effectiveUser
      ? { id: effectiveUser.id, role: effectiveUser.role, group_id: effectiveUser.group_id, isSuperAdmin }
      : null,
    [effectiveUser, isSuperAdmin],
  );

  const data = useMemo<SearchData>(
    () => ({ users, sessions, validations, raceResults, preparations, groups, userPreparations }),
    [users, sessions, validations, raceResults, preparations, groups, userPreparations],
  );

  const index = useMemo(
    () => (viewer ? buildSearchIndex(viewer, data) : []),
    [viewer, data],
  );

  const search = useCallback((query: string): SearchResult[] => runSearch(index, query), [index]);

  const [ai, setAi] = useState<AiState>(IDLE_AI);

  const runAi = useCallback(async (query: string) => {
    if (!viewer || !query.trim()) return;
    setAi({ status: 'loading', results: [], description: '', error: null });
    const today = new Date().toISOString().slice(0, 10);
    const { data: resp, error } = await callEdgeFunction<{ filters: unknown }>(
      'ai-search-filters', { query: query.trim(), today },
    );
    if (error || !resp) {
      setAi({ status: 'error', results: [], description: '', error: error ?? 'Recherche IA indisponible.' });
      return;
    }
    const filters = sanitizeAiFilters(resp.filters);
    if (!hasAnyFilter(filters)) {
      setAi({ status: 'done', results: [], description: '', error: null });
      return;
    }
    const results = applyAiFilters(viewer, data, filters);
    setAi({ status: 'done', results, description: describeAiFilters(filters), error: null });
  }, [viewer, data]);

  const clearAi = useCallback(() => setAi(IDLE_AI), []);

  return { ready: !!viewer, search, ai, runAi, clearAi };
}
