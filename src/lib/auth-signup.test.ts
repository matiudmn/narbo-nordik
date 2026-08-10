import { describe, it, expect, vi } from 'vitest';
import { mapAuthError, signupWithInviteCode } from './auth-signup';

// Code d'invitation factice : le vrai code du club est un secret partagé par
// le club lui-même (WhatsApp), il n'a rien à faire dans le dépôt.
const INVITE_CODE = 'CODETEST';

const CREDS = {
  email: 'lea@example.com',
  password: 'motdepasse',
  firstname: 'Léa',
  lastname: 'Dupont',
  inviteCode: INVITE_CODE,
};

/**
 * Faux backend, fidèle à la séquence réelle du parcours d'inscription :
 *
 * - `signUp` échoue si l'adresse a déjà un compte Auth ; sinon il ouvre la
 *   session PUIS émet SIGNED_IN avant de rendre la main. onAuthStateChange
 *   (AuthContext) appelle alors `loadProfile()` sans l'attendre, d'où le
 *   `void loadProfile()` ci-dessous : c'est le coeur du bug 1.
 * - `registerProfile` reproduit le RPC `register_profile`
 *   (20260731130000_invite_code.sql) : 42501 sur code invalide, 23505 si la
 *   ligne `users` existe déjà, insertion sinon.
 * - `loadProfile` reproduit `get_own_profile` + setUser : il ne trouve rien
 *   tant que la ligne `users` n'existe pas et retombe alors sur setUser(null).
 */
function createBackend(
  seed: { authAccounts?: Record<string, string>; profiles?: string[]; withoutErrorCodes?: boolean } = {},
) {
  // `withoutErrorCodes` : instance GoTrue qui ne renvoie que le message, sans
  // `code` (le repli sur le message est ce qui décide de la reprise).
  const authCode = (code: string) => (seed.withoutErrorCodes ? undefined : code);
  const authAccounts = new Map(Object.entries(seed.authAccounts ?? {}));
  const profiles = new Set(seed.profiles ?? []);
  let session: string | null = null;
  // État `user` du contexte : null = l'écran de connexion reste affiché
  // (AppRoutes rend <Login /> tant que `user` est null).
  let user: string | null = null;
  // Ce que chaque passage de loadProfile a posé, dans l'ordre : sert à prouver
  // lequel des rechargements a vu le profil.
  const reloads: (string | null)[] = [];

  const loadProfile = vi.fn(async () => {
    user = session !== null && profiles.has(session) ? session : null;
    reloads.push(user);
  });

  const deps = {
    signUp: vi.fn(async ({ email, password }: { email: string; password: string }) => {
      if (authAccounts.has(email)) {
        return { data: { user: null }, error: { message: 'User already registered', code: authCode('user_already_exists') } };
      }
      authAccounts.set(email, password);
      session = email;
      void loadProfile();
      return { data: { user: { id: email } }, error: null };
    }),
    signIn: vi.fn(async ({ email, password }: { email: string; password: string }) => {
      if (authAccounts.get(email) !== password) {
        return { error: { message: 'Invalid login credentials', code: authCode('invalid_credentials') } };
      }
      session = email;
      void loadProfile();
      return { error: null };
    }),
    registerProfile: vi.fn(async ({ invite_code }: { invite_code: string }) => {
      if (invite_code !== INVITE_CODE) return { error: { message: "Code d'invitation invalide.", code: '42501' } };
      // register_profile insère sur auth.uid() : sans session, l'appel ne peut
      // pas aboutir. Invariant du banc d'essai, pas un cas métier.
      const uid = session;
      if (uid === null) throw new Error('register_profile appelé hors session');
      if (profiles.has(uid)) {
        return { error: { message: 'duplicate key value violates unique constraint "users_pkey"', code: '23505' } };
      }
      profiles.add(uid);
      return { error: null };
    }),
    loadProfile,
  };

  return {
    deps,
    reloads,
    hasAuthAccount: (email: string) => authAccounts.has(email),
    hasProfile: (email: string) => profiles.has(email),
    currentUser: () => user,
  };
}

