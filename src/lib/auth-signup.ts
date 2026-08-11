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
 *
 * Porte aussi `mapAuthError`, partage avec `login` : les deux ecrans se
 * repondent (« cette adresse est deja utilisee » renvoie vers la connexion), il
 * n'y a pas de raison d'avoir deux vocabulaires d'erreur.
 */

/** Sous-ensemble commun aux erreurs supabase-js (auth) et PostgREST (RPC). */
export interface AuthCallError {
  message: string;
  code?: string;
}

export interface SignupDeps {
  signUp: (creds: { email: string; password: string }) => Promise<{ data: { user: unknown }; error: AuthCallError | null }>;
  signIn: (creds: { email: string; password: string }) => Promise<{ error: AuthCallError | null }>;
  registerProfile: (args: { invite_code: string; firstname: string; lastname: string; email: string }) => Promise<{ error: AuthCallError | null }>;
  /** Relit le profil et le pose dans le contexte (get_own_profile -> setUser). */
  loadProfile: () => Promise<void>;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  inviteCode: string;
}

// Codes renvoyes par GoTrue quand l'adresse a deja un compte Auth
// (@supabase/auth-js, lib/error-codes.d.ts). Repli sur le message brut pour
// les instances qui ne renvoient pas encore de code : ce chemin est le pivot
// de la reprise d'inscription ci-dessous, il ne doit pas dependre d'une seule
// forme de reponse.
function isEmailAlreadyRegistered(error: AuthCallError): boolean {
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return true;
  return /already registered/i.test(error.message);
}

/**
 * Traduit une erreur d'authentification supabase-js en message affichable.
 * `error.message` est de l'anglais brut ("Invalid login credentials") dans une
 * interface entierement en francais. Seuls les cas realistes de l'ecran de
 * connexion et du formulaire d'inscription sont traites, avec les codes
 * verifies dans @supabase/auth-js (lib/error-codes.d.ts) ; tout le reste
 * retombe sur un message generique plutot que d'exposer l'anglais.
 */
export function mapAuthError(error: AuthCallError): string {
  if (isEmailAlreadyRegistered(error)) {
    return "Cette adresse est déjà utilisée. Connecte-toi, ou réinitialise ton mot de passe si tu l'as oublié.";
  }
  if (error.code === 'invalid_credentials') return 'Email ou mot de passe incorrect.';
  if (error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') {
    return 'Trop de tentatives, patiente un moment avant de réessayer.';
  }
  return 'Une erreur est survenue, réessaie plus tard.';
}

/**
 * Message affiche a quelqu'un dont le compte d'authentification existe mais qui
 * n'a pas de ligne `users`. Exporte pour que le test s'appuie sur la constante
 * plutot que sur une copie de la phrase.
 */
export const INSCRIPTION_INACHEVEE =
  "Ton inscription n'a jamais été finalisée : il manque le code du club. Reprends « Rejoindre Narbo Nordik » avec cette adresse et ce mot de passe.";

export interface LoginDeps {
  signIn: (creds: { email: string; password: string }) => Promise<{ error: AuthCallError | null }>;
  /** get_own_profile : `status` 0 signale une coupure reseau, pas une absence. */
  fetchProfile: () => Promise<{ data: unknown; error: AuthCallError | null; status: number }>;
  signOut: () => Promise<void>;
}

/**
 * Connexion, avec detection du compte d'authentification SANS profil.
 *
 * Ce cas existe pour de vrai : `register_profile` verifie le code d'invitation
 * APRES que signUp a cree le compte Auth, donc un code mal recopie laisse une
 * ligne `auth.users` orpheline. La reprise posee par signupWithInviteCode ne
 * joue que sur le formulaire d'INSCRIPTION ; quelqu'un qui passe par celui de
 * CONNEXION (le reflexe naturel quand on croit avoir deja un compte) se
 * connectait avec succes, loadProfile ne trouvait rien, setUser(null), et
 * l'ecran de connexion se reaffichait SANS le moindre message. Boucle muette.
 *
 * On deconnecte avant de rendre la main : laisser une session a moitie ouverte
 * ferait retomber onAuthStateChange dans le meme trou a chaque montage.
 */
