import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Session, SessionValidation, RaceResult, RaceNordik, Group, User, NotificationPreferences, SpecificPreparation, UserPreparation, ObjectiveReached, Sensations } from '../types';
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
  addSession: (session: Omit<Session, 'id' | 'created_at'>) => Promise<string | null>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  validateSession: (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File, objectiveReached?: ObjectiveReached, sensations?: Sensations) => Promise<void>;
  updateValidation: (validationId: string, updates: { feedback?: string; objective_reached?: ObjectiveReached | null; sensations?: Sensations | null }, file?: File) => Promise<void>;
  addRaceResult: (result: Omit<RaceResult, 'id' | 'created_at'>) => Promise<void>;
  updateRaceResult: (id: string, updates: Partial<Omit<RaceResult, 'id' | 'created_at'>>) => Promise<void>;
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

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  new_session: { in_app: true, email: true },
  palmares: { in_app: true, email: true },
  vma_update: { in_app: true, email: false },
  weekly_digest: { email: true },
};

function normalizeUser(u: Record<string, unknown>): User {
  return {
    ...u,
    vma_history: (u.vma_history as User['vma_history']) || [],
    photo_url: (u.photo_url as string) || null,
    notification_preferences: (u.notification_preferences as NotificationPreferences) || DEFAULT_NOTIF_PREFS,
  } as User;
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

  const fetchAll = useCallback(async () => {
    const [s, v, rr, rn, g, u, p, up] = await Promise.all([
      supabase.from('sessions').select('*').order('date'),
      supabase.from('session_validations').select('*'),
      supabase.from('race_results').select('*'),
      supabase.from('race_nordiks').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('users').select('*'),
      supabase.from('specific_preparations').select('*').order('event_date'),
      supabase.from('user_preparations').select('*'),
    ]);
    if (s.data) setSessions(s.data.map(d => ({ ...d, blocks: d.blocks || [] })));
    if (v.data) setValidations(v.data);
    if (rr.data) setRaceResults(rr.data);
    if (rn.data) setRaceNordiks(rn.data);
    if (g.data) setGroups(g.data);
    if (u.data) setUsers(u.data.map(normalizeUser));
    if (p.data) setPreparations(p.data);
    if (up.data) setUserPreparations(up.data);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

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

  // --- Sessions ---

  const addSession = useCallback(async (session: Omit<Session, 'id' | 'created_at'>): Promise<string | null> => {
    const { data, error } = await supabase.from('sessions').insert(session).select().single();
    if (!error && data) {
      setSessions(prev => [...prev, { ...data, blocks: data.blocks || [] }].sort((a, b) => a.date.localeCompare(b.date)));
      return data.id;
    }
    return null;
  }, []);

  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const { error } = await supabase.from('sessions').update(updates).eq('id', id);
    if (!error) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== id));
      setValidations(prev => prev.filter(v => v.session_id !== id));
    }
  }, []);

  // --- Validations ---

  const validateSession = useCallback(async (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File, objectiveReached?: ObjectiveReached, sensations?: Sensations) => {
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

    const row = {
      session_id: sessionId,
      user_id: userId,
      status,
      feedback: feedback || null,
      attachment_path: attachmentPath,
      attachment_type: attachmentType,
      objective_reached: objectiveReached || null,
      sensations: sensations || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('session_validations').upsert(
      row,
      { onConflict: 'session_id,user_id' }
    ).select().single();

    if (!error && data) {
      setValidations(prev => {
        const idx = prev.findIndex(v => v.session_id === sessionId && v.user_id === userId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
    }
  }, []);

  const updateValidation = useCallback(async (validationId: string, updates: { feedback?: string; objective_reached?: ObjectiveReached | null; sensations?: Sensations | null }, file?: File) => {
    const existing = validations.find(v => v.id === validationId);
    if (!existing) return;

    let attachmentPath = existing.attachment_path;
    let attachmentType = existing.attachment_type;

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const filePath = `${existing.user_id}/${existing.session_id}/${Date.now()}.${ext}`;
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

    const row = {
      feedback: updates.feedback ?? existing.feedback,
      objective_reached: updates.objective_reached !== undefined ? updates.objective_reached : existing.objective_reached,
      sensations: updates.sensations !== undefined ? updates.sensations : existing.sensations,
      attachment_path: attachmentPath,
      attachment_type: attachmentType,
    };

    const { data, error } = await supabase.from('session_validations').update(row).eq('id', validationId).select().single();
    if (!error && data) {
      setValidations(prev => prev.map(v => v.id === validationId ? data : v));
    }
  }, [validations]);

  // --- Race Results ---

  const addRaceResult = useCallback(async (result: Omit<RaceResult, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('race_results').insert(result).select().single();
    if (!error && data) setRaceResults(prev => [...prev, data]);
  }, []);

  const updateRaceResult = useCallback(async (id: string, updates: Partial<Omit<RaceResult, 'id' | 'created_at'>>) => {
    setRaceResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const { error } = await supabase.from('race_results').update(updates).eq('id', id);
    if (error) {
      const { data } = await supabase.from('race_results').select('*');
      if (data) setRaceResults(data);
    }
  }, []);

  const deleteRaceResult = useCallback(async (id: string) => {
    const { error } = await supabase.from('race_results').delete().eq('id', id);
    if (!error) {
      setRaceResults(prev => prev.filter(r => r.id !== id));
      setRaceNordiks(prev => prev.filter(n => n.race_id !== id));
    }
  }, []);

  // --- Nordiks ---

  const toggleNordik = useCallback(async (raceId: string, userId: string) => {
    const existing = raceNordiks.find(n => n.race_id === raceId && n.user_id === userId);
    if (existing) {
      const { error } = await supabase.from('race_nordiks').delete().eq('id', existing.id);
      if (!error) setRaceNordiks(prev => prev.filter(n => n.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('race_nordiks').insert({ race_id: raceId, user_id: userId }).select().single();
      if (!error && data) setRaceNordiks(prev => [...prev, data]);
    }
  }, [raceNordiks]);

  // --- Users ---

  const patchUser = useCallback(async (userId: string, updates: Partial<User>) => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    }
  }, []);

  const updateUserVma = useCallback(async (userId: string, vma: number, reason?: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const entry: { vma: number; date: string; reason?: string } = { vma, date: new Date().toISOString().split('T')[0] };
    if (reason) entry.reason = reason;
    const history = [...targetUser.vma_history, entry];
    await patchUser(userId, { vma, vma_history: history } as Partial<User>);
  }, [users, patchUser]);

  const updateUserPublic = useCallback(async (userId: string, isPublic: boolean) => {
    await patchUser(userId, { is_public: isPublic });
  }, [patchUser]);

  const updateUserPhone = useCallback(async (userId: string, phone: string | null) => {
    await patchUser(userId, { phone });
  }, [patchUser]);

  const updateUserStrava = useCallback(async (userId: string, stravaId: string | null) => {
    await patchUser(userId, { strava_id: stravaId });
  }, [patchUser]);

  const updateUserLicense = useCallback(async (userId: string, licenseNumber: string | null) => {
    await patchUser(userId, { license_number: licenseNumber });
  }, [patchUser]);

  const updateUserBirthDate = useCallback(async (userId: string, birthDate: string | null) => {
    await patchUser(userId, { birth_date: birthDate });
  }, [patchUser]);

  const updateUserPhoto = useCallback(async (userId: string, photoUrl: string | null) => {
    await patchUser(userId, { photo_url: photoUrl });
  }, [patchUser]);

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

    const { data, error: insertError } = await supabase.from('users').insert({
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
    }).select().single();

    if (insertError || !data) {
      console.error('Insert profile error:', insertError?.message);
      return null;
    }

    setUsers(prev => [...prev, normalizeUser(data)]);
    return { userId: newUserId, tempPassword };
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setValidations(prev => prev.filter(v => v.user_id !== id));
      setRaceResults(prev => prev.filter(r => r.user_id !== id));
      setRaceNordiks(prev => prev.filter(n => n.user_id !== id));
    }
  }, []);

  // --- Groups ---

  const addGroup = useCallback(async (name: string) => {
    const { data, error } = await supabase.from('groups').insert({ name }).select().single();
    if (!error && data) setGroups(prev => [...prev, data]);
  }, []);

  const updateGroup = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('groups').update({ name }).eq('id', id);
    if (!error) setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (!error) {
      setGroups(prev => prev.filter(g => g.id !== id));
      setUsers(prev => prev.map(u => u.group_id === id ? { ...u, group_id: null } : u));
      setSessions(prev => prev.map(s => s.group_id === id ? { ...s, group_id: null } : s));
    }
  }, []);

  const updateUserGroup = useCallback(async (userId: string, groupId: string | null) => {
    await patchUser(userId, { group_id: groupId });
  }, [patchUser]);

  const updateNotificationPreferences = useCallback(async (userId: string, prefs: NotificationPreferences) => {
    await patchUser(userId, { notification_preferences: prefs });
  }, [patchUser]);

  // --- Preparations ---

  const addPreparation = useCallback(async (name: string, eventDate: string, description: string | null) => {
    const { data, error } = await supabase.from('specific_preparations').insert({
      name, event_date: eventDate, description, created_by: authUser?.id,
    }).select().single();
    if (!error && data) setPreparations(prev => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
  }, [authUser?.id]);

  const updatePreparation = useCallback(async (id: string, updates: Partial<SpecificPreparation>) => {
    const { error } = await supabase.from('specific_preparations').update(updates).eq('id', id);
    if (!error) setPreparations(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePreparation = useCallback(async (id: string) => {
    const { error } = await supabase.from('specific_preparations').delete().eq('id', id);
    if (!error) {
      setPreparations(prev => prev.filter(p => p.id !== id));
      setUserPreparations(prev => prev.filter(up => up.preparation_id !== id));
      setSessions(prev => prev.map(s => s.preparation_id === id ? { ...s, preparation_id: null } : s));
    }
  }, []);

  const addUserToPreparation = useCallback(async (userId: string, preparationId: string) => {
    const { data, error } = await supabase.from('user_preparations').insert({ user_id: userId, preparation_id: preparationId }).select().single();
    if (!error && data) setUserPreparations(prev => [...prev, data]);
  }, []);

  const removeUserFromPreparation = useCallback(async (userId: string, preparationId: string) => {
    const { error } = await supabase.from('user_preparations').delete()
      .eq('user_id', userId).eq('preparation_id', preparationId);
    if (!error) {
      setUserPreparations(prev => prev.filter(up => !(up.user_id === userId && up.preparation_id === preparationId)));
    }
  }, []);

  return (
    <DataContext.Provider value={{
      sessions, validations, raceResults, raceNordiks, groups, users, preparations, userPreparations, loading,
      addSession, updateSession, deleteSession, validateSession, updateValidation,
      addRaceResult, updateRaceResult, deleteRaceResult, toggleNordik, updateUserVma, updateUserPublic, updateUserPhone, updateUserStrava, updateUserLicense, updateUserBirthDate, updateUserPhoto,
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