describe("bug 1 : l'inscription réussie laisse l'athlète sur le formulaire", () => {
  it("fait entrer l'athlète dans l'app une fois le profil créé", async () => {
    const backend = createBackend();
    const message = await signupWithInviteCode(backend.deps, CREDS);
    expect(message).toBeNull();
    expect(backend.hasProfile(CREDS.email)).toBe(true);
    expect(backend.currentUser()).toBe(CREDS.email);
  });

  it('recharge le profil après register_profile, le SIGNED_IN de signUp arrivant trop tôt', async () => {
    const backend = createBackend();
    await signupWithInviteCode(backend.deps, CREDS);
    // Premier rechargement : celui d'onAuthStateChange, déclenché par le
    // SIGNED_IN de signUp alors que la ligne `users` n'existe pas encore.
    expect(backend.reloads[0]).toBeNull();
    // Dernier rechargement : celui qui doit suivre register_profile.
    expect(backend.reloads.at(-1)).toBe(CREDS.email);
  });
});

describe("bug 2 : un code d'invitation erroné brûle l'adresse e-mail", () => {
  it('refuse un code erroné, en laissant un compte Auth sans profil', async () => {
    const backend = createBackend();
    const message = await signupWithInviteCode(backend.deps, { ...CREDS, inviteCode: 'MAUVAIS' });
    expect(message).toBe("Code d'invitation invalide.");
    expect(backend.hasAuthAccount(CREDS.email)).toBe(true);
    expect(backend.hasProfile(CREDS.email)).toBe(false);
    expect(backend.currentUser()).toBeNull();
  });

  it("laisse reprendre l'inscription avec le bon code sur la même adresse", async () => {
    const backend = createBackend();
    await signupWithInviteCode(backend.deps, { ...CREDS, inviteCode: 'MAUVAIS' });
    const message = await signupWithInviteCode(backend.deps, CREDS);
    expect(message).toBeNull();
    expect(backend.hasProfile(CREDS.email)).toBe(true);
    expect(backend.currentUser()).toBe(CREDS.email);
  });

  it("renvoie un message français quand l'adresse appartient à quelqu'un d'autre", async () => {
    const backend = createBackend({
      authAccounts: { [CREDS.email]: 'mot-de-passe-de-quelqun-dautre' },
      profiles: [CREDS.email],
    });
    const message = await signupWithInviteCode(backend.deps, CREDS);
    expect(message).toMatch(/déjà utilisée/);
    expect(backend.currentUser()).toBeNull();
  });

  it("fait entrer dans l'app quand le profil avait en fait déjà été créé", async () => {
    const backend = createBackend({
      authAccounts: { [CREDS.email]: CREDS.password },
      profiles: [CREDS.email],
    });
    const message = await signupWithInviteCode(backend.deps, CREDS);
    expect(message).toBeNull();
    expect(backend.currentUser()).toBe(CREDS.email);
  });
});

describe('bug 3 : messages Supabase bruts en anglais', () => {
  it('traduit les identifiants invalides', () => {
    expect(mapAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' }))
      .toBe('Email ou mot de passe incorrect.');
  });

  it('traduit les deux limites de débit', () => {
    expect(mapAuthError({ message: 'Request rate limit reached', code: 'over_request_rate_limit' }))
      .toMatch(/Trop de tentatives/);
    expect(mapAuthError({ message: 'Email rate limit exceeded', code: 'over_email_send_rate_limit' }))
      .toMatch(/Trop de tentatives/);
  });

  it("traduit l'adresse déjà enregistrée en invitant à se connecter", () => {
    expect(mapAuthError({ message: 'User already registered', code: 'user_already_exists' }))
      .toMatch(/déjà utilisée/);
  });

  it('retombe sur un message français pour un code non traité', () => {
    const message = mapAuthError({ message: 'Signups not allowed for this instance', code: 'signup_disabled' });
    expect(message).toBe('Une erreur est survenue, réessaie plus tard.');
  });

  it("reprend l'inscription même quand l'erreur ne porte pas de code", async () => {
    const backend = createBackend({ authAccounts: { [CREDS.email]: CREDS.password }, withoutErrorCodes: true });
    const message = await signupWithInviteCode(backend.deps, CREDS);
    expect(message).toBeNull();
    expect(backend.currentUser()).toBe(CREDS.email);
  });
});
