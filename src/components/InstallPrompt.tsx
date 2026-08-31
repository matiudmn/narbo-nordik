import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button, Card } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { isStandaloneDisplay } from '../lib/shareExport';
import { isMobileDevice, isSamsungBrowser } from '../lib/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function InstallPrompt() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY));

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    // `appinstalled` est le seul signal fiable d'une installation réussie : la
    // fenêtre courante reste un onglet de navigateur, donc `display-mode:
    // standalone` n'y bascule jamais et le bandeau resterait affiché.
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // Un événement `beforeinstallprompt` ne se consomme qu'une fois : on lâche
    // la référence avant l'appel, sinon un second appui rejette en
    // InvalidStateError et il ne se passe rien à l'écran.
    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  // Pas de bandeau tant que le membre n'est pas connecté : sur l'écran de
  // connexion il concurrencerait le bouton Rejoindre Narbo Nordik, alors que
  // l'inscription passe avant tout le reste.
  if (!user || dismissed || installed || isStandaloneDisplay() || !isMobileDevice()) return null;

  // Samsung Browser émet bien `beforeinstallprompt`, mais son installation est
  // rejetée par Play Protect avec un avertissement de sécurité. Lui proposer le
  // bouton Installer, c'est l'envoyer droit dans l'avertissement : on renvoie
  // vers l'aide, comme pour Safari iOS et tout navigateur sans événement.
  const canInstallDirectly = !!deferredPrompt && !isSamsungBrowser();

  return (
    <Card
      padding="md"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md border-neutral-200 shadow-pop animate-slide-up"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        aria-label="Fermer"
        className="absolute top-1 right-1 px-2 text-neutral-400"
      >
        <X size={16} aria-hidden="true" />
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Download size={24} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-neutral-900">Installer Narbo Nordik</p>
          <p className="text-caption text-neutral-500">Accès rapide depuis l'écran d'accueil</p>
        </div>
      </div>

      <Button
        variant="accent"
        fullWidth
        className="mt-3"
        onClick={canInstallDirectly ? handleInstall : () => navigate('/installer')}
      >
        {canInstallDirectly ? 'Installer' : 'Comment faire'}
      </Button>
    </Card>
  );
}
