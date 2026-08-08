import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { toUser } from './data/rows';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  impersonatedUser: User | null;
  effectiveUser: User | null;
  impersonate: (userId: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, firstname: string, lastname: string, inviteCode: string) => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type RegisterProfileArgs = { invite_code: string; firstname: string; lastname: string; email: string };

// RPC register_profile (migration 20260731130000) : absente des types generes
// tant que la migration n'est pas appliquee en prod et que `npm run gen:types`
// n'a pas tourne (voir flagsPourMatthieu). Cast local le temps du regen ; a
// retirer ensuite pour retrouver l'inference normale de `supabase.rpc`.
function registerProfile(args: RegisterProfileArgs) {
  return (
    supabase.rpc as unknown as (
      fn: 'register_profile',
      args: RegisterProfileArgs
    ) => Promise<{ error: { message: string } | null }>
  )('register_profile', args);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);

  const isSuperAdmin = useMemo(() => user?.is_super_admin === true, [user?.is_super_admin]);
  const isImpersonating = isSuperAdmin && impersonatedUser !== null;
  const effectiveUser = impersonatedUser ?? user;

  // Passe par le RPC get_own_profile() (SECURITY DEFINER) plutot qu'un SELECT
  // direct : depuis la migration 20260731120000, `authenticated` n'a plus
  // l'email/le telephone/la licence/la date de naissance/les preferences de
  // notif en GRANT colonne sur `users`. auth.uid() identifie deja l'appelant
  // cote serveur, l'id client n'est plus necessaire ici.
  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_own_profile').single();
    if (error || !data) {
      setUser(null);
      return;
    }
    setUser(toUser(data));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile().finally(() => setLoading(false));
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
        loadProfile();
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

  const signup = useCallback(async (email: string, password: string, firstname: string, lastname: string, inviteCode: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.user) return 'Erreur lors de la creation du compte';

    // Insert direct remplace par le RPC register_profile (SECURITY DEFINER) :
    // il verifie le code d'invitation cote base avant de creer le profil (la
    // policy INSERT de `users` n'a plus de branche self-service depuis
    // 20260731130000_invite_code.sql).
    const { error: rpcError } = await registerProfile({ invite_code: inviteCode, firstname, lastname, email });
    if (rpcError) return rpcError.message;

    const { data: coaches } = await supabase.from('users').select('id').eq('role', 'coach');
    if (coaches && coaches.length > 0) {
      const { error: notifError } = await supabase.from('notifications').insert(
        coaches.map((coach) => ({
          user_id: coach.id,
          type: 'system',
          title: `Nouvelle inscription : ${firstname} ${lastname}`,
          body: `${firstname} ${lastname} (${email}) vient de créer son compte.`,
          link: '/coach',
        }))
      );
      if (notifError) console.error('Notification inscription error:', notifError.message);
    }

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

  const userId = user?.id;
  const refreshUser = useCallback(async () => {
    if (userId) await loadProfile();
  }, [userId, loadProfile]);

  // Passe par get_users_for_coach() : impersonate est reserve au super-admin
  // (bouton visible uniquement pour lui dans AthletesTab), et cette fonction
  // SECURITY DEFINER l'impose aussi cote serveur (42501 sinon). C'est la meme
  // fonction que celle qui alimente la liste club des vues coach, on y
  // retrouve donc directement la cible.
  const impersonate = useCallback(async (userId: string | null) => {
    if (!userId) {
      setImpersonatedUser(null);
      return;
    }
    const { data, error } = await supabase.rpc('get_users_for_coach');
    if (error || !data) return;
    const target = data.find(u => u.id === userId);
    if (!target) return;
    setImpersonatedUser(toUser(target));
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
