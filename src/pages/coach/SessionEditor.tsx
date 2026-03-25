import { useState, useMemo, memo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, Eye, Trash2, X, ChevronUp, ChevronDown, Zap, Clock, Ruler, Pencil, Copy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  ALLURE_ZONES, BLOCK_TYPES,
  calculateBlockPace, calculateSessionTotalSeconds, formatSeconds, formatBlockSummary, estimateBlockEffortSeconds, getSessionCode, getAllureZones,
} from '../../lib/calculations';
import type { SessionBlock, AllureZone, BlockType, SessionType, TerrainOption } from '../../types';

let blockIdCounter = Date.now();
const genBlockId = () => `blk_${blockIdCounter++}`;

const SESSION_TYPES: Partial<Record<SessionType, string>> = {
  entrainement: 'Entraînement',
  sortie_longue: 'Sortie Longue',
  recuperation: 'Récupération',
};

const TERRAIN_OPTIONS: Record<TerrainOption, string> = {
  cotes: 'Côtes',
  piste: 'Piste',
};

function makeBlock(type: BlockType, allure: AllureZone, durationSec: number, reps = 1, restSec = 0, distanceMeters: number | null = null, restDistanceMeters: number | null = null): SessionBlock {
  return { id: genBlockId(), type, allure, duration_seconds: durationSec, distance_meters: distanceMeters, repetitions: reps, rest_seconds: restSec, rest_distance_meters: restDistanceMeters };
}

function DurationInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const hh = Math.floor(value / 3600);
  const mm = Math.floor((value % 3600) / 60);
  const ss = value % 60;

  const rebuild = (h: number, m: number, s: number) => onChange(h * 3600 + m * 60 + s);

  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" inputMode="numeric" min={0} max={23}
          value={hh}
          onChange={e => {
            const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
            rebuild(h, mm, ss);
          }}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">h</span>
        <input
          type="number" inputMode="numeric" min={0} max={59}
          value={mm}
          onChange={e => {
            const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
            rebuild(hh, m, ss);
          }}
          className="w-12 px-1 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-gray-400">m</span>
        <input
          type="number" inputMode="numeric" min={0} max={59}
          value={ss}
          onChange={e => {
            const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
            rebuild(hh, mm, s);
          }}
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
  zones?: Record<string, import('../../types').AllureZoneConfig>;
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
              <option key={k} value={k}>{v.label} ({Math.min(...v.pctMinByLevel)}-{Math.max(...v.pctMaxByLevel)}%)</option>
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

      {/* Summary + preview */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-500">
          {formatBlockSummary(block, zones)}
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
  const { sessions, groups, users, preparations, addSession, updateSession, deleteSession, clubSettings } = useData();
  const allureZones = getAllureZones(clubSettings?.allure_zones);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [duplicatedId, setDuplicatedId] = useState<string | null>(null);

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
        if (s.is_personal) return false;
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
    setEditingSessionId(null);
  };

  const handleSubmit = () => {
    if (!title || !date || !user) return;
    if (editingSessionId) {
      updateSession(editingSessionId, {
        title,
        date: new Date(date).toISOString(),
        session_type: sessionType,
        terrain_options: terrainOptions,
        group_id: preparationId ? null : (groupId || null),
        preparation_id: preparationId || null,
        location: location || null,
        description: description || null,
        blocks,
      });
    } else {
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
        is_personal: false,
        blocks,
      });
    }
    resetForm();
    setShowForm(false);
  };

  const loadSessionIntoForm = (s: typeof sessions[0], isEdit: boolean) => {
    setTitle(s.title);
    const d = new Date(s.date);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setGroupId(s.group_id || '');
    setPreparationId(s.preparation_id || '');
    setSessionType(s.session_type);
    setTerrainOptions(s.terrain_options || []);
    setLocation(s.location || '');
    setDescription(s.description || '');
    setBlocks(s.blocks.map(b => ({ ...b, id: genBlockId() })));
    setPreviewUserId(null);
    if (isEdit) {
      setEditingSessionId(s.id);
    } else {
      setEditingSessionId(null);
    }
    setShowForm(true);
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
  const totalSeconds = calculateSessionTotalSeconds(blocks, previewUser?.vma || undefined, allureZones);

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
          <h2 className="font-bold text-gray-900">{editingSessionId ? 'Modifier la seance' : 'Creer une seance'}</h2>

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
                + Échauffement
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
                      zones={allureZones}
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
            placeholder="Consignes (échauffement, récupération...)"
            value={description} onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <button
            onClick={handleSubmit}
            disabled={!title || !date}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 hover:bg-primary-light transition-colors"
          >
            {editingSessionId ? 'Enregistrer les modifications' : 'Publier la seance'}
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
        <div className="space-y-3 max-w-3xl mx-auto">
          {weekSessions.map(session => {
            const group = groups.find(g => g.id === session.group_id);
            const prep = preparations.find(p => p.id === session.preparation_id);
            const borderColor = prep ? 'border-l-amber-400' : session.group_id ? 'border-l-blue-400' : 'border-l-gray-300';
            return (
              <div key={session.id} className={`rounded-xl border border-gray-100 bg-white p-4 border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${prep ? 'bg-amber-100 text-amber-700' : session.group_id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {prep?.name || group?.name || 'Tous'}
                      </span>
                      <h3 className="font-semibold text-gray-900">
                        {session.title}
                        <span className="text-xs font-normal text-gray-400 ml-1.5">{getSessionCode(session, sessions)}</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                      <span>{format(new Date(session.date), 'EEEE d MMM - HH:mm', { locale: fr })}</span>
                      {session.location && (
                        <span className="text-gray-400">{session.location}</span>
                      )}
                    </div>
                    {session.blocks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {session.blocks.map(b => {
                          const z = allureZones[b.allure] || ALLURE_ZONES[b.allure];
                          return (
                            <span key={b.id} className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: z.color }}>
                              {formatBlockSummary(b, allureZones)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => loadSessionIntoForm(session, true)}
                      className="p-2 text-gray-300 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        loadSessionIntoForm(session, false);
                        setDuplicatedId(session.id);
                        setTimeout(() => setDuplicatedId(null), 2000);
                      }}
                      className={`p-2 rounded-lg transition-colors ${duplicatedId === session.id ? 'text-accent bg-accent/10' : 'text-gray-300 hover:text-accent hover:bg-gray-50'}`}
                      title="Dupliquer"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {duplicatedId === session.id && (
                  <p className="text-xs text-accent mt-2">Seance copiee dans le formulaire ci-dessus</p>
                )}
                {confirmDeleteId === session.id && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                    <p className="text-sm text-red-700 mb-2">Supprimer la seance "{session.title}" ?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Annuler</button>
                      <button onClick={() => { deleteSession(session.id); setConfirmDeleteId(null); }} className="flex-1 py-1.5 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">Supprimer</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
