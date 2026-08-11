import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteOwnAccount, LOCAL_KEYS, type InvokeResult } from './account-deletion';

/**
 * Faux appel de l'Edge Function `delete-account`, fidèle à ce que renvoie
 * supabase.functions.invoke :
 *
 * - réponse 2xx : `{ data, error: null }` ;
 * - réponse non 2xx : `error.message` est générique et le message français du
 *   serveur n'est lisible que dans `error.context` (la réponse HTTP).
 */
function httpError(payload: unknown): InvokeResult {
  return {
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => payload },
    },
  };
}

const SOLE_COACH = 'Tu es le seul coach du club. Nomme un autre coach avant de supprimer ton compte.';

const SURVEY = { reason: 'demenagement', comment: '  Merci pour tout  ' };

function createApp(respond: () => InvokeResult | Promise<InvokeResult>) {
  const purged: string[] = [];
  const deps = {
    invokeDeleteAccount: vi.fn(async () => respond()),
    signOut: vi.fn(async () => ({ error: null })),
    storage: { removeItem: (key: string) => { purged.push(key); } },
    redirect: vi.fn(),
  };
  return { deps, purged };
}

const success = (): InvokeResult => ({ data: { deleted: true } as { error?: string }, error: null });

beforeEach(() => {
  // captureError logge systématiquement en console : inutile de rougir la sortie des tests.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('compte supprimé', () => {
  it('ferme la session, purge les réglages locaux et quitte l\'app', async () => {
    const app = createApp(success);
    const message = await deleteOwnAccount(app.deps, SURVEY);
    expect(message).toBeNull();
    expect(app.deps.signOut).toHaveBeenCalled();
    expect(app.purged).toEqual([...LOCAL_KEYS]);
    expect(app.deps.redirect).toHaveBeenCalled();
  });

  it("n'envoie que l'enquête de sortie, l'identité venant du JWT côté serveur", async () => {
    const app = createApp(success);
    await deleteOwnAccount(app.deps, SURVEY);
    expect(app.deps.invokeDeleteAccount).toHaveBeenCalledWith({
      reason: 'demenagement',
      comment: 'Merci pour tout',
    });
  });

  it('envoie un commentaire vide comme absent', async () => {
    const app = createApp(success);
    await deleteOwnAccount(app.deps, { reason: 'tarif', comment: '   ' });
    expect(app.deps.invokeDeleteAccount).toHaveBeenCalledWith({ reason: 'tarif', comment: null });
  });
});

describe('suppression refusée ou en échec', () => {
  it('affiche le refus du serveur sans déconnecter (garde-fou seul coach)', async () => {
    const app = createApp(() => httpError({ error: SOLE_COACH }));
    const message = await deleteOwnAccount(app.deps, SURVEY);
    expect(message).toBe(SOLE_COACH);
    // Le compte existe toujours : le déconnecter ferait croire au départ.
    expect(app.deps.signOut).not.toHaveBeenCalled();
    expect(app.deps.redirect).not.toHaveBeenCalled();
    expect(app.purged).toEqual([]);
  });

  it('retombe sur un message français quand la réponse est illisible', async () => {
    const app = createApp(() => ({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => { throw new Error('not json'); } } },
    }));
    const message = await deleteOwnAccount(app.deps, SURVEY);
    expect(message).toBe("La suppression n'a pas abouti, réessaie dans un instant.");
    expect(app.deps.signOut).not.toHaveBeenCalled();
    expect(app.deps.redirect).not.toHaveBeenCalled();
  });

  it("garde l'utilisateur connecté quand l'appel échoue avant d'arriver", async () => {
    const app = createApp(() => { throw new Error('Failed to fetch'); });
    const message = await deleteOwnAccount(app.deps, SURVEY);
    expect(message).toBe("La suppression n'a pas abouti, réessaie dans un instant.");
    expect(app.deps.signOut).not.toHaveBeenCalled();
    expect(app.deps.redirect).not.toHaveBeenCalled();
    expect(app.purged).toEqual([]);
  });

  it('traite une erreur applicative renvoyée en 200 comme un échec', async () => {
    const app = createApp(() => ({ data: { error: 'Profil introuvable.' }, error: null }));
    const message = await deleteOwnAccount(app.deps, SURVEY);
    expect(message).toBe('Profil introuvable.');
    expect(app.deps.redirect).not.toHaveBeenCalled();
  });
});
