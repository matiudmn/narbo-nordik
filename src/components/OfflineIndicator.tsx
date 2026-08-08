import { WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../contexts/DataContext';

/**
 * Bandeau hors-ligne, visible uniquement quand le bootstrap a du retomber
 * sur le cache local (useData().offline, alimente par
 * contexts/data/bootstrap.ts : navigator.onLine, echec reseau au fetch, ou
 * evenement 'offline'). Disparait des qu'un bootstrap reussit a nouveau
 * (retour reseau, ecoute 'online' cote bootstrap).
 */
export default function OfflineIndicator() {
  const { offline } = useData();

  if (!offline.isOffline) return null;

  const label = offline.cachedAt
    ? `Hors ligne : données du ${format(offline.cachedAt, "d MMMM à HH:mm", { locale: fr })}`
    : 'Hors ligne : aucune donnée en cache';

  return (
    <div className="fixed top-14 left-0 right-0 lg:left-60 bg-warning text-white text-center py-1.5 text-xs font-medium z-40 flex items-center justify-center gap-1.5">
      <WifiOff size={14} />
      {label}
    </div>
  );
}
