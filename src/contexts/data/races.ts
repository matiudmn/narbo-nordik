import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RaceResult, Session, SessionValidation, RaceNordik } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toRaceResult, toSession, toValidation } from './rows';

interface RaceActionsSetters {
  setRaceResults: Dispatch<SetStateAction<RaceResult[]>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setValidations: Dispatch<SetStateAction<SessionValidation[]>>;
  setRaceNordiks: Dispatch<SetStateAction<RaceNordik[]>>;
}

export function useRaceActions({ setRaceResults, setSessions, setValidations, setRaceNordiks }: RaceActionsSetters) {
  const addRaceResult = useCallback(async (result: Omit<RaceResult, 'id' | 'created_at'>): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.from('race_results').insert(result).select().single();
    if (error || !data) {
      captureError('addRaceResult error', error);
      return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
    }
    setRaceResults(prev => [...prev, toRaceResult(data)]);

    // Auto-create a personal session marked as done
    const durationParts = result.time_duration.split(':').map(Number);
    const totalSeconds = (durationParts[0] || 0) * 3600 + (durationParts[1] || 0) * 60 + (durationParts[2] || 0);
    const distanceMeters = Math.round(result.distance_km * 1000);

    const sessionPayload = {
      title: `Course : ${result.race_name}`,
      date: new Date(result.date).toISOString(),
      session_type: 'course' as const,
      terrain_options: [] as string[],
      location: null,
      location_url: null,
      description: result.comment || null,
      group_id: null,
      preparation_id: null,
      target_distance: null,
      vma_percent_min: null,
      vma_percent_max: null,
      blocks: [{
        id: `blk_race_${Date.now()}`,
        type: 'travail' as const,
        allure: 'ef' as const,
        duration_seconds: totalSeconds,
        distance_meters: distanceMeters,
        repetitions: 1,
        rest_seconds: 0,
        rest_distance_meters: null,
      }],
      is_personal: true,
      created_by: result.user_id,
    };

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions').insert(sessionPayload).select().single();

    if (sessionError || !sessionData) {
      captureError('addRaceResult (auto-session) error', sessionError);
      return { error: null };
    }
    setSessions(prev => [...prev, toSession(sessionData)].sort((a, b) => a.date.localeCompare(b.date)));

    const validationRow = {
      session_id: sessionData.id,
      user_id: result.user_id,
      status: 'done',
      feedback: result.comment || null,
      attachment_path: null,
      attachment_type: null,
      objective_reached: 'oui',
      sensations: null,
      created_at: new Date().toISOString(),
    };

    const { data: valData, error: valError } = await supabase
      .from('session_validations').insert(validationRow).select().single();

    if (valError || !valData) {
      captureError('addRaceResult (auto-validation) error', valError);
      return { error: null };
    }
    setValidations(prev => [...prev, toValidation(valData)]);
    return { error: null };
  }, [setRaceResults, setSessions, setValidations]);

  const updateRaceResult = useCallback(async (id: string, updates: Partial<Omit<RaceResult, 'id' | 'created_at'>>): Promise<{ error: string | null }> => {
    setRaceResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const { error } = await supabase.from('race_results').update(updates).eq('id', id);
    if (error) {
      captureError('updateRaceResult error', error);
      const { data } = await supabase.from('race_results').select('*');
      if (data) setRaceResults(data.map(toRaceResult));
      return { error: error.message };
    }
    return { error: null };
  }, [setRaceResults]);

  const deleteRaceResult = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('race_results').delete().eq('id', id);
    if (error) {
      captureError('deleteRaceResult error', error);
      return { error: error.message };
    }
    setRaceResults(prev => prev.filter(r => r.id !== id));
    setRaceNordiks(prev => prev.filter(n => n.race_id !== id));
    return { error: null };
  }, [setRaceResults, setRaceNordiks]);

  return useMemo(() => ({
    addRaceResult, updateRaceResult, deleteRaceResult,
  }), [addRaceResult, updateRaceResult, deleteRaceResult]);
}
