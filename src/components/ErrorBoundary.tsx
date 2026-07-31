import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { isChunkLoadError, reloadForChunkError } from '../lib/chunkReload';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloading: boolean;
}

/**
 * Filet de sécurité React : capture toute erreur de rendu dans l'arbre
 * enfant et affiche un écran de repli au lieu d'une page blanche.
 *
 * Complète les garde-fous existants (index.html spinner, main.tsx defensive
 * chart theme) : ceux-ci protègent le démarrage, celui-ci protège le runtime
 * (une page qui crashe pendant la navigation n'efface plus toute l'app).
 *
 * Class component obligatoire : seuls les class components peuvent implémenter
 * getDerivedStateFromError / componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, reloading: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reloading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Échec de chargement d'un chunk lazy : typiquement juste après un
    // déploiement, quand le service worker référence encore d'anciens hash.
    // On recharge une seule fois (garde anti-boucle dans reloadForChunkError)
    // pour récupérer l'index.html à jour, au lieu d'afficher l'écran d'erreur.
    // Filet de sécurité complémentaire au handler global 'vite:preloadError'.
    if (isChunkLoadError(error) && reloadForChunkError()) {
      this.setState({ reloading: true });
      return;
    }
    // Log local pour le debug + remontée Sentry (no-op tant que Sentry.init
    // n'a pas été appelé, voir src/main.tsx).
    console.error('ErrorBoundary a capturé une erreur :', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReload = () => {
    // Reset l'état puis recharge : la plupart des erreurs runtime sont
    // transitoires (donnée inattendue, état corrompu), un reload les efface.
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.reloading) {
      // Rechargement one-shot en cours (chunk obsolète après déploiement) :
      // écran neutre transitoire, pas l'écran d'erreur.
      return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
          <div className="text-center">
            <div className="text-4xl mb-3" aria-hidden="true">🔄</div>
            <p className="text-sm text-gray-600">Mise à jour de l'application...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4" aria-hidden="true">🏃</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Oups, un petit faux départ</h1>
          <p className="text-sm text-gray-600 mb-6">
            Une erreur inattendue est survenue sur cette page. Pas de panique,
            tes données sont en sécurité. Recharge pour repartir.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Recharger la page
            </button>
            <button
              onClick={this.handleHome}
              className="w-full py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 text-left text-[11px] text-gray-400 overflow-auto max-h-40 bg-gray-100 rounded-lg p-3">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
