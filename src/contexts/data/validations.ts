import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionValidation, ObjectiveReached, Sensations, SessionMetricsInput } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toValidation } from './rows';

interface ValidationActionsSetters {
  setValidations: Dispatch<SetStateAction<SessionValidation[]>>;
}

export function useValidationActions({ setValidations }: ValidationActionsSetters) {
  const validateSession = useCallback(async (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File, objectiveReached?: ObjectiveReached, sensations?: Sensations, metrics?: SessionMetricsInput) => {
    let attachmentPath: string | null = null;
    let attachmentType: string | null = null;

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const filePath = `${userId}/${sessionId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('session-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        captureError('Upload error', uploadError);
        return { error: uploadError.message };
      }
      attachmentPath = filePath;
      attachmentType = file.type;
    }

    const row = {
      session_id: sessionId,
      user_id: userId,
      status,
      feedback: feedback || null,
      attachment_path: attachmentPath,
      attachment_type: attachmentType,
      objective_reached: objectiveReached || null,
      sensations: sensations || null,
      distance_m: metrics?.distance_m ?? null,
      duration_s: metrics?.duration_s ?? null,
      elevation_m: metrics?.elevation_m ?? null,
      avg_hr: metrics?.avg_hr ?? null,
      max_hr: metrics?.max_hr ?? null,
      avg_cadence: metrics?.avg_cadence ?? null,
      metrics_source: metrics?.metrics_source ?? null,
      rpe: metrics?.rpe ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('session_validations').upsert(
      row,
      { onConflict: 'session_id,user_id' }
    ).select().single();

    if (error || !data) {
      captureError('Validation error', error);
      return { error: error?.message ?? 'Unknown error' };
    }

    setValidations(prev => {
      const idx = prev.findIndex(v => v.session_id === sessionId && v.user_id === userId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = toValidation(data);
        return next;
      }
      return [...prev, toValidation(data)];
    });
    return { id: data.id };
  }, [setValidations]);

  const updateValidation = useCallback(async (validationId: string, updates: { feedback?: string; objective_reached?: ObjectiveReached | null; sensations?: Sensations | null; metrics?: SessionMetricsInput }, file?: File): Promise<{ error?: string }> => {
    const { data: existingRow } = await supabase.from('session_validations').select('*').eq('id', validationId).single();
    if (!existingRow) return { error: 'Validation introuvable' };
    const existing = toValidation(existingRow);

    let attachmentPath = existing.attachment_path;
    let attachmentType = existing.attachment_type;

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const filePath = `${existing.user_id}/${existing.session_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('session-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        captureError('Upload error', uploadError);
        return { error: uploadError.message };
      }
      attachmentPath = filePath;
      attachmentType = file.type;
    }

    // Métriques : on ne met à jour que les clés explicitement fournies. Les valeurs
    // null effacent le champ ; les clés absentes (ex. max_hr / avg_cadence, non gérés
    // par l'UI de saisie) sont préservées (pas d'écrasement à null).
    const metricsPatch = updates.metrics
      ? Object.fromEntries(Object.entries(updates.metrics).filter(([, v]) => v !== undefined))
      : {};

    const row = {
      feedback: updates.feedback ?? existing.feedback,
      objective_reached: updates.objective_reached !== undefined ? updates.objective_reached : existing.objective_reached,
      sensations: updates.sensations !== undefined ? updates.sensations : existing.sensations,
      attachment_path: attachmentPath,
      attachment_type: attachmentType,
      ...metricsPatch,
    };

    const { data, error } = await supabase.from('session_validations').update(row).eq('id', validationId).select().single();
    if (error || !data) {
      captureError('updateValidation error', error);
      return { error: error?.message ?? 'Erreur inconnue' };
    }
    setValidations(prev => prev.map(v => v.id === validationId ? toValidation(data) : v));
    return {};
  }, [setValidations]);

  return useMemo(() => ({
    validateSession, updateValidation,
  }), [validateSession, updateValidation]);
}
