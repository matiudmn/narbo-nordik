import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Group, User, Session } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';

interface GroupActionsSetters {
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
}

export function useGroupActions({ setGroups, setUsers, setSessions }: GroupActionsSetters) {
  const addGroup = useCallback(async (name: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.from('groups').insert({ name }).select().single();
    if (error || !data) {
      captureError('addGroup error', error);
      return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
    }
    setGroups(prev => [...prev, data]);
    return { error: null };
  }, [setGroups]);

  const updateGroup = useCallback(async (id: string, name: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('groups').update({ name }).eq('id', id);
    if (error) {
      captureError('updateGroup error', error);
      return { error: error.message };
    }
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
    return { error: null };
  }, [setGroups]);

  const deleteGroup = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) {
      captureError('deleteGroup error', error);
      return { error: error.message };
    }
    setGroups(prev => prev.filter(g => g.id !== id));
    setUsers(prev => prev.map(u => u.group_id === id ? { ...u, group_id: null } : u));
    setSessions(prev => prev.map(s => s.group_id === id ? { ...s, group_id: null } : s));
    return { error: null };
  }, [setGroups, setUsers, setSessions]);

  // Patch minimal, local a ce module : updateUserGroup ne fait pas partie de
  // useUserActions (cf. plan de decoupage), donc ne peut pas reutiliser son
  // patchUser interne. group_id est un champ scalaire (pas de colonne jsonb
  // impliquee), aucun adaptateur d'ecriture n'est necessaire ici.
  const updateUserGroup = useCallback(async (userId: string, groupId: string | null): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('users').update({ group_id: groupId }).eq('id', userId);
    if (error) {
      captureError('updateUserGroup error', error);
      return { error: error.message };
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, group_id: groupId } : u));
    return { error: null };
  }, [setUsers]);

  return useMemo(() => ({
    addGroup, updateGroup, deleteGroup, updateUserGroup,
  }), [addGroup, updateGroup, deleteGroup, updateUserGroup]);
}
