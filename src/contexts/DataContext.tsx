import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Session, SessionValidation, RaceResult, RaceNordik, Group, User, NotificationPreferences, SpecificPreparation, UserPreparation } from '../types';
import { supabase, createEphemeralClient } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface AddUserResult {
  userId: string;
  tempPassword: string;
}

interface DataContextType {
  sessions: Session[];
  validations: SessionValidation[];
  raceResults: RaceResult[];
  raceNordiks: RaceNordik[];
  groups: Group[];
  users: User[];
  preparations: SpecificPreparation[];
  userPreparations: UserPreparation[];
  loading: boolean;
  addSession: (session: Omit<Session, 'id' | 'created_at'>) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  validateSession: (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File) => Promise<void>;
  addRaceResult: (result: Omit<RaceResult, 'id' | 'created_at'>) => Promise<void>;
  deleteRaceResult: (id: string) => Promise<void>;
  toggleNordik: (raceId: string, userId: string) => Promise<void>;
  updateUserVma: (userId: string, vma: number, reason?: string) => Promise<void>;
  updateUserPublic: (userId: string, isPublic: boolean) => Promise<void>;
  updateUserPhone: (userId: string, phone: string | null) => Promise<void>;
  updateUserStrava: (userId: string, stravaId: string | null) => Promise<void>;
  updateUserLicense: (userId: string, licenseNumber: string | null) => Promise<void>;
  updateUserBirthDate: (userId: string, birthDate: string | null) => Promise<void>;
  updateUserPhoto: (userId: string, photoUrl: string | null) => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'created_at' | 'vma_history' | 'photo_url' | 'license_number' | 'birth_date' | 'notification_preferences'>) => Promise<AddUserResult | null>;
  deleteUser: (id: string) => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  updateUserGroup: (userId: string, groupId: string | null) => Promise<void>;
  updateNotificationPreferences: (userId: string, prefs: NotificationPreferences) => Promise<void>;
  addPreparation: (name: string, eventDate: string, description: string | null) => Promise<void>;
  updatePreparation: (id: string, updates: Partial<SpecificPreparation>) => Promise<void>;
  deletePreparation: (id: string) => Promise<void>;
  addUserToPreparation: (userId: string, preparationId: string) => Promise<void>;
  removeUserFromPreparation: (userId: string, preparationId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = 'Narbo';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [validations, setValidations] = useState<SessionValidation[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [raceNordiks, setRaceNordiks] = useState<RaceNordik[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [preparations, setPreparations] = useState<SpecificPreparation[]>([]);
  const [userPreparations, setUserPreparations] = useState<UserPreparation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase.from('sessions').select('*').order('date');
    if (data) setSessions(data.map(s => ({ ...s, blocks: s.blocks || [] })));
  }, []);

  const fetchValidations = useCallback(async () => {
    const { data } = await supabase.from('session_validations').select('*');
    if (data) setValidations(data);
  }, []);

  const fetchRaceResults = useCallback(async () => {
    const { data } = await supabase.from('race_results').select('*');
    if (data) setRaceResults(data);
  }, []);

  const fetchRaceNordiks = useCallback(async () => {
    const { data } = await supabase.from('race_nordiks').select('*');
    if (data) setRaceNordiks(data);
  }, []);

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*');
    if (data) setGroups(data);
  }, []);

  const fetchPreparations = useCallback(async () => {
    const { data } = await supabase.from('specific_preparations').select('*').order('event_date');
    if (data) setPreparations(data);
  }, []);

  const fetchUserPreparations = useCallback(async () => {
    const { data } = await supabase.from('user_preparations').select('*');
    if (data) setUserPreparations(data);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data.map(u => ({
      ...u,
      vma_history: u.vma_history || [],
      photo_url: u.photo_url || null,
      notification_preferences: u.notification_preferences || {
        new_session: { in_app: true, email: true },
        palmares: { in_app: true, email: true },
        vma_update: { in_app: true, email: false },
        weekly_digest: { email: true },
      },
    })));
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchSessions(),
      fetchValidations(),
      fetchRaceResults(),
      fetchRaceNordiks(),
      fetchGroups(),
      fetchUsers(),
      fetchPreparations(),
      fetchUserPreparations(),
    ]);
    setLoading(false);
  }, [fetchSessions, fetchValidations, fetchRaceResults, fetchRaceNordiks, fetchGroups, fetchUsers, fetchPreparations, fetchUserPreparations]);

  useEffect(() => {
    if (authUser) {
      refreshAll();
    } else {
      setSessions([]);
      setValidations([]);
      setRaceResults([]);
      setRaceNordiks([]);
      setGroups([]);
      setUsers([]);
      setPreparations([]);
      setUserPreparations([]);
      setLoading(false);
    }
  }, [authUser, refreshAll]);

  const addSession = useCallback(async (session: Omit<Session, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('sessions').insert(session);
    if (!error) await fetchSessions();
  }, [fetchSessions]);

  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const { error } = await supabase.from('sessions').update(updates).eq('id', id);
    if (!error) await fetchSessions();
  }, [fetchSessions]);

  const deleteSession = useCallback(async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (!error) {
      await fetchSessions();
      await fetchValidations();
    }
  }, [fetchSessions, fetchValidations]);

  const validateSession = useCallback(async (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File) => {
    let attachmentPath: string | null = null;
    let attachmentType: string | null = null;

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const filePath = `${userId}/${sessionId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('session-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        console.error('Upload error:', uploadError.message);
        return;
      }
      attachmentPath = filePath;
      attachmentType = file.type;
    }

    const { error } = await supabase.from('session_validations').upsert(
      {
        session_id: sessionId,
        user_id: userId,
        status,
        feedback: feedback || null,
        attachment_path: attachmentPath,
        attachment_type: attachmentType,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' }
    );
    if (!error) await fetchValidations();
  }, [fetchValidations]);

  const addRaceResult = useCallback(async (result: Omit<RaceResult, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('race_results').insert(result);
    if (!error) await fetchRaceResults();
  }, [fetchRaceResults]);

  const deleteRaceResult = useCallback(async (id: string) => {
    const { error } = await supabase.from('race_results').delete().eq('id', id);
    if (!error) {
      await fetchRaceResults();
      await fetchRaceNordiks();
    }
  }, [fetchRaceResults, fetchRaceNordiks]);

  const toggleNordik = useCallback(async (raceId: string, userId: string) => {
    const existing = raceNordiks.find(n => n.race_id === raceId && n.user_id === userId);
    if (existing) {
      await supabase.from('race_nordiks').delete().eq('id', existing.id);
    } else {
      await supabase.from('race_nordiks').insert({ race_id: raceId, user_id: userId });
    }
    await fetchRaceNordiks();
  }, [raceNordiks, fetchRaceNordiks]);

  const updateUserVma = useCallback(async (userId: string, vma: number, reason?: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const entry: { vma: number; date: string; reason?: string } = { vma, date: new Date().toISOString().split('T')[0] };
    if (reason) entry.reason = reason;
    const history = [...targetUser.vma_history, entry];
    const { error } = await supabase.from('users').update({ vma, vma_history: history }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [users, fetchUsers]);

  const updateUserPublic = useCallback(async (userId: string, isPublic: boolean) => {
    const { error } = await supabase.from('users').update({ is_public: isPublic }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateUserPhone = useCallback(async (userId: string, phone: string | null) => {
    const { error } = await supabase.from('users').update({ phone }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateUserStrava = useCallback(async (userId: string, stravaId: string | null) => {
    const { error } = await supabase.from('users').update({ strava_id: stravaId }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateUserLicense = useCallback(async (userId: string, licenseNumber: string | null) => {
    const { error } = await supabase.from('users').update({ license_number: licenseNumber }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateUserBirthDate = useCallback(async (userId: string, birthDate: string | null) => {
    const { error } = await supabase.from('users').update({ birth_date: birthDate }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateUserPhoto = useCallback(async (userId: string, photoUrl: string | null) => {
    const { error } = await supabase.from('users').update({ photo_url: photoUrl }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const addUser = useCallback(async (
    userData: Omit<User, 'id' | 'created_at' | 'vma_history' | 'photo_url' | 'license_number' | 'birth_date' | 'notification_preferences'>
  ): Promise<AddUserResult | null> => {
    const tempPassword = generateTempPassword();
    const ephemeral = createEphemeralClient();

    const { data: signUpData, error: signUpError } = await ephemeral.auth.signUp({
      email: userData.email,
      password: tempPassword,
    });

    if (signUpError || !signUpData.user) {
      console.error('SignUp error:', signUpError?.message);
      return null;
    }

    const newUserId = signUpData.user.id;
    const vmaHistory = userData.vma ? [{ vma: userData.vma, date: new Date().toISOString().split('T')[0] }] : [];

    const { error: insertError } = await supabase.from('users').insert({
      id: newUserId,
      role: userData.role,
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: userData.email,
      vma: userData.vma,
      vma_history: vmaHistory,
      group_id: userData.group_id,
      phone: userData.phone,
      strava_id: userData.strava_id,
      is_public: userData.is_public,
    });

    if (insertError) {
      console.error('Insert profile error:', insertError.message);
      return null;
    }

    await fetchUsers();
    return { userId: newUserId, tempPassword };
  }, [fetchUsers]);

  const deleteUser = useCallback(async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) {
      await Promise.all([fetchUsers(), fetchValidations(), fetchRaceResults(), fetchRaceNordiks()]);
    }
  }, [fetchUsers, fetchValidations, fetchRaceResults, fetchRaceNordiks]);

  const addGroup = useCallback(async (name: string) => {
    const { error } = await supabase.from('groups').insert({ name });
    if (!error) await fetchGroups();
  }, [fetchGroups]);

  const updateGroup = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('groups').update({ name }).eq('id', id);
    if (!error) await fetchGroups();
  }, [fetchGroups]);

  const deleteGroup = useCallback(async (id: string) => {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (!error) {
      await Promise.all([fetchGroups(), fetchUsers(), fetchSessions()]);
    }
  }, [fetchGroups, fetchUsers, fetchSessions]);

  const updateUserGroup = useCallback(async (userId: string, groupId: string | null) => {
    const { error } = await supabase.from('users').update({ group_id: groupId }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const updateNotificationPreferences = useCallback(async (userId: string, prefs: NotificationPreferences) => {
    const { error } = await supabase.from('users').update({ notification_preferences: prefs }).eq('id', userId);
    if (!error) await fetchUsers();
  }, [fetchUsers]);

  const addPreparation = useCallback(async (name: string, eventDate: string, description: string | null) => {
    const { error } = await supabase.from('specific_preparations').insert({
      name, event_date: eventDate, description, created_by: authUser?.id,
    });
    if (!error) await fetchPreparations();
  }, [authUser?.id, fetchPreparations]);

  const updatePreparation = useCallback(async (id: string, updates: Partial<SpecificPreparation>) => {
    const { error } = await supabase.from('specific_preparations').update(updates).eq('id', id);
    if (!error) await fetchPreparations();
  }, [fetchPreparations]);

  const deletePreparation = useCallback(async (id: string) => {
    const { error } = await supabase.from('specific_preparations').delete().eq('id', id);
    if (!error) await Promise.all([fetchPreparations(), fetchUserPreparations(), fetchSessions()]);
  }, [fetchPreparations, fetchUserPreparations, fetchSessions]);

  const addUserToPreparation = useCallback(async (userId: string, preparationId: string) => {
    const { error } = await supabase.from('user_preparations').insert({ user_id: userId, preparation_id: preparationId });
    if (!error) await fetchUserPreparations();
  }, [fetchUserPreparations]);

  const removeUserFromPreparation = useCallback(async (userId: string, preparationId: string) => {
    const { error } = await supabase.from('user_preparations').delete()
      .eq('user_id', userId).eq('preparation_id', preparationId);
    if (!error) await fetchUserPreparations();
  }, [fetchUserPreparations]);

  return (
    <DataContext.Provider value={{
      sessions, validations, raceResults, raceNordiks, groups, users, preparations, userPreparations, loading,
      addSession, updateSession, deleteSession, validateSession,
      addRaceResult, deleteRaceResult, toggleNordik, updateUserVma, updateUserPublic, updateUserPhone, updateUserStrava, updateUserLicense, updateUserBirthDate, updateUserPhoto,
      addUser, deleteUser, addGroup, updateGroup, deleteGroup, updateUserGroup, updateNotificationPreferences,
      addPreparation, updatePreparation, deletePreparation, addUserToPreparation, removeUserFromPreparation, refreshAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
