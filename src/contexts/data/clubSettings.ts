import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ClubSettings, RacePaceConfig, AllureZoneConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toClubSettings, asClubSettingsPayload } from './rows';

interface ClubSettingsActionsState {
  clubSettings: ClubSettings | null;
  setClubSettings: Dispatch<SetStateAction<ClubSettings | null>>;
}

export function useClubSettingsActions(
  { clubSettings, setClubSettings }: ClubSettingsActionsState,
  authUserId: string | undefined
) {
  const updateClubSettings = useCallback(async (racePaces: Record<string, RacePaceConfig>, allureZones: Record<string, AllureZoneConfig>, inviteCode?: string): Promise<{ error: string | null }> => {
    const payload = asClubSettingsPayload(racePaces, allureZones, authUserId, inviteCode);
    if (clubSettings) {
      const { error } = await supabase.from('club_settings').update(payload).eq('id', clubSettings.id);
      if (error) {
        captureError('updateClubSettings error', error);
        return { error: error.message };
      }
      setClubSettings(prev => prev ? { ...prev, race_paces: racePaces, allure_zones: allureZones, ...(inviteCode !== undefined ? { invite_code: inviteCode } : {}) } : prev);
    } else {
      const { data, error } = await supabase.from('club_settings').insert(payload).select().single();
      if (error || !data) {
        captureError('updateClubSettings error', error);
        return { error: error?.message ?? 'Aucune donnee retournee par Supabase' };
      }
      setClubSettings(toClubSettings(data));
    }
    return { error: null };
  }, [clubSettings, authUserId, setClubSettings]);

  const setFeaturedValidation = useCallback(async (validationId: string | null): Promise<{ error: string | null }> => {
    // Une ligne club_settings est toujours seedée. On ne fait QUE de l'update :
    // jamais d'insert partiel (qui créerait une 2e ligne aux allures vides).
    if (!clubSettings) return { error: 'Parametres du club non initialises' };
    const featured_at = validationId ? new Date().toISOString() : null;
    const { error } = await supabase.from('club_settings')
      .update({ featured_validation_id: validationId, featured_at })
      .eq('id', clubSettings.id);
    if (error) {
      captureError('setFeaturedValidation error', error);
      return { error: error.message };
    }
    setClubSettings(prev => prev ? { ...prev, featured_validation_id: validationId, featured_at } : prev);
    return { error: null };
  }, [clubSettings, setClubSettings]);

  return useMemo(() => ({
    updateClubSettings, setFeaturedValidation,
  }), [updateClubSettings, setFeaturedValidation]);
}
