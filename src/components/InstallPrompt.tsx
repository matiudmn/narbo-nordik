import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button, Card } from './ui';
import { isStandaloneDisplay } from '../lib/shareExport';
import { isMobileDevice, isSamsungBrowser } from '../lib/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => !!sessionStorage.getItem('pwa_install_dismissed'));

  useEffect(() => {
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_install_dismissed', '1');
  };

  if (dismissed || isStandaloneDisplay() || !isMobileDevice()) return null;

  // Samsung Browser émet bien `beforeinstallprompt`, mais son installation est
  // rejetée par Play Protect (« Appli dangereuse bloquée »). Lui proposer le
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
