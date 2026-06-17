/**
 * Carte d'export partageable (PNG/PDF) d'une seance ou de la semaine.
 * Destinee au groupe WhatsApp du club : on montre le PROGRAMME et l'intensite,
 * jamais une allure perso (qui depend de la VMA de chaque athlete ; ils la
 * voient personnalisee en ouvrant l'app). Rendu a largeur fixe pour une capture
 * coherente. Pas de bouton ni d'interaction : c'est un visuel pur.
 */
import { forwardRef, type ReactNode } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Session, AllureZoneConfig, SessionType } from '../types';
import { formatBlockSummary, blockEffortLabel, isEffortZone, ALLURE_ZONES } from '../lib/calculations';

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  entrainement: 'Entraînement', sortie_longue: 'Sortie longue', recuperation: 'Récupération',
  velo: 'Vélo', marche: 'Marche', renfo: 'Renfo', course: 'Course',
};

type Zones = Record<string, AllureZoneConfig>;

function CardShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div style={{ width: 480 }} className="bg-white font-sans">
      <div className="bg-primary text-white px-5 py-4 flex items-center gap-3">
        <img src="/logo-club.png" alt="" className="h-10 w-10 rounded-full bg-white/10" />
        <div>
          <p className="text-base font-bold leading-tight">Narbo Nordik</p>
          <p className="text-xs text-white/70">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-3">{children}</div>
      <div className="px-5 py-2 bg-gray-50 text-[10px] text-gray-400 text-center">
        Section running & trail · allures personnalisées dans l'app
      </div>
    </div>
  );
}

function Blocks({ session, zones }: { session: Session; zones: Zones }) {
  return (
    <div className="space-y-1.5">
      {session.blocks.map(block => {
        const zone = zones[block.allure] || ALLURE_ZONES[block.allure];
        return (
          <div key={block.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-gray-900">{formatBlockSummary(block, zones)}</span>
              {isEffortZone(block.allure) && (
                <span className="text-gray-500" style={{ color: zone.color }}> · {blockEffortLabel(block)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const SessionShareCard = forwardRef<HTMLDivElement, { session: Session; zones: Zones }>(
  function SessionShareCard({ session, zones }, ref) {
    return (
      <div ref={ref}>
        <CardShell subtitle={format(new Date(session.date), 'EEEE d MMMM yyyy - HH:mm', { locale: fr })}>
          <div>
            <p className="text-lg font-bold text-gray-900">{session.title}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
              <span>{SESSION_TYPE_LABELS[session.session_type]}</span>
              {session.location && <span>{session.location}</span>}
              {session.session_rpe != null && <span className="font-medium text-primary">RPE séance {session.session_rpe}/10</span>}
            </div>
          </div>
          {session.blocks.length > 0 && <Blocks session={session} zones={zones} />}
          {session.description && (
            <p className="text-xs text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-line">{session.description}</p>
          )}
        </CardShell>
      </div>
    );
  },
);

export const WeekShareCard = forwardRef<HTMLDivElement, {
  weekStart: Date; weekEnd: Date; sessions: Session[]; zones: Zones;
}>(function WeekShareCard({ weekStart, weekEnd, sessions, zones }, ref) {
  const subtitle = `Semaine du ${format(weekStart, 'd', { locale: fr })} au ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`;
  return (
    <div ref={ref}>
      <CardShell subtitle={subtitle}>
        {sessions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Aucune séance programmée cette semaine.</p>
        )}
        {sessions.map(session => (
          <div key={session.id} className="border-l-2 border-accent/30 pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-gray-900">{session.title}</p>
              <span className="text-[11px] text-gray-400 flex-shrink-0">
                {format(new Date(session.date), 'EEE d MMM - HH:mm', { locale: fr })}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2 text-[11px] text-gray-500">
              <span>{SESSION_TYPE_LABELS[session.session_type]}</span>
              {session.location && <span>· {session.location}</span>}
              {session.session_rpe != null && <span className="text-primary font-medium">· RPE {session.session_rpe}/10</span>}
            </div>
            {session.blocks.length > 0 && (
              <p className="text-xs text-gray-700 mt-0.5">
                {session.blocks.map(b => formatBlockSummary(b, zones)).join('  ·  ')}
              </p>
            )}
          </div>
        ))}
      </CardShell>
    </div>
  );
});
