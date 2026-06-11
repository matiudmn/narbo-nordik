import { memo } from 'react';
import { Trash2, ChevronUp, ChevronDown, Clock, Ruler } from 'lucide-react';
import {
  ALLURE_ZONES, BLOCK_TYPES,
  calculateBlockPace, formatSeconds, estimateBlockEffortSeconds, formatBlockSummary, isEffortZone, blockEffortLabel, PMA_EFFORT,
} from '../lib/calculations';
import type { SessionBlock, AllureZone, BlockType, AllureZoneConfig } from '../types';

function DurationInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const hh = Math.floor(value / 3600);
  const mm = Math.floor((value % 3600) / 60);
  const ss = value % 60;
  const rebuild = (h: number, m: number, s: number) => onChange(h * 3600 + m * 60 + s);

  return (
    <div>
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <div className="flex items-center gap-1">
        <input type="number" inputMode="numeric" min={0} max={23} value={hh}
          onChange={e => rebuild(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)), mm, ss)}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">h</span>
        <input type="number" inputMode="numeric" min={0} max={59} value={mm}
          onChange={e => rebuild(hh, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)), ss)}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">m</span>
        <input type="number" inputMode="numeric" min={0} max={59} value={ss}
          onChange={e => rebuild(hh, mm, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">s</span>
      </div>
    </div>
  );
}

const BlockCard = memo(function BlockCard({
  block, index, total, onUpdate, onDelete, onMove, previewVma, zones,
}: {
  block: SessionBlock;
  index: number;
  total: number;
  onUpdate: (b: SessionBlock) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  previewVma: number | null;
  zones?: Record<string, AllureZoneConfig>;
}) {
  const zone = (zones || ALLURE_ZONES)[block.allure] || ALLURE_ZONES[block.allure];
  const pace = previewVma ? calculateBlockPace(previewVma, block.allure, zones) : null;
  const isDistance = block.distance_meters !== null && block.distance_meters !== undefined;
  const isRestDistance = block.rest_distance_meters !== null && block.rest_distance_meters !== undefined && block.rest_distance_meters > 0;
  const estimatedTime = isDistance && previewVma ? formatSeconds(estimateBlockEffortSeconds(block, previewVma, zones)) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
        <select
          value={block.type}
          onChange={e => onUpdate({ ...block, type: e.target.value as BlockType })}
          className="text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer"
        >
          {Object.entries(BLOCK_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20">
            <ChevronDown size={14} />
          </button>
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Allure</label>
          <select
            value={block.allure}
            onChange={e => onUpdate({ ...block, allure: e.target.value as AllureZone })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {Object.entries(ALLURE_ZONES).map(([k, v]) => (
              <option key={k} value={k}>
                {isEffortZone(k as AllureZone)
                  ? `${v.label} (côte · effort)`
                  : `${v.label} (${Math.min(...v.pctMinByLevel)}-${Math.max(...v.pctMaxByLevel)}%)`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-xs text-gray-500">{isDistance ? 'Distance' : 'Duree'}</label>
            <button
              type="button"
              onClick={() => {
                if (isDistance) {
                  onUpdate({ ...block, distance_meters: null, duration_seconds: block.duration_seconds || 120 });
                } else {
                  onUpdate({ ...block, distance_meters: 400, duration_seconds: 0 });
                }
              }}
              className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
            >
              {isDistance ? <Clock size={12} /> : <Ruler size={12} />}
              {isDistance ? 'Duree' : 'Metres'}
            </button>
          </div>
          {isDistance ? (
            <input
              type="number" inputMode="numeric" min={50} step={50}
              value={block.distance_meters || 400}
              onChange={e => onUpdate({ ...block, distance_meters: Math.max(50, parseInt(e.target.value) || 400) })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="metres"
            />
          ) : (
            <DurationInput value={block.duration_seconds} onChange={v => onUpdate({ ...block, duration_seconds: v })} label="" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Repetitions</label>
          <input
            type="number" min={1} max={50} value={block.repetitions}
            onChange={e => onUpdate({ ...block, repetitions: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {block.repetitions > 1 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-xs text-gray-500">{isRestDistance ? 'Repos (m)' : 'Repos'}</label>
              <button
                type="button"
                onClick={() => {
                  if (isRestDistance) {
                    onUpdate({ ...block, rest_distance_meters: null, rest_seconds: block.rest_seconds || 90 });
                  } else {
                    onUpdate({ ...block, rest_distance_meters: 200, rest_seconds: 0 });
                  }
                }}
                className="flex items-center gap-1 text-xs text-orange-500 font-medium bg-orange-50 px-2 py-0.5 rounded-full hover:bg-orange-100 transition-colors"
              >
                {isRestDistance ? <Clock size={10} /> : <Ruler size={10} />}
                {isRestDistance ? 'Temps' : 'Metres'}
              </button>
            </div>
            {isRestDistance ? (
              <input
                type="number" inputMode="numeric" min={10} step={10}
                value={block.rest_distance_meters || 200}
                onChange={e => onUpdate({ ...block, rest_distance_meters: Math.max(10, parseInt(e.target.value) || 200) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="metres"
              />
            ) : (
              <DurationInput value={block.rest_seconds} onChange={v => onUpdate({ ...block, rest_seconds: v })} label="" />
            )}
          </div>
        )}
      </div>

      {/* Cible d'effort (PMA) : editable par le coach, varie selon la saison */}
      {isEffortZone(block.allure) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">RPE cible</label>
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={10} value={block.rpe_min ?? PMA_EFFORT.rpeMin}
                onChange={e => onUpdate({ ...block, rpe_min: Math.min(10, Math.max(1, parseInt(e.target.value) || PMA_EFFORT.rpeMin)) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="RPE minimum" />
              <span className="text-gray-300 text-xs">à</span>
              <input type="number" min={1} max={10} value={block.rpe_max ?? PMA_EFFORT.rpeMax}
                onChange={e => onUpdate({ ...block, rpe_max: Math.min(10, Math.max(1, parseInt(e.target.value) || PMA_EFFORT.rpeMax)) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="RPE maximum" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">FCmax %</label>
            <div className="flex items-center gap-1">
              <input type="number" min={50} max={100} value={block.fcmax_min ?? PMA_EFFORT.fcMaxMin}
                onChange={e => onUpdate({ ...block, fcmax_min: Math.min(100, Math.max(50, parseInt(e.target.value) || PMA_EFFORT.fcMaxMin)) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="FCmax minimum" />
              <span className="text-gray-300 text-xs">à</span>
              <input type="number" min={50} max={100} value={block.fcmax_max ?? PMA_EFFORT.fcMaxMax}
                onChange={e => onUpdate({ ...block, fcmax_max: Math.min(100, Math.max(50, parseInt(e.target.value) || PMA_EFFORT.fcMaxMax)) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="FCmax maximum" />
            </div>
          </div>
        </div>
      )}

      {/* Summary + preview */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-500">
          {formatBlockSummary(block, zones)}
          {estimatedTime && <span className="text-gray-400 ml-1">(~{estimatedTime}/rep)</span>}
        </span>
        {isEffortZone(block.allure) ? (
          <span className="text-xs font-medium" style={{ color: zone.color }}>
            {blockEffortLabel(block)}
          </span>
        ) : pace ? (
          <span className="text-xs font-medium" style={{ color: zone.color }}>
            {pace.paceMin} - {pace.paceMax} min/km
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default BlockCard;
