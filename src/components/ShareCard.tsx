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
import type { Session, AllureZoneConfig, SessionType, Group, SpecificPreparation, RaceResult, RaceType } from '../types';
import { formatBlockSummary, blockEffortLabel, isEffortZone, ALLURE_ZONES } from '../lib/calculations';

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  entrainement: 'Entraînement', sortie_longue: 'Sortie longue', recuperation: 'Récupération',
  velo: 'Vélo', marche: 'Marche', renfo: 'Renfo', course: 'Course',
};

type Zones = Record<string, AllureZoneConfig>;

const C = {
  ink: '#111827', sub: '#6b7280', faint: '#9ca3af', line: '#e5e7eb',
  accent: '#6CCBE6', primary: '#000000', white: '#ffffff',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function metaLine(session: Session): string {
  const parts = [SESSION_TYPE_LABELS[session.session_type]];
  if (session.location) parts.push(session.location);
  if (session.session_rpe != null) parts.push(`RPE séance ${session.session_rpe}/10`);
  return parts.join('  ·  ');
}

type AllocKind = 'prep' | 'group' | 'tous';
interface Alloc { label: string; kind: AllocKind }

// Couleurs alignees sur les tokens warning-*/info-*/neutral-* de src/index.css
// (mêmes 3 etats que les pastilles de SessionEditor.tsx : prepa=ambre, groupe=bleu, Tous=gris).
const ALLOC_COLORS: Record<AllocKind, { background: string; color: string }> = {
  prep: { background: '#fef3c7', color: '#b45309' },
  group: { background: '#dbeafe', color: '#1d4ed8' },
  tous: { background: '#f1f5f9', color: '#475569' },
};

// A qui la seance est allouee : prepa specifique > groupe > tous.
function allocation(session: Session, groups: Group[], preparations: SpecificPreparation[]): Alloc {
  if (session.preparation_id) {
    const p = preparations.find(x => x.id === session.preparation_id);
    if (p) return { label: p.name, kind: 'prep' };
  }
  if (session.group_id) {
    const g = groups.find(x => x.id === session.group_id);
    if (g) return { label: g.name, kind: 'group' };
  }
  return { label: 'Tous', kind: 'tous' };
}

function AllocPill({ alloc }: { alloc: Alloc }) {
  const { background, color } = ALLOC_COLORS[alloc.kind];
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
      background, color,
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

const RACE_TYPE_LABELS: Record<RaceType, string> = {
  route: 'Route', trail: 'Trail', piste: 'Piste',
};

// Couleurs alignees sur les badges route/trail/piste de src/pages/Palmares.tsx
// (bg-blue-100/text-blue-700, bg-emerald-100/text-emerald-700, bg-violet-100/text-violet-700).
const RACE_TYPE_COLORS: Record<RaceType, { background: string; color: string }> = {
  route: { background: '#dbeafe', color: '#1d4ed8' },
  trail: { background: '#d1fae5', color: '#047857' },
  piste: { background: '#ede9fe', color: '#6d28d9' },
};

function formatRaceDuration(duration: string): string {
  const parts = duration.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const RaceShareCard = forwardRef<HTMLDivElement, {
  race: RaceResult; athleteFirstname: string;
}>(function RaceShareCard({ race, athleteFirstname }, ref) {
  const typeColors = RACE_TYPE_COLORS[race.race_type];
  return (
    <div ref={ref}>
      <CardShell subtitle={format(new Date(race.date), 'EEEE d MMMM yyyy', { locale: fr })}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{
              display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
              background: typeColors.background, color: typeColors.color,
              marginRight: 6, verticalAlign: 'middle',
            }}>
              {RACE_TYPE_LABELS[race.race_type]}
            </span>
            {race.is_label && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', verticalAlign: 'middle' }}>★ Label</span>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{race.race_name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{athleteFirstname} · {race.distance_km} km</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>
          {formatRaceDuration(race.time_duration)}
        </div>
      </CardShell>
    </div>
  );
});

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
