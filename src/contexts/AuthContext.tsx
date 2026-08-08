import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { clearSnapshot } from '../lib/offline-cache';
import { captureError } from '../lib/monitoring';
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

  const isSuperAdmin = useMemo(() => user?.is_super_admin === true, [user?.is_super_admin]);
  const isImpersonating = isSuperAdmin && impersonatedUser !== null;
  const effectiveUser = impersonatedUser ?? user;

  // Dernier id utilisateur charge (ref, pas de re-render) : sert uniquement
  // a detecter un changement d'utilisateur au sein de la meme page (session
  // Supabase remplacee sous nos pieds sans passer par logout(), ex.
  // SIGNED_OUT/SIGNED_IN enchaines) pour purger le cache offline avant qu'il
  // ne soit lu par un autre utilisateur. Le cas nominal (logout explicite)
  // est purge directement dans logout() ci-dessous.
  const lastUserIdRef = useRef<string | null>(null);

  // Purge best-effort du cache offline (src/lib/offline-cache.ts). Import
  // direct plutot qu'un event bus : offline-cache est un module feuille sans
  // dependance sur AuthContext/DataContext (les deux l'importent
  // directement, cf. contexts/data/bootstrap.ts), donc appeler clearSnapshot()
  // ici n'introduit aucun couplage AuthContext -> DataContext.
  const purgeOfflineCache = useCallback((scope: string) => {
    clearSnapshot().catch((err) => captureError(`offline-cache.purge.${scope}`, err));
  }, []);

  // Passe par le RPC get_own_profile() (SECURITY DEFINER) plutot qu'un SELECT
  // direct : depuis la migration 20260731120000, `authenticated` n'a plus
  // l'email/le telephone/la licence/la date de naissance/les preferences de
  // notif en GRANT colonne sur `users`. auth.uid() identifie deja l'appelant
  // cote serveur, l'id client n'est plus necessaire ici.
  const loadProfile = useCallback(async () => {
    const { data, error, status } = await supabase.rpc('get_own_profile').single();
    if (error || !data) {
      // Echec reseau (status 0, meme signature qu'isNetworkError dans
      // contexts/data/bootstrap.ts) : ne pas deconnecter un utilisateur deja
      // charge pour une simple coupure, sinon la coupure elle-meme renverrait
      // l'app a l'ecran de connexion (impossible de se reconnecter hors
      // ligne). On garde le profil deja en memoire tel quel et on ressort ;
      // DataContext gere l'hydratation offline des collections de son cote.
      if (error && status === 0) return;
      if (lastUserIdRef.current) purgeOfflineCache('session-lost');
      lastUserIdRef.current = null;
      setUser(null);
      return;
    }
    // Le cache offline porte les donnees PII d'un coach (get_users_for_coach) :
    // si l'id resolu differe du dernier connu (session remplacee sous nos
    // pieds sans logout() explicite), purge avant de laisser quiconque lire
    // le cache de l'utilisateur precedent.
    if (lastUserIdRef.current && lastUserIdRef.current !== data.id) purgeOfflineCache('user-switch');
    lastUserIdRef.current = data.id;
    setUser(toUser(data));
  }, [purgeOfflineCache]);

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
      is_public: true,
    });
    if (insertError) return insertError.message;

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
    lastUserIdRef.current = null;
    // Purge OBLIGATOIRE : le cache offline d'un coach porte les colonnes PII
    // de get_users_for_coach (email, telephone, licence, date de naissance).
    purgeOfflineCache('logout');
  }, [purgeOfflineCache]);

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
