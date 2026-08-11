import { captureError } from './monitoring';

/**
 * Suppression du compte par son propriétaire (droit à l'effacement, RGPD).
 *
 * Extrait de Profile.handleDeleteAccount, qui supprimait la ligne
 * `public.users` depuis le client puis déconnectait dans tous les cas. Deux
 * conséquences : la ligne `auth.users` (l'adresse e-mail) survivait, et
 * l'échec éventuel de la suppression était invisible, l'écran de départ étant
 * joué de la même façon. Le travail réel est désormais fait par l'Edge
 * Function `delete-account` (service_role) ; ce module ne garde que la règle
 * qui manquait : ne fermer la session et ne quitter l'app QUE si le serveur a
 * confirmé la suppression.
 *
 * Les effets de bord (appel de la fonction, déconnexion, localStorage,
 * navigation) sont injectés, comme dans auth-signup et shareExport :
 * l'environnement de test du projet est 'node' (cf. vitest.config.ts).
 */

/** Réglages locaux à l'appareil, sans valeur une fois le compte supprimé. */
export const LOCAL_KEYS = ['narbo_rgpd_consent', 'narbo_notif_enabled'] as const;

const GENERIC_ERROR = "La suppression n'a pas abouti, réessaie dans un instant.";

/**
 * Sous-ensemble utile de la réponse de `supabase.functions.invoke`. Sur une
 * réponse non 2xx, supabase-js ne remonte qu'un message générique
 * (« Edge Function returned a non-2xx status code ») et range la réponse HTTP
 * dans `error.context` : c'est là que se trouve le message français du
 * serveur, notamment le refus « seul coach du club ».
 */
export interface InvokeResult {
  data: { error?: string } | null;
  error: { message: string; context?: { json: () => Promise<unknown> } } | null;
}

export interface DeleteAccountDeps {
  invokeDeleteAccount: (body: { reason: string; comment: string | null }) => Promise<InvokeResult>;
  signOut: () => Promise<unknown>;
  storage: Pick<Storage, 'removeItem'>;
  redirect: () => void;
}

export interface ExitSurvey {
  reason: string;
  comment: string;
}

async function readServerError(result: InvokeResult): Promise<string | null> {
  if (result.error) {
    try {
      const payload = await result.error.context?.json();
      const message = (payload as { error?: unknown } | null)?.error;
      if (typeof message === 'string' && message) return message;
    } catch {
      // Corps illisible (réseau coupé, 502 HTML de la passerelle) : rien à afficher de plus précis.
    }
    captureError('delete-account invoke', result.error);
    return GENERIC_ERROR;
  }
  // Réponse 2xx portant une erreur applicative : même lecture que le résumé IA
  // du tableau de bord coach (`error || data?.error`).
  if (typeof result.data?.error === 'string' && result.data.error) return result.data.error;
  return null;
}

/** Renvoie un message d'erreur français à afficher, ou null si le compte est bien supprimé. */
export async function deleteOwnAccount(deps: DeleteAccountDeps, survey: ExitSurvey): Promise<string | null> {
  let result: InvokeResult;
  try {
    result = await deps.invokeDeleteAccount({
      reason: survey.reason,
      comment: survey.comment.trim() || null,
    });
  } catch (e) {
    captureError('delete-account invoke', e);
    return GENERIC_ERROR;
  }

  const serverError = await readServerError(result);
  if (serverError) return serverError;

  // Compte réellement supprimé : la session peut être fermée et l'app quittée.
  // Une déconnexion en échec ne doit pas retenir l'utilisateur sur un écran de
  // profil dont le compte n'existe plus.
  await deps.signOut().catch(e => captureError('delete-account signOut', e));
  for (const key of LOCAL_KEYS) deps.storage.removeItem(key);
  deps.redirect();
  return null;
}
