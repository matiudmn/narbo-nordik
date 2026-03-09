import { useState, useMemo, memo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, Eye, Trash2, X, ChevronUp, ChevronDown, Zap, Clock, Ruler } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  ALLURE_ZONES, BLOCK_TYPES,
  calculateBlockPace, calculateSessionTotalSeconds, formatSeconds, formatBlockSummary, estimateBlockEffortSeconds,
} from '../../lib/calculations';
import type { SessionBlock, AllureZone, BlockType, SessionType, TerrainOption } from '../../types';

let blockIdCounter = Date.now();
const genBlockId = () => `blk_${blockIdCounter++}`;

const SESSION_TYPES: Record<SessionType, string> = {
  entrainement: 'Entrainement',
  sortie_longue: 'Sortie Longue',
  recuperation: 'Recuperation',
};

const TERRAIN_OPTIONS: Record<TerrainOption, string> = {
  cotes: 'Cotes',
  piste: 'Piste',
};

function makeBlock(type: BlockType, allure: AllureZone, durationSec: number, reps = 1, restSec = 0, distanceMeters: number | null = null): SessionBlock {
  return { id: genBlockId(), type, allure, duration_seconds: durationSec, distance_meters: distanceMeters, repetitions: reps, rest_seconds: restSec };
}

function DurationInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const mm = Math.floor(value / 60);
  const ss = value % 60;

  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" inputMode="numeric" min={0} max={99}
          value={mm}
          onChange={e => {
            const m = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
            onChange(m * 60 + ss);
          }}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">m</span>
        <input
          type="number" inputMode="numeric" min={0} max={59}
          value={ss}
          onChange={e => {
            const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
            onChange(mm * 60 + s);
          }}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">s</span>
      </div>
    </div>
  );
}

const BlockCard = memo(function BlockCard({
  block, index, total, onUpdate, onDelete, onMove, previewVma,
}: {
  block: SessionBlock;
  index: number;
  total: number;
  onUpdate: (b: SessionBlock) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  previewVma: number | null;
}) {
  const zone = ALLURE_ZONES[block.allure];
  const pace = previewVma ? calculateBlockPace(previewVma, block.allure) : null;
  const isDistance = block.distance_meters !== null && block.distance_meters !== undefined;
  const estimatedTime = isDistance && previewVma ? formatSeconds(estimateBlockEffortSeconds(block, previewVma)) : null;

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
              <option key={k} value={k}>{v.label} ({v.pctMin}-{v.pctMax}%)</option>
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
          <DurationInput value={block.rest_seconds} onChange={v => onUpdate({ ...block, rest_seconds: v })} label="Repos" />
        )}
      </div>

      {/* Summary + preview */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-500">
          {formatBlockSummary(block)}
          {estimatedTime && <span className="text-gray-400 ml-1">(~{estimatedTime}/rep)</span>}
        </span>
        {pace && (
          <span className="text-xs font-medium" style={{ color: zone.color }}>
            {pace.paceMin} - {pace.paceMax} min/km
          </span>
        )}
      </div>
    </div>
  );
});

