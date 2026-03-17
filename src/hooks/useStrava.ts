import { useState, useCallback } from 'react';
import { callEdgeFunction } from '../lib/supabase';
import type { StravaConnectionStatus, StravaAthleteStats, StravaActivity, StravaHeartRateZone } from '../types';

interface UseStravaReturn {
  connectionStatus: StravaConnectionStatus | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  athleteStats: StravaAthleteStats | null;
  recentActivities: StravaActivity[];
  hrZones: StravaHeartRateZone[];
  checkConnection: () => Promise<void>;
  connect: (code: string) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchRecentActivities: (perPage?: number) => Promise<void>;
  fetchZones: () => Promise<void>;
  syncActivities: () => Promise<number>;
}

export function useStrava(targetUserId?: string): UseStravaReturn {
  const [connectionStatus, setConnectionStatus] = useState<StravaConnectionStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [athleteStats, setAthleteStats] = useState<StravaAthleteStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<StravaActivity[]>([]);
  const [hrZones, setHrZones] = useState<StravaHeartRateZone[]>([]);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await callEdgeFunction<{ connected: boolean; connection: StravaConnectionStatus | null }>(
      'strava-api',
      { action: 'status', target_user_id: targetUserId }
    );
    setLoading(false);
    if (err) { setError(err); return; }
    setConnected(data?.connected ?? false);
    setConnectionStatus(data?.connection ?? null);
  }, [targetUserId]);

  const connect = useCallback(async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await callEdgeFunction<{ success: boolean; strava_athlete_id: number }>(
      'strava-auth',
      { action: 'exchange', code }
    );
    setLoading(false);
    if (err) { setError(err); return false; }
    if (data?.success) {
      setConnected(true);
      setConnectionStatus({
        strava_athlete_id: data.strava_athlete_id,
        scope_granted: 'activity:read_all,profile:read_all',
        connected_at: new Date().toISOString(),
        is_active: true,
      });
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const { error: err } = await callEdgeFunction('strava-auth', { action: 'disconnect' });
    setLoading(false);
    if (err) { setError(err); return false; }
    setConnected(false);
    setConnectionStatus(null);
    setAthleteStats(null);
    setRecentActivities([]);
    setHrZones([]);
    return true;
  }, []);

  const fetchStats = useCallback(async () => {
    setError(null);
    const { data, error: err } = await callEdgeFunction<StravaAthleteStats>(
      'strava-api',
      { action: 'athlete_stats', target_user_id: targetUserId }
    );
    if (err) { setError(err); return; }
    if (data) setAthleteStats(data);
  }, [targetUserId]);

  const fetchRecentActivities = useCallback(async (perPage = 5) => {
    setError(null);
    const { data, error: err } = await callEdgeFunction<StravaActivity[]>(
      'strava-api',
      { action: 'recent_activities', per_page: perPage, target_user_id: targetUserId }
    );
    if (err) { setError(err); return; }
    if (data) setRecentActivities(data);
  }, [targetUserId]);

  const fetchZones = useCallback(async () => {
    setError(null);
    const { data, error: err } = await callEdgeFunction<{ heart_rate: { zones: StravaHeartRateZone[] } }>(
      'strava-api',
      { action: 'athlete_zones', target_user_id: targetUserId }
    );
    if (err) { setError(err); return; }
    if (data?.heart_rate?.zones) setHrZones(data.heart_rate.zones);
  }, [targetUserId]);

  const syncActivities = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await callEdgeFunction<{ synced: number }>(
      'strava-api',
      { action: 'sync_activities', target_user_id: targetUserId }
    );
    setLoading(false);
    if (err) { setError(err); return 0; }
    return data?.synced ?? 0;
  }, [targetUserId]);

  return {
    connectionStatus, connected, loading, error,
    athleteStats, recentActivities, hrZones,
    checkConnection, connect, disconnect,
    fetchStats, fetchRecentActivities, fetchZones, syncActivities,
  };
}
