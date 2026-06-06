import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log local pour le debug. Un futur Sentry.captureException viendrait ici.
    console.error('ErrorBoundary a capturé une erreur :', error, info.componentStack);
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
