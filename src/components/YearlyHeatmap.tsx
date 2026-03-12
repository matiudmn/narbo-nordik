import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
interface HeatmapSession {
  date: string;
  title: string;
  session_type: string;
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

  const totalValidated = useMemo(() => {
    return sessions.filter(s => new Date(s.date).getFullYear() === year).length;
  }, [sessions, year]);

  const handleCellHover = useCallback((e: React.PointerEvent, month: number, day: number) => {
    const key = `${month}-${day}`;
    const cellSessions = sessionMap.get(key);
    if (!cellSessions) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = (e.target as HTMLElement).closest('.heatmap-container')?.getBoundingClientRect();
    if (!containerRect) return;
    const text = cellSessions
      .map(s => `${s.title} (${s.session_type})`)
      .join('\n');
    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 4,
      text,
    });
  }, [sessionMap]);

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Calendrier annuel</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-gray-900 min-w-[3rem] text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {totalValidated} seance{totalValidated > 1 ? 's' : ''} validee{totalValidated > 1 ? 's' : ''} en {year}
      </p>

      <div className="heatmap-container relative overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-gray-400 font-normal text-left pr-1 w-8" />
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className="text-[9px] text-gray-300 font-normal text-center p-0 w-[18px]">
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
                  <td className="text-[10px] text-gray-400 font-medium pr-1 py-0">{label}</td>
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = i + 1;
                    if (day > daysInMonth) {
                      return (
                        <td key={i} className="p-[1px]">
                          <div className="w-full aspect-square rounded-[2px] bg-gray-50" />
                        </td>
                      );
                    }
                    const key = `${month}-${day}`;
                    const cellSessions = sessionMap.get(key);
                    const isToday =
                      year === new Date().getFullYear() &&
                      month === new Date().getMonth() &&
                      day === new Date().getDate();

                    return (
                      <td key={i} className="p-[1px]">
                        <div
                          className={`w-full aspect-square rounded-[2px] transition-colors cursor-default ${
                            cellSessions
                              ? cellSessions.length >= 2
                                ? 'bg-accent'
                                : 'bg-accent/50'
                              : 'bg-gray-100'
                          } ${isToday ? 'ring-1 ring-primary' : ''}`}
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
            className="absolute z-10 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md whitespace-pre-line pointer-events-none max-w-[200px]"
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

      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-gray-100" />
          <span>Aucune</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-accent/50" />
          <span>1 seance</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
          <span>2+ seances</span>
        </div>
      </div>
    </div>
  );
}
