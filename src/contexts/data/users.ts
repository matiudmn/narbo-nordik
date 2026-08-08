import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User, SessionValidation, RaceResult, RaceNordik, SessionNordik, NotificationPreferences } from '../../types';
import { supabase, createEphemeralClient } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { toUser, asUserUpdate } from './rows';

export interface AddUserResult {
  userId: string;
  tempPassword: string;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = 'Narbo';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Extrait le chemin storage (`<user_id>/avatar.<ext>`) d'une URL publique du
// bucket avatars. Renvoie null pour un base64 `data:` historique ou toute
// autre valeur qui n'est pas une URL du bucket.
function storagePathFromAvatarUrl(url: string): string | null {
  const marker = '/avatars/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

interface UserActionsSetters {
  setUsers: Dispatch<SetStateAction<User[]>>;
  setValidations: Dispatch<SetStateAction<SessionValidation[]>>;
  setRaceResults: Dispatch<SetStateAction<RaceResult[]>>;
  setRaceNordiks: Dispatch<SetStateAction<RaceNordik[]>>;
  setSessionNordiks: Dispatch<SetStateAction<SessionNordik[]>>;
}

export function useUserActions({ setUsers, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks }: UserActionsSetters) {
  const patchUser = useCallback(async (userId: string, updates: Partial<User>): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('users').update(asUserUpdate(updates)).eq('id', userId);
    if (error) {
      captureError('patchUser error', error);
      return { error: error.message };
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    return { error: null };
  }, [setUsers]);

  // Historique VMA reconstruit à partir de la donnée fraîche en base (pas de l'état
  // React, potentiellement obsolète) pour éviter une entrée perdue ou dupliquée en
  // cas de double-clic.
  const updateUserVma = useCallback(async (userId: string, vma: number, reason?: string): Promise<{ error: string | null }> => {
    // Non atomique (select puis update) : une fenêtre de course résiduelle entre deux
    // appareils différents reste possible. Limite acceptée, la garde anti double-clic
    // côté UI (appelants) couvre le cas courant du double-tap sur un même appareil.
    const { data: existing, error: fetchError } = await supabase.from('users').select('vma_history').eq('id', userId).single();
    if (fetchError || !existing) {
      captureError('updateUserVma error', fetchError);
      return { error: fetchError?.message ?? 'Utilisateur introuvable' };
    }
    const entry: { vma: number; date: string; reason?: string } = { vma, date: new Date().toISOString().split('T')[0] };
    if (reason) entry.reason = reason;
    const history = [...((existing.vma_history as unknown as User['vma_history']) ?? []), entry];
    return patchUser(userId, { vma, vma_history: history } as Partial<User>);
  }, [patchUser]);

  const updateUserPublic = useCallback(async (userId: string, isPublic: boolean) => {
    return patchUser(userId, { is_public: isPublic });
  }, [patchUser]);

  const updateUserPhone = useCallback(async (userId: string, phone: string | null) => {
    return patchUser(userId, { phone });
  }, [patchUser]);

  const updateUserLicense = useCallback(async (userId: string, licenseNumber: string | null) => {
    return patchUser(userId, { license_number: licenseNumber });
  }, [patchUser]);

  const updateUserBirthDate = useCallback(async (userId: string, birthDate: string | null) => {
    return patchUser(userId, { birth_date: birthDate });
  }, [patchUser]);

  // Ancien objet supprimé seulement s'il s'agit d'une URL de storage (pas d'un
  // base64 `data:` historique, qui n'a jamais eu d'objet à nettoyer).
  const updateUserPhoto = useCallback(async (userId: string, file: File | null): Promise<{ error: string | null }> => {
    const { data: existing } = await supabase.from('users').select('photo_url').eq('id', userId).single();
    const previousUrl = existing?.photo_url as string | null | undefined;
    const previousPath = previousUrl ? storagePathFromAvatarUrl(previousUrl) : null;

    if (!file) {
      if (previousPath) await supabase.storage.from('avatars').remove([previousPath]);
      return patchUser(userId, { photo_url: null });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (uploadError) {
      console.error('updateUserPhoto upload error:', uploadError.message);
      return { error: uploadError.message };
    }
    if (previousPath && previousPath !== filePath) {
      await supabase.storage.from('avatars').remove([previousPath]);
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return patchUser(userId, { photo_url: `${urlData.publicUrl}?t=${Date.now()}` });
  }, [patchUser]);

  const updateNotificationPreferences = useCallback(async (userId: string, prefs: NotificationPreferences) => {
    return patchUser(userId, { notification_preferences: prefs });
  }, [patchUser]);

  const addUser = useCallback(async (
    userData: Omit<User, 'id' | 'created_at' | 'vma_history' | 'photo_url' | 'license_number' | 'birth_date' | 'notification_preferences' | 'email'> & { email: string }
  ): Promise<AddUserResult | null> => {
    const tempPassword = generateTempPassword();
    const ephemeral = createEphemeralClient();

    const { data: signUpData, error: signUpError } = await ephemeral.auth.signUp({
      email: userData.email,
      password: tempPassword,
    });

    if (signUpError || !signUpData.user) {
      captureError('SignUp error', signUpError);
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
      is_public: userData.is_public,
    }).select().single();

    if (insertError || !data) {
      captureError('Insert profile error', insertError);
      return null;
    }

    setUsers(prev => [...prev, toUser(data)]);
    return { userId: newUserId, tempPassword };
  }, [setUsers]);

  const deleteUser = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      captureError('deleteUser error', error);
      return { error: error.message };
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    setValidations(prev => prev.filter(v => v.user_id !== id));
    setRaceResults(prev => prev.filter(r => r.user_id !== id));
    setRaceNordiks(prev => prev.filter(n => n.user_id !== id));
    setSessionNordiks(prev => prev.filter(n => n.user_id !== id));
    return { error: null };
  }, [setUsers, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks]);

  return useMemo(() => ({
    updateUserVma, updateUserPublic, updateUserPhone, updateUserLicense, updateUserBirthDate, updateUserPhoto,
    updateNotificationPreferences, addUser, deleteUser,
  }), [updateUserVma, updateUserPublic, updateUserPhone, updateUserLicense, updateUserBirthDate, updateUserPhoto, updateNotificationPreferences, addUser, deleteUser]);
}
