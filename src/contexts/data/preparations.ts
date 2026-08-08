import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SpecificPreparation, UserPreparation, Session } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toPreparation } from './rows';

interface PreparationActionsSetters {
  setPreparations: Dispatch<SetStateAction<SpecificPreparation[]>>;
  setUserPreparations: Dispatch<SetStateAction<UserPreparation[]>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
}

export function usePreparationActions(
  { setPreparations, setUserPreparations, setSessions }: PreparationActionsSetters,
  authUserId: string | undefined
) {
  const addPreparation = useCallback(async (name: string, eventDate: string, description: string | null): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.from('specific_preparations').insert({
      name, event_date: eventDate, description, created_by: authUserId,
    }).select().single();
    if (error || !data) {
      captureError('addPreparation error', error);
      return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
    }
    setPreparations(prev => [...prev, toPreparation(data)].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    return { error: null };
  }, [setPreparations, authUserId]);

  const updatePreparation = useCallback(async (id: string, updates: Partial<SpecificPreparation>): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('specific_preparations').update(updates).eq('id', id);
    if (error) {
      captureError('updatePreparation error', error);
      return { error: error.message };
    }
    setPreparations(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    return { error: null };
  }, [setPreparations]);

  const deletePreparation = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('specific_preparations').delete().eq('id', id);
    if (error) {
      captureError('deletePreparation error', error);
      return { error: error.message };
    }
    setPreparations(prev => prev.filter(p => p.id !== id));
    setUserPreparations(prev => prev.filter(up => up.preparation_id !== id));
    setSessions(prev => prev.map(s => s.preparation_id === id ? { ...s, preparation_id: null } : s));
    return { error: null };
  }, [setPreparations, setUserPreparations, setSessions]);

  const addUserToPreparation = useCallback(async (userId: string, preparationId: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.from('user_preparations').insert({ user_id: userId, preparation_id: preparationId }).select().single();
    if (error || !data) {
      captureError('addUserToPreparation error', error);
      return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
    }
    setUserPreparations(prev => [...prev, data]);
    return { error: null };
  }, [setUserPreparations]);

  const removeUserFromPreparation = useCallback(async (userId: string, preparationId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('user_preparations').delete()
      .eq('user_id', userId).eq('preparation_id', preparationId);
    if (error) {
      captureError('removeUserFromPreparation error', error);
      return { error: error.message };
    }
    setUserPreparations(prev => prev.filter(up => !(up.user_id === userId && up.preparation_id === preparationId)));
    return { error: null };
  }, [setUserPreparations]);

  return useMemo(() => ({
    addPreparation, updatePreparation, deletePreparation, addUserToPreparation, removeUserFromPreparation,
  }), [addPreparation, updatePreparation, deletePreparation, addUserToPreparation, removeUserFromPreparation]);
}
