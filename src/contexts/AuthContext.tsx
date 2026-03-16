import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { User, NotificationPreferences } from '../types';
import { supabase } from '../lib/supabase';
import { SUPER_ADMIN_EMAIL } from '../lib/constants';

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  new_session: { in_app: true, email: true },
  palmares: { in_app: true, email: true },
  vma_update: { in_app: true, email: false },
  weekly_digest: { email: true },
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  impersonatedUser: User | null;
  effectiveUser: User | null;
  impersonate: (userId: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, firstname: string, lastname: string) => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);

  const isSuperAdmin = useMemo(() => user?.email === SUPER_ADMIN_EMAIL, [user?.email]);
  const isImpersonating = isSuperAdmin && impersonatedUser !== null;
  const effectiveUser = impersonatedUser ?? user;

  const loadProfile = useCallback(async (authId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authId)
      .single();
    if (error || !data) {
      setUser(null);
      return;
    }
    setUser({
      ...data,
      vma_history: data.vma_history || [],
      photo_url: data.photo_url || null,
      notification_preferences: data.notification_preferences || DEFAULT_NOTIFICATION_PREFS,
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.replace('/reset-password');
        return;
      }
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const signup = useCallback(async (email: string, password: string, firstname: string, lastname: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.user) return 'Erreur lors de la creation du compte';

    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      role: 'athlete',
      firstname,
      lastname,
      email,
      vma: null,
      vma_history: [],
      group_id: null,
      phone: null,
      strava_id: null,
      is_public: true,
    });
    if (insertError) return insertError.message;
    return null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return error.message;
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    if (user?.id) await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const impersonate = useCallback(async (userId: string | null) => {
    if (!userId) {
      setImpersonatedUser(null);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return;
    setImpersonatedUser({
      ...data,
      vma_history: data.vma_history || [],
      photo_url: data.photo_url || null,
      notification_preferences: data.notification_preferences || DEFAULT_NOTIFICATION_PREFS,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isSuperAdmin, isImpersonating, impersonatedUser, effectiveUser, impersonate, login, signup, logout, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
