/**
 * Carte d'export partageable (PNG/PDF) d'une seance ou de la semaine.
 * Destinee au groupe WhatsApp du club : on montre le PROGRAMME et l'intensite,
 * jamais une allure perso (qui depend de la VMA de chaque athlete ; ils la
 * voient personnalisee en ouvrant l'app).
 *
 * IMPORTANT : styles 100% inline (couleurs/tailles/marges en dur) et empilement
 * vertical sans justify-between ni flex-wrap. C'est volontaire : html-to-image
 * capture les styles calcules element par element et gere mal les combinateurs
 * (space-y), le flex-wrap et la hauteur des titres sur 2 lignes -> sinon le
 * texte se chevauche dans l'image exportee. Ici, chaque ligne a sa marge
 * explicite, donc le rendu PNG est fidele.
 */
import { forwardRef, type ReactNode } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Session, AllureZoneConfig, SessionType, Group, SpecificPreparation } from '../types';
import { formatBlockSummary, blockEffortLabel, isEffortZone, ALLURE_ZONES } from '../lib/calculations';

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  entrainement: 'Entraînement', sortie_longue: 'Sortie longue', recuperation: 'Récupération',
  velo: 'Vélo', marche: 'Marche', renfo: 'Renfo', course: 'Course',
};

type Zones = Record<string, AllureZoneConfig>;

const C = {
  ink: '#111827', sub: '#6b7280', faint: '#9ca3af', line: '#e5e7eb',
  accent: '#6CCBE6', primary: '#0a0a0a', white: '#ffffff',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function metaLine(session: Session): string {
  const parts = [SESSION_TYPE_LABELS[session.session_type]];
  if (session.location) parts.push(session.location);
  if (session.session_rpe != null) parts.push(`RPE séance ${session.session_rpe}/10`);
  return parts.join('  ·  ');
}

interface Alloc { label: string; isPrep: boolean }

// A qui la seance est allouee : prepa specifique > groupe > tous.
function allocation(session: Session, groups: Group[], preparations: SpecificPreparation[]): Alloc {
  if (session.preparation_id) {
    const p = preparations.find(x => x.id === session.preparation_id);
    if (p) return { label: p.name, isPrep: true };
  }
  if (session.group_id) {
    const g = groups.find(x => x.id === session.group_id);
    if (g) return { label: g.name, isPrep: false };
  }
  return { label: 'Tous', isPrep: false };
}

function AllocPill({ alloc }: { alloc: Alloc }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
      background: alloc.isPrep ? '#e0f2fe' : '#f1f5f9',
      color: alloc.isPrep ? '#075985' : '#475569',
      marginRight: 6, verticalAlign: 'middle',
    }}>
      {alloc.label}
    </span>
  );
}

function CardShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div style={{ width: 480, background: C.white, fontFamily: FONT, color: C.ink }}>
      <div style={{ background: C.primary, color: C.white, padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
        <img src="/logo-club.png" alt="" width={40} height={40} style={{ borderRadius: '50%', display: 'block', marginRight: 12 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Narbo Nordik</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
      <div style={{ padding: '8px 20px', background: '#f9fafb', color: C.faint, fontSize: 10, textAlign: 'center' }}>
        Section running &amp; trail · allures personnalisées dans l'app
      </div>
    </div>
  );
}

export const SessionShareCard = forwardRef<HTMLDivElement, {
  session: Session; zones: Zones; groups: Group[]; preparations: SpecificPreparation[];
}>(
  function SessionShareCard({ session, zones, groups, preparations }, ref) {
    return (
      <div ref={ref}>
        <CardShell subtitle={format(new Date(session.date), 'EEEE d MMMM yyyy - HH:mm', { locale: fr })}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4 }}><AllocPill alloc={allocation(session, groups, preparations)} /></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{session.title}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{metaLine(session)}</div>
          </div>

          {session.blocks.map(block => {
            const zone = zones[block.allure] || ALLURE_ZONES[block.allure];
            return (
              <div key={block.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: zone.color, marginTop: 6, marginRight: 8, flexShrink: 0 }} />
                <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.35 }}>
                  {formatBlockSummary(block, zones)}
                  {isEffortZone(block.allure) && <span style={{ color: zone.color }}> · {blockEffortLabel(block)}</span>}
                </div>
              </div>
            );
          })}

          {session.description && (
            <div style={{ fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
              {session.description}
            </div>
          )}
        </CardShell>
      </div>
    );
  },
);

export const WeekShareCard = forwardRef<HTMLDivElement, {
  weekStart: Date; weekEnd: Date; sessions: Session[]; zones: Zones; groups: Group[]; preparations: SpecificPreparation[];
}>(function WeekShareCard({ weekStart, weekEnd, sessions, zones, groups, preparations }, ref) {
  const subtitle = `Semaine du ${format(weekStart, 'd', { locale: fr })} au ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`;
  return (
    <div ref={ref}>
      <CardShell subtitle={subtitle}>
        {sessions.length === 0 && (
          <div style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: '16px 0' }}>
            Aucune séance programmée cette semaine.
          </div>
        )}
        {sessions.map((session, i) => (
          <div
            key={session.id}
            style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 10, marginBottom: i === sessions.length - 1 ? 0 : 14 }}
          >
            <div style={{ fontSize: 11, color: C.faint }}>
              <AllocPill alloc={allocation(session, groups, preparations)} />
              {format(new Date(session.date), 'EEEE d MMMM - HH:mm', { locale: fr })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.3, marginTop: 1 }}>{session.title}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{metaLine(session)}</div>
            {session.blocks.length > 0 && (
              <div style={{ fontSize: 12, color: C.ink, marginTop: 3, lineHeight: 1.35 }}>
                {session.blocks.map(b => formatBlockSummary(b, zones)).join('  ·  ')}
              </div>
            )}
          </div>
        ))}
      </CardShell>
    </div>
  );
});
