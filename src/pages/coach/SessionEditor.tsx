import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, Eye, Trash2, X, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  ALLURE_ZONES, BLOCK_TYPES,
  calculateBlockPace, calculateSessionTotalSeconds, formatSeconds, formatBlockSummary,
} from '../../lib/calculations';
import type { SessionBlock, AllureZone, BlockType } from '../../types';

let blockIdCounter = Date.now();
const genBlockId = () => `blk_${blockIdCounter++}`;

function makeBlock(type: BlockType, allure: AllureZone, durationSec: number, reps = 1, restSec = 0): SessionBlock {
  return { id: genBlockId(), type, allure, duration_seconds: durationSec, repetitions: reps, rest_seconds: restSec };
}

function DurationInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const mm = Math.floor(value / 60);
  const ss = value % 60;
  const display = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
      onChange(parseInt(digits || '0') * 60);
    } else {
      const m = parseInt(digits.slice(0, digits.length - 2));
      const s = parseInt(digits.slice(-2));
      onChange(m * 60 + Math.min(s, 59));
    }
  };

  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="text" inputMode="numeric" value={display}
        onChange={e => handleChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function BlockCard({
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
        <DurationInput value={block.duration_seconds} onChange={v => onUpdate({ ...block, duration_seconds: v })} label="Duree" />
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
        <span className="text-xs text-gray-500">{formatBlockSummary(block)}</span>
        {pace && (
          <span className="text-xs font-medium" style={{ color: zone.color }}>
            {pace.paceMin} - {pace.paceMax} min/km
          </span>
        )}
      </div>
    </div>
  );
}

export default function SessionEditor() {
  const { user } = useAuth();
  const { sessions, groups, users, addSession, deleteSession } = useData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [groupId, setGroupId] = useState<string>('');
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

  const athletes = users.filter(u => u.role === 'athlete');
  const previewUser = previewUserId ? athletes.find(u => u.id === previewUserId) : null;

  const resetForm = () => {
    setTitle(''); setDate(''); setGroupId(''); setLocation('');
    setDescription(''); setBlocks([]); setPreviewUserId(null);
  };

  const handleSubmit = () => {
    if (!title || !date || !user) return;
    addSession({
      title,
      date: new Date(date).toISOString(),
      group_id: groupId || null,
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
    };
    setBlocks(prev => [...prev, defaults[type]]);
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

  const totalSeconds = calculateSessionTotalSeconds(blocks);

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
              value={groupId} onChange={e => setGroupId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Tous les groupes</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
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
                  {blocks.length} bloc{blocks.length > 1 ? 's' : ''} | {formatSeconds(totalSeconds)}
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
            </div>

            {/* Blocks list */}
            {blocks.length > 0 && (
              <div className="space-y-2">
                {blocks.map((block, idx) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    index={idx}
                    total={blocks.length}
                    onUpdate={b => updateBlock(idx, b)}
                    onDelete={() => deleteBlock(idx)}
                    onMove={dir => moveBlock(idx, dir)}
                    previewVma={previewUser?.vma || null}
                  />
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
                  <option value="">Choisir un athlete...</option>
                  {athletes.map(a => (
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
            return (
              <div key={session.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">
                        {group?.name || 'Tous'}
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
