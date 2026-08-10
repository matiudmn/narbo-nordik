import { captureError } from './monitoring';

/**
 * Parcours d'inscription self-service (code d'invitation du club), extrait de
 * AuthContext.signup.
 *
 * Extrait ici parce que les blocages de ce parcours sont des bugs d'ORDRE
 * d'appels (signUp emet SIGNED_IN avant de rendre la main, register_profile
 * n'est appele qu'apres) : ils ne se voient qu'en rejouant la sequence, et
 * l'environnement de test du projet est 'node' (cf. vitest.config.ts), sans
 * DOM pour monter le Provider. Les appels Supabase sont donc injectes, comme
 * navigator.share l'est dans shareExport.
 */

/** Sous-ensemble commun aux erreurs supabase-js (auth) et PostgREST (RPC). */
export interface AuthCallError {
  message: string;
  code?: string;
}

export interface SignupDeps {
  signUp: (creds: { email: string; password: string }) => Promise<{ data: { user: unknown }; error: AuthCallError | null }>;
  registerProfile: (args: { invite_code: string; firstname: string; lastname: string; email: string }) => Promise<{ error: AuthCallError | null }>;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  inviteCode: string;
}

// Mappe l'erreur brute du RPC register_profile vers un message FR affichable.
// - 42501 (insufficient_privilege) : levee volontairement par le RPC pour un
//   code d'invitation invalide (cf. 20260731130000_invite_code.sql), message
//   deja propre en FR, on le garde tel quel.
// - 23505 (unique_violation) : la ligne `users` existe deja (ex. reprise
//   d'une inscription partielle : signUp avait deja reussi une 1re fois),
//   message dedie pour rediriger vers la connexion.
// - reste : erreur Postgres brute non destinee a l'ecran, detail envoye a
//   captureError, message generique affiche.
function mapRegisterProfileError(error: AuthCallError): string {
  if (error.code === '42501') return error.message;
  if (error.code === '23505') return 'Ton compte existe déjà, connecte-toi.';
  captureError('AuthContext.signup register_profile error', error);
  return 'Une erreur est survenue lors de la création du compte, réessaie plus tard.';
}

export async function signupWithInviteCode(deps: SignupDeps, creds: SignupCredentials): Promise<string | null> {
  const { email, password, firstname, lastname, inviteCode } = creds;

  const { data, error } = await deps.signUp({ email, password });
  if (error) return error.message;
  if (!data.user) return 'Erreur lors de la creation du compte';

  // Insert direct remplace par le RPC register_profile (SECURITY DEFINER) :
  // il verifie le code d'invitation cote base avant de creer le profil (la
  // policy INSERT de `users` n'a plus de branche self-service depuis
  // 20260731130000_invite_code.sql).
  const { error: rpcError } = await deps.registerProfile({ invite_code: inviteCode, firstname, lastname, email });
  if (rpcError) return mapRegisterProfileError(rpcError);

  // La notification aux coachs (type `new_athlete`) est posée par le trigger
  // `on_new_athlete` (20260810140000) : il couvre aussi la création par un
  // coach (addUser), signale la VMA / la licence manquante et ne dépend plus
  // de la bonne fin de cette fonction côté client.
  return null;
}