export async function loginWithProfileCheck(
  deps: LoginDeps,
  creds: { email: string; password: string },
): Promise<string | null> {
  const { error } = await deps.signIn(creds);
  if (error) return mapAuthError(error);

  const { data, error: profileError, status } = await deps.fetchProfile();

  // Coupure reseau : meme traitement que loadProfile (status 0). On ne
  // deconnecte pas quelqu'un dont le profil existe peut-etre tres bien.
  if (status === 0) return null;

  if (profileError || !data) {
    await deps.signOut();
    return INSCRIPTION_INACHEVEE;
  }

  return null;
}

// Mappe l'erreur brute du RPC register_profile vers un message FR affichable.
// - 42501 (insufficient_privilege) : levee volontairement par le RPC pour un
//   code d'invitation invalide (cf. 20260731130000_invite_code.sql), message
//   deja propre en FR, on le garde tel quel.
// - 23505 (unique_violation) : plus traite ici, signupWithInviteCode le lit
//   desormais comme un succes (le profil existe deja et appartient a
//   l'appelant), ce mappeur ne le voit donc jamais.
// - reste : erreur Postgres brute non destinee a l'ecran, detail envoye a
//   captureError, message generique affiche.
function mapRegisterProfileError(error: AuthCallError): string {
  if (error.code === '42501') return error.message;
  captureError('AuthContext.signup register_profile error', error);
  return 'Une erreur est survenue lors de la création du compte, réessaie plus tard.';
}

export async function signupWithInviteCode(deps: SignupDeps, creds: SignupCredentials): Promise<string | null> {
  const { email, password, firstname, lastname, inviteCode } = creds;

  const { data, error } = await deps.signUp({ email, password });
  if (error) {
    if (!isEmailAlreadyRegistered(error)) return mapAuthError(error);

    // Adresse deja prise : le cas de loin le plus probable ici est une
    // inscription interrompue par un code d'invitation mal recopie (compte
    // Auth cree, profil jamais insere), pas un doublon. On rejoue donc la
    // connexion avec les identifiants saisis : si elle passe, c'est bien le
    // proprietaire de l'adresse qui reprend son inscription, et le RPC
    // ci-dessous peut creer le profil manquant. Sinon, l'adresse est vraiment
    // celle de quelqu'un d'autre (ou le mot de passe differe) : on renvoie le
    // message de l'erreur signUp d'origine, qui invite a se connecter ou a
    // reinitialiser, plutot que le « identifiants invalides » de signIn, hors
    // sujet sur un formulaire d'inscription.
    const { error: signInError } = await deps.signIn({ email, password });
    if (signInError) return mapAuthError(error);
  } else if (!data.user) {
    return 'Erreur lors de la creation du compte';
  }

  // Insert direct remplace par le RPC register_profile (SECURITY DEFINER) :
  // il verifie le code d'invitation cote base avant de creer le profil (la
  // policy INSERT de `users` n'a plus de branche self-service depuis
  // 20260731130000_invite_code.sql).
  const { error: rpcError } = await deps.registerProfile({ invite_code: inviteCode, firstname, lastname, email });
  // 23505 (unique_violation) : la ligne `users` existe deja pour cet
  // auth.uid(). L'appelant est donc a la fois authentifie et deja inscrit (son
  // inscription avait en fait abouti, seule l'entree dans l'app avait echoue) :
  // on continue comme apres un succes plutot que de l'arreter sur une erreur.
  // Ce code ne peut arriver que par la reprise ci-dessus, un compte Auth tout
  // juste cree n'ayant par construction aucune ligne `users`.
  if (rpcError && rpcError.code !== '23505') return mapRegisterProfileError(rpcError);

  // Rechargement explicite, sinon le compte est cree mais l'ecran reste sur le
  // formulaire : signUp emet SIGNED_IN AVANT de rendre la main, donc le
  // loadProfile() declenche par onAuthStateChange (AuthContext) tourne alors
  // que la ligne `users` n'existe pas encore et retombe sur setUser(null).
  // C'est ce setUser qui fait entrer l'athlete dans l'app (AppRoutes rend
  // <Login /> tant que `user` est null).
  await deps.loadProfile();

  // La notification aux coachs (type `new_athlete`) est posée par le trigger
  // `on_new_athlete` (20260810140000) : il couvre aussi la création par un
  // coach (addUser), signale la VMA / la licence manquante et ne dépend plus
  // de la bonne fin de cette fonction côté client.
  return null;
}