export default function SessionEditor() {
  const { user } = useAuth();
  const { sessions, groups, users, preparations, addSession, deleteSession } = useData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [preparationId, setPreparationId] = useState<string>('');
  const [sessionType, setSessionType] = useState<SessionType>('entrainement');
  const [terrainOptions, setTerrainOptions] = useState<TerrainOption[]>([]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<SessionBlock[]>([]);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  const weekSessions = useMemo(() =>
    sessions
      .filter(s => {
        const d = new Date(s.date);
        return d >= weekStart && d <= weekEnd;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [sessions, weekStart, weekEnd]
  );

  const allMembers = users.filter(u => u.vma);
  const previewUser = previewUserId ? allMembers.find(u => u.id === previewUserId) : null;

  const resetForm = () => {
    setTitle(''); setDate(''); setGroupId(''); setLocation('');
    setSessionType('entrainement'); setTerrainOptions([]);
    setDescription(''); setBlocks([]); setPreviewUserId(null);
  };

  const handleSubmit = () => {
    if (!title || !date || !user) return;
    addSession({
      title,
      date: new Date(date).toISOString(),
      session_type: sessionType,
      terrain_options: terrainOptions,
      group_id: preparationId ? null : (groupId || null),
      preparation_id: preparationId || null,
      location: location || null,
      location_url: null,
      description: description || null,
      target_distance: null,
      vma_percent_min: null,
      vma_percent_max: null,
      created_by: user.id,
      blocks,
    });
    resetForm();
    setShowForm(false);
  };

  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, SessionBlock> = {
      echauffement: makeBlock('echauffement', 'ef', 1200),
      travail: makeBlock('travail', 'vma', 120, 6, 90),
      retour_au_calme: makeBlock('retour_au_calme', 'ef', 600),
      recuperation: makeBlock('recuperation', 'ef', 120),
    };
    setBlocks(prev => [...prev, defaults[type]]);
  };

  const insertRecovery = (afterIdx: number) => {
    const recovery = makeBlock('recuperation', 'ef', 120);
    setBlocks(prev => {
      const arr = [...prev];
      arr.splice(afterIdx + 1, 0, recovery);
      return arr;
    });
  };

  const updateBlock = (idx: number, updated: SessionBlock) => {
    setBlocks(prev => prev.map((b, i) => i === idx ? updated : b));
  };

  const deleteBlock = (idx: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    setBlocks(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const hasDistanceBlocks = blocks.some(b => b.distance_meters);
  const totalSeconds = calculateSessionTotalSeconds(blocks, previewUser?.vma || undefined);

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">Planning</h1>
        <button
          onClick={() => { setShowForm(!showForm); resetForm(); }}
          className="flex items-center gap-1 bg-accent text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouvelle seance'}
        </button>
      </div>

      {/* Creation form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
          <h2 className="font-bold text-gray-900">Creer une seance</h2>

          <input
            type="text" placeholder="Titre (ex: Fractionne court)"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={preparationId ? `prep:${preparationId}` : groupId}
              onChange={e => {
                const v = e.target.value;
                if (v.startsWith('prep:')) {
                  setPreparationId(v.replace('prep:', ''));
                  setGroupId('');
                } else {
                  setGroupId(v);
                  setPreparationId('');
                }
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Tous les groupes</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              {preparations.length > 0 && <option disabled>───── Prep. specifiques ─────</option>}
              {preparations.map(p => <option key={p.id} value={`prep:${p.id}`}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={sessionType} onChange={e => setSessionType(e.target.value as SessionType)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {Object.entries(SESSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex items-center gap-3 px-3 py-2">
              {Object.entries(TERRAIN_OPTIONS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={terrainOptions.includes(k as TerrainOption)}
                    onChange={e => {
                      if (e.target.checked) setTerrainOptions([...terrainOptions, k as TerrainOption]);
                      else setTerrainOptions(terrainOptions.filter(t => t !== k));
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary/20"
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>

          <input
            type="text" placeholder="Lieu (optionnel)"
            value={location} onChange={e => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Block builder */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Zap size={14} />
                Programme de la seance
              </p>
              {blocks.length > 0 && (
                <span className="text-xs text-gray-400">
                  {blocks.length} bloc{blocks.length > 1 ? 's' : ''} | {hasDistanceBlocks && !previewUser ? '?' : (hasDistanceBlocks ? '~' : '')}{hasDistanceBlocks && !previewUser ? '' : formatSeconds(totalSeconds)}
                </span>
              )}
            </div>

            {/* Quick-add buttons */}
            <div className="flex gap-2">
              <button onClick={() => addBlock('echauffement')}
                className="flex-1 text-xs py-2 rounded-lg border border-dashed border-green-300 text-green-600 hover:bg-green-50 font-medium transition-colors">
                + Echauffement
              </button>
              <button onClick={() => addBlock('travail')}
                className="flex-1 text-xs py-2 rounded-lg border border-dashed border-red-300 text-red-500 hover:bg-red-50 font-medium transition-colors">
                + Travail
              </button>
              <button onClick={() => addBlock('retour_au_calme')}
                className="flex-1 text-xs py-2 rounded-lg border border-dashed border-green-300 text-green-600 hover:bg-green-50 font-medium transition-colors">
                + Retour
              </button>
              <button onClick={() => addBlock('recuperation')}
                className="flex-1 text-xs py-2 rounded-lg border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 font-medium transition-colors">
                + Recup
              </button>
            </div>

            {/* Blocks list */}
            {blocks.length > 0 && (
              <div className="space-y-2">
                {blocks.map((block, idx) => (
                  <div key={block.id}>
                    <BlockCard
                      block={block}
                      index={idx}
                      total={blocks.length}
                      onUpdate={b => updateBlock(idx, b)}
                      onDelete={() => deleteBlock(idx)}
                      onMove={dir => moveBlock(idx, dir)}
                      previewVma={previewUser?.vma || null}
                    />
                    {idx < blocks.length - 1 && (
                      <button
                        type="button"
                        onClick={() => insertRecovery(idx)}
                        className="w-full flex items-center justify-center gap-1 py-1 my-1 text-[10px] text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors group"
                      >
                        <span className="flex-1 border-t border-dashed border-orange-200 group-hover:border-orange-400" />
                        <span className="px-2 font-medium">+ Recup</span>
                        <span className="flex-1 border-t border-dashed border-orange-200 group-hover:border-orange-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {blocks.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">
                Ajoute des blocs pour composer ta seance
              </p>
            )}

            {/* Preview athlete */}
            {blocks.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Eye size={14} className="text-primary flex-shrink-0" />
                <span className="text-xs text-gray-500 flex-shrink-0">Preview :</span>
                <select
                  value={previewUserId || ''}
                  onChange={e => setPreviewUserId(e.target.value || null)}
                  className="text-xs px-2 py-1 border border-gray-200 rounded flex-1"
                >
                  <option value="">Choisir un membre...</option>
                  {allMembers.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.firstname} {a.lastname} (VMA {a.vma})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <textarea
            placeholder="Consignes (echauffement, recuperation...)"
            value={description} onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <button
            onClick={handleSubmit}
            disabled={!title || !date}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 hover:bg-primary-light transition-colors"
          >
            Publier la seance
          </button>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm text-gray-600">
          {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM yyyy', { locale: fr })}
          {weekOffset === 0 && <span className="ml-1 text-accent font-medium">(cette semaine)</span>}
        </p>
        <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Sessions list */}
      {weekSessions.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Aucune seance cette semaine</p>
      ) : (
        <div className="space-y-2">
          {weekSessions.map(session => {
            const group = groups.find(g => g.id === session.group_id);
            const prep = preparations.find(p => p.id === session.preparation_id);
            return (
              <div key={session.id} className={`rounded-xl border border-gray-100 p-4 ${prep ? 'bg-amber-50' : session.group_id ? 'bg-blue-50' : 'bg-white'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${prep ? 'text-amber-600' : 'text-gray-500'}`}>
                        {prep?.name || group?.name || 'Tous'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{session.title}</h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(session.date), 'EEEE d MMM - HH:mm', { locale: fr })}
                    </p>
                    {session.location && (
                      <p className="text-sm text-gray-400 mt-0.5">{session.location}</p>
                    )}
                    {/* Compact block summary */}
                    {session.blocks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.blocks.map(b => {
                          const z = ALLURE_ZONES[b.allure];
                          return (
                            <span key={b.id} className="text-xs px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: z.color }}>
                              {formatBlockSummary(b)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
