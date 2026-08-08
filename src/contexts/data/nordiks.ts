import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RaceNordik, SessionNordik, ValidationReaction } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toRaceNordik, toSessionNordik, toValidationReaction } from './rows';
import { notifySessionNordik, notifyValidationReaction } from './notificationEffects';

interface NordikActionsSetters {
  setRaceNordiks: Dispatch<SetStateAction<RaceNordik[]>>;
  setSessionNordiks: Dispatch<SetStateAction<SessionNordik[]>>;
  setValidationReactions: Dispatch<SetStateAction<ValidationReaction[]>>;
}

export function useNordikActions({ setRaceNordiks, setSessionNordiks, setValidationReactions }: NordikActionsSetters) {
  const toggleNordik = useCallback(async (raceId: string, userId: string): Promise<{ error: string | null }> => {
    const { data: existing } = await supabase.from('race_nordiks').select('*').eq('race_id', raceId).eq('user_id', userId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('race_nordiks').delete().eq('id', existing.id);
      if (error) {
        captureError('toggleNordik error', error);
        return { error: error.message };
      }
      setRaceNordiks(prev => prev.filter(n => n.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('race_nordiks').insert({ race_id: raceId, user_id: userId }).select().single();
      if (error || !data) {
        captureError('toggleNordik error', error);
        return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
      }
      setRaceNordiks(prev => [...prev, toRaceNordik(data)]);
    }
    return { error: null };
  }, [setRaceNordiks]);

  const toggleSessionNordik = useCallback(async (sessionId: string, userId: string): Promise<{ error: string | null }> => {
    const { data: existing } = await supabase.from('session_nordiks').select('*').eq('session_id', sessionId).eq('user_id', userId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('session_nordiks').delete().eq('id', existing.id);
      if (error) {
        captureError('toggleSessionNordik error', error);
        return { error: error.message };
      }
      setSessionNordiks(prev => prev.filter(n => n.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('session_nordiks').insert({ session_id: sessionId, user_id: userId }).select().single();
      if (error || !data) {
        captureError('toggleSessionNordik error', error);
        return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
      }
      setSessionNordiks(prev => [...prev, toSessionNordik(data)]);
      await notifySessionNordik(sessionId, userId);
    }
    return { error: null };
  }, [setSessionNordiks]);

  const toggleValidationReaction = useCallback(async (validationId: string, emoji: string, authorId: string): Promise<{ error: string | null }> => {
    const { data: existing } = await supabase.from('validation_reactions')
      .select('*').eq('validation_id', validationId).eq('author_id', authorId).eq('emoji', emoji).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('validation_reactions').delete().eq('id', existing.id);
      if (error) {
        captureError('toggleValidationReaction error', error);
        return { error: error.message };
      }
      setValidationReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('validation_reactions').insert({ validation_id: validationId, author_id: authorId, emoji }).select().single();
      if (error || !data) {
        captureError('toggleValidationReaction error', error);
        return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
      }
      setValidationReactions(prev => [...prev, toValidationReaction(data)]);
      await notifyValidationReaction(validationId, emoji, authorId);
    }
    return { error: null };
  }, [setValidationReactions]);

  return useMemo(() => ({
    toggleNordik, toggleSessionNordik, toggleValidationReaction,
  }), [toggleNordik, toggleSessionNordik, toggleValidationReaction]);
}
