import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

const CONSENT_KEY = 'narbo_rgpd_consent';

export interface ConsentState {
  essential: boolean;
  analytics: boolean;
  notifications: boolean;
  acceptedAt: string | null;
}

const defaultConsent: ConsentState = {
  essential: true,
  analytics: false,
  notifications: false,
  acceptedAt: null,
};

export function getConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultConsent;
}

export function saveConsent(consent: ConsentState) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(defaultConsent);

  useEffect(() => {
    const existing = getConsent();
    if (!existing.acceptedAt) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const c: ConsentState = {
      essential: true,
      analytics: true,
      notifications: true,
      acceptedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  };

  const handleAcceptEssential = () => {
    const c: ConsentState = {
      ...consent,
      essential: true,
      acceptedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  };

  const handleSaveChoices = () => {
    const c: ConsentState = {
      ...consent,
      essential: true,
      acceptedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Protection des donnees</h2>
            <p className="text-xs text-gray-500">Conforme RGPD</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Narbo Nordik utilise le stockage local pour sauvegarder vos preferences et donnees d'entrainement.
          Aucune donnee n'est partagee avec des tiers.
        </p>

        {showDetails && (
          <div className="space-y-3 mb-4 bg-gray-50 rounded-lg p-3">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Essentiels</p>
                <p className="text-xs text-gray-500">Connexion, preferences</p>
              </div>
              <input type="checkbox" checked disabled className="rounded" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Analytiques</p>
                <p className="text-xs text-gray-500">Ameliorer l'application</p>
              </div>
              <input
                type="checkbox"
                checked={consent.analytics}
                onChange={e => setConsent(c => ({ ...c, analytics: e.target.checked }))}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Notifications</p>
                <p className="text-xs text-gray-500">Rappels de seances</p>
              </div>
              <input
                type="checkbox"
                checked={consent.notifications}
                onChange={e => setConsent(c => ({ ...c, notifications: e.target.checked }))}
                className="rounded"
              />
            </label>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleAcceptAll}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary-light transition-colors text-sm"
          >
            Tout accepter
          </button>
          {showDetails ? (
            <button
              onClick={handleSaveChoices}
              className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Sauvegarder mes choix
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleAcceptEssential}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Essentiels uniquement
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Personnaliser
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
