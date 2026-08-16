import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from './ui';
import type { SessionStatus } from '../types';

export interface HeatmapSession {
  date: string;
  title: string;
  session_type: string;
  is_personal: boolean;
  /** 'none' = séance passée sans validation : pas d'information, pas un reproche. */
  status: 'done' | 'missed' | 'none';
}

interface YearlyHeatmapProps {
  sessions: HeatmapSession[];
  initialYear?: number;
}

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

type CellType = 'empty' | 'coach' | 'personal' | 'both' | 'missed' | 'none';

function getCellType(sessions: HeatmapSession[]): CellType {
  // Une séance faite prime toujours sur les autres du même jour : la journée
  // se lit à ce qui a été fait, jamais à ce qui manque.
  const done = sessions.filter(s => s.status === 'done');
  if (done.length > 0) {
    const hasCoach = done.some(s => !s.is_personal);
    const hasPersonal = done.some(s => s.is_personal);
    if (hasCoach && hasPersonal) return 'both';
    return hasCoach ? 'coach' : 'personal';
  }
  if (sessions.some(s => s.status === 'missed')) return 'missed';
  if (sessions.length > 0) return 'none';
  return 'empty';
}

const CELL_STYLES: Record<CellType, string> = {
  empty: 'bg-neutral-100',
  coach: 'bg-accent',
  personal: 'bg-warning-500',
  both: 'bg-gradient-to-br from-accent to-warning-500',
  missed: 'bg-neutral-500',
  none: 'bg-neutral-300',
};

/**
 * Statut de validation ramené aux trois états lisibles du calendrier.
 * Co-localisé avec le type HeatmapSession qu'il produit, d'où la dérogation
 * Fast Refresh (sans impact en prod).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function toHeatmapStatus(status: SessionStatus | undefined): HeatmapSession['status'] {
  return status === 'done' || status === 'missed' ? status : 'none';
}

export default function YearlyHeatmap({ sessions, initialYear }: YearlyHeatmapProps) {
  const [year, setYear] = useState(initialYear ?? new Date().getFullYear());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const sessionMap = useMemo(() => {
    const map = new Map<string, HeatmapSession[]>();
    for (const s of sessions) {
      const d = new Date(s.date);
      if (d.getFullYear() !== year) continue;
      const key = `${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions, year]);

  const doneCount = useMemo(
    () => sessions.filter(s => s.status === 'done' && new Date(s.date).getFullYear() === year).length,
    [sessions, year]
  );

  const handleCellHover = useCallback((e: React.PointerEvent, month: number, day: number) => {
    const key = `${month}-${day}`;
    const cellSessions = sessionMap.get(key);
    if (!cellSessions) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = (e.target as HTMLElement).closest('.heatmap-container')?.getBoundingClientRect();
    if (!containerRect) return;
    const text = cellSessions
      .map(s => {
        const prefix =
          s.status === 'missed' ? '[Non faite] '
          : s.status === 'none' ? '[Non renseignée] '
          : s.is_personal ? '[Perso] ' : '';
        return `${prefix}${s.title} (${s.session_type})`;
      })
      .join('\n');
    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 4,
      text,
    });
  }, [sessionMap]);

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-900">Calendrier annuel</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
            aria-label="Annee precedente"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-neutral-900 min-w-[3rem] text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Annee suivante"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-400 mb-3">
        {doneCount} faite{doneCount > 1 ? 's' : ''}
      </p>

      <div className="heatmap-container relative overflow-x-auto">
        <table className="w-full border-collapse" role="grid" aria-label={`Calendrier des seances ${year}`}>
          <thead>
            <tr>
              <th className="text-[10px] text-neutral-400 font-normal text-left pr-1 w-8" />
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className="text-[9px] text-neutral-300 font-normal text-center p-0 w-[18px]">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((label, month) => {
              const daysInMonth = getDaysInMonth(year, month);
              return (
                <tr key={month}>
                  <td className="text-[10px] text-neutral-400 font-medium pr-1 py-0">{label}</td>
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = i + 1;
                    if (day > daysInMonth) {
                      return (
                        <td key={i} className="p-[1px]">
                          <div className="w-full aspect-square rounded-[2px] bg-neutral-50" />
                        </td>
                      );
                    }
                    const key = `${month}-${day}`;
                    const cellSessions = sessionMap.get(key);
                    const isToday =
                      year === new Date().getFullYear() &&
                      month === new Date().getMonth() &&
                      day === new Date().getDate();
                    const cellType = cellSessions ? getCellType(cellSessions) : 'empty';

                    return (
                      <td key={i} className="p-[1px]">
                        <div
                          className={`w-full aspect-square rounded-[2px] transition-colors cursor-default ${CELL_STYLES[cellType]} ${isToday ? 'ring-1 ring-primary' : ''}`}
                          onPointerEnter={cellSessions ? (e) => handleCellHover(e, month, day) : undefined}
                          onPointerLeave={cellSessions ? handleCellLeave : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {tooltip && (
          <div
            className="absolute z-10 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded-md whitespace-pre-line pointer-events-none max-w-[200px]"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-neutral-400">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-neutral-100" />
          <span>Aucune</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
          <span>Faite (club)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-warning-500" />
          <span>Faite (perso)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-neutral-500" />
          <span>Non faite</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-neutral-300" />
          <span>Non renseignée</span>
        </div>
      </div>
    </Card>
  );
}
