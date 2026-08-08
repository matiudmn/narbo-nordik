import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Session, SessionValidation } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toSession, asSessionInsert, asSessionUpdate } from './rows';

interface SessionActionsSetters {
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setValidations: Dispatch<SetStateAction<SessionValidation[]>>;
}

export function useSessionActions({ setSessions, setValidations }: SessionActionsSetters) {
  const addSession = useCallback(async (session: Omit<Session, 'id' | 'created_at'>): Promise<{ id: string } | { error: string }> => {
    const { data, error } = await supabase.from('sessions').insert(asSessionInsert(session)).select().single();
    if (error) {
      captureError('addSession error', error);
      return { error: `${error.message}${error.hint ? ' (' + error.hint + ')' : ''}${error.code ? ' [' + error.code + ']' : ''}` };
    }
    if (data) {
      setSessions(prev => [...prev, toSession(data)].sort((a, b) => a.date.localeCompare(b.date)));
      return { id: data.id };
    }
    return { error: 'Aucune donnee retournee par Supabase' };
  }, [setSessions]);

  /**
   * Insertion groupée atomique (import en lot). Un seul appel Supabase :
   * soit toutes les séances sont créées, soit aucune (pas d'état partiel
   * comme avec une boucle d'inserts unitaires). Le state local est mis à
   * jour en une fois.
   */
  const addSessionsBulk = useCallback(async (rows: Omit<Session, 'id' | 'created_at'>[]): Promise<{ created: number } | { error: string }> => {
    if (rows.length === 0) return { created: 0 };
    const { data, error } = await supabase.from('sessions').insert(rows.map(asSessionInsert)).select();
    if (error) {
      captureError('addSessionsBulk error', error);
      return { error: `${error.message}${error.hint ? ' (' + error.hint + ')' : ''}${error.code ? ' [' + error.code + ']' : ''}` };
    }
    if (data) {
      const normalized = data.map(toSession);
      setSessions(prev => [...prev, ...normalized].sort((a, b) => a.date.localeCompare(b.date)));
      return { created: data.length };
    }
    return { error: 'Aucune donnee retournee par Supabase' };
  }, [setSessions]);

  const updateSession = useCallback(async (id: string, updates: Partial<Session>): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('sessions').update(asSessionUpdate(updates)).eq('id', id);
    if (error) {
      captureError('updateSession error', error);
      return { error: error.message };
    }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    return { error: null };
  }, [setSessions]);

  const deleteSession = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) {
      captureError('deleteSession error', error);
      return { error: error.message };
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    setValidations(prev => prev.filter(v => v.session_id !== id));
    return { error: null };
  }, [setSessions, setValidations]);

  return useMemo(() => ({
    addSession, addSessionsBulk, updateSession, deleteSession,
  }), [addSession, addSessionsBulk, updateSession, deleteSession]);
}
