import { useState, memo } from 'react';
import { format } from 'date-fns';
import { Footprints, Bike, Dumbbell, Plus, Trash2, ChevronUp, ChevronDown, Clock, Ruler, Target, Smile } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  ALLURE_ZONES, BLOCK_TYPES,
  calculateBlockPace, formatBlockSummary, estimateBlockEffortSeconds, formatSeconds,
} from '../lib/calculations';
import type { SessionBlock, AllureZone, BlockType, Session, ObjectiveReached, Sensations } from '../types';

type ActivityType = 'run' | 'velo' | 'marche' | 'renfo';

let blockIdCounter = Date.now();
const genBlockId = () => `blk_${blockIdCounter++}`;

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
  const isRestDistance = block.rest_distance_meters !== null && block.rest_distance_meters !== undefined && block.rest_distance_meters > 0;
  const estimatedTime = isDistance && previewVma ? formatSeconds(estimateBlockEffortSeconds(block, previewVma)) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
        <select value={block.type} onChange={e => onUpdate({ ...block, type: e.target.value as BlockType })}
          className="text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer">
          {Object.entries(BLOCK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={14} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={14} /></button>
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Allure</label>
          <select value={block.allure} onChange={e => onUpdate({ ...block, allure: e.target.value as AllureZone })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            {Object.entries(ALLURE_ZONES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.pctMin}-{v.pctMax}%)</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-xs text-gray-500">{isDistance ? 'Distance' : 'Duree'}</label>
            <button type="button" onClick={() => {
              if (isDistance) onUpdate({ ...block, distance_meters: null, duration_seconds: block.duration_seconds || 120 });
              else onUpdate({ ...block, distance_meters: 400, duration_seconds: 0 });
            }} className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full hover:bg-primary/20 transition-colors">
              {isDistance ? <Clock size={12} /> : <Ruler size={12} />}
              {isDistance ? 'Duree' : 'Metres'}
            </button>
          </div>
          {isDistance ? (
            <input type="number" inputMode="numeric" min={50} step={50} value={block.distance_meters || 400}
              onChange={e => onUpdate({ ...block, distance_meters: Math.max(50, parseInt(e.target.value) || 400) })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="metres" />
          ) : (
            <DurationInput value={block.duration_seconds} onChange={v => onUpdate({ ...block, duration_seconds: v })} label="" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Repetitions</label>
          <input type="number" min={1} max={50} value={block.repetitions}
            onChange={e => onUpdate({ ...block, repetitions: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        {block.repetitions > 1 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-xs text-gray-500">{isRestDistance ? 'Repos (m)' : 'Repos'}</label>
              <button type="button" onClick={() => {
                if (isRestDistance) onUpdate({ ...block, rest_distance_meters: null, rest_seconds: block.rest_seconds || 90 });
                else onUpdate({ ...block, rest_distance_meters: 200, rest_seconds: 0 });
              }} className="flex items-center gap-1 text-xs text-orange-500 font-medium bg-orange-50 px-2 py-0.5 rounded-full hover:bg-orange-100 transition-colors">
                {isRestDistance ? <Clock size={10} /> : <Ruler size={10} />}
                {isRestDistance ? 'Temps' : 'Metres'}
              </button>
            </div>
            {isRestDistance ? (
              <input type="number" inputMode="numeric" min={10} step={10} value={block.rest_distance_meters || 200}
                onChange={e => onUpdate({ ...block, rest_distance_meters: Math.max(10, parseInt(e.target.value) || 200) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="metres" />
            ) : (
              <DurationInput value={block.rest_seconds} onChange={v => onUpdate({ ...block, rest_seconds: v })} label="" />
            )}
          </div>
        )}
      </div>

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

const ACTIVITY_TYPES: { key: ActivityType; label: string; icon: typeof Footprints }[] = [
  { key: 'run', label: 'Run', icon: Footprints },
  { key: 'velo', label: 'Velo', icon: Bike },
  { key: 'marche', label: 'Marche', icon: Footprints },
  { key: 'renfo', label: 'Renfo', icon: Dumbbell },
];

interface Props {
  onClose: () => void;
  editSession?: Session;
}

function getActivityFromSession(s: Session): ActivityType {
  if (s.session_type === 'velo') return 'velo';
  if (s.session_type === 'marche') return 'marche';
  if (s.session_type === 'renfo') return 'renfo';
  return 'run';
}

export default function PersonalSessionForm({ onClose, editSession }: Props) {
  const { user } = useAuth();
  const { addSession, updateSession, validateSession } = useData();

  const editActivity = editSession ? getActivityFromSession(editSession) : null;

  const [activity, setActivity] = useState<ActivityType | null>(editActivity);
  const [title, setTitle] = useState(editSession?.title || '');
  const [date, setDate] = useState(editSession?.date ? format(new Date(editSession.date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [blocks, setBlocks] = useState<SessionBlock[]>(
    editSession && editActivity === 'run' ? editSession.blocks : [makeBlock('echauffement', 'ef', 900)]
  );
  const [duration, setDuration] = useState(() => {
    if (editSession && editActivity !== 'run' && editSession.blocks[0]) return editSession.blocks[0].duration_seconds;
    return 0;
  });
  const [distanceKm, setDistanceKm] = useState(() => {
    if (editSession && (editActivity === 'velo' || editActivity === 'marche') && editSession.blocks[0]?.distance_meters) {
      return (editSession.blocks[0].distance_meters / 1000).toString();
    }
    return '';
  });
  const [description, setDescription] = useState(editSession?.description || '');
  const [objectiveReached, setObjectiveReached] = useState<ObjectiveReached | ''>('');
  const [sensations, setSensations] = useState<Sensations | ''>('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const previewVma = user.vma;

  const addBlock = () => {
    setBlocks(prev => [...prev, makeBlock('travail', 'endurance', 300)]);
  };

  const updateBlock = (id: string, updated: SessionBlock) => {
    setBlocks(prev => prev.map(b => b.id === id ? updated : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const canSave = () => {
    if (!title.trim() || !date) return false;
    if (activity === 'run') return blocks.length > 0;
    if (activity === 'velo' || activity === 'marche') return duration > 0;
    if (activity === 'renfo') return duration > 0;
    return false;
  };

  const handleSave = async () => {
    if (!canSave() || !activity) return;
    setSaving(true);
    setError(null);

    const sessionDate = new Date(date).toISOString();

    let sessionType: Session['session_type'];
    let sessionBlocks: SessionBlock[];
    let sessionDescription: string | null = null;

    if (activity === 'run') {
      sessionType = 'entrainement';
      sessionBlocks = blocks;
    } else if (activity === 'velo') {
      sessionType = 'velo';
      const distMeters = parseFloat(distanceKm) * 1000 || null;
      sessionBlocks = [makeBlock('travail', 'endurance', duration, 1, 0, distMeters)];
    } else if (activity === 'marche') {
      sessionType = 'marche';
      const distMeters = parseFloat(distanceKm) * 1000 || null;
      sessionBlocks = [makeBlock('travail', 'ef', duration, 1, 0, distMeters)];
    } else {
      sessionType = 'renfo';
      sessionBlocks = [makeBlock('travail', 'endurance', duration)];
      sessionDescription = description.trim() || null;
    }

    try {
      if (editSession) {
        await updateSession(editSession.id, {
          title: title.trim(),
          date: sessionDate,
          session_type: sessionType,
          blocks: sessionBlocks,
          description: sessionDescription,
        });
      } else {
        const newId = await addSession({
          title: title.trim(),
          date: sessionDate,
          session_type: sessionType,
          terrain_options: [],
          location: null,
          location_url: null,
          description: sessionDescription,
          group_id: null,
          preparation_id: null,
          target_distance: null,
          vma_percent_min: null,
          vma_percent_max: null,
          blocks: sessionBlocks,
          is_personal: true,
          created_by: user.id,
        });

        if (!newId) {
          setError('Erreur lors de la creation. Verifiez que la migration SQL a ete appliquee (colonne is_personal).');
          setSaving(false);
          return;
        }

        await validateSession(
          newId, user.id, 'done',
          feedback.trim() || undefined,
          undefined,
          objectiveReached || undefined,
          sensations || undefined,
        );
      }

      setSaving(false);
      onClose();
    } catch (e) {
      console.error('PersonalSessionForm save error:', e);
      setError('Erreur inattendue lors de la sauvegarde.');
      setSaving(false);
    }
  };

  if (!activity) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Type d'activite</p>
        <div className="grid grid-cols-4 gap-2">
          {ACTIVITY_TYPES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActivity(key)}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary hover:bg-primary/5 transition-colors">
              <Icon size={20} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          {editSession ? 'Modifier la seance' : 'Nouvelle seance'} - {ACTIVITY_TYPES.find(a => a.key === activity)?.label}
        </p>
        {!editSession && (
          <button onClick={() => setActivity(null)} className="text-xs text-primary font-medium">Changer</button>
        )}
      </div>

      <input type="text" placeholder="Titre de la seance" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />

      <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />

      {activity === 'run' && (
        <div className="space-y-2">
          {blocks.map((block, i) => (
            <BlockCard
              key={block.id}
              block={block}
              index={i}
              total={blocks.length}
              onUpdate={b => updateBlock(block.id, b)}
              onDelete={() => deleteBlock(block.id)}
              onMove={dir => moveBlock(block.id, dir)}
              previewVma={previewVma}
            />
          ))}
          <button onClick={addBlock}
            className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors">
            <Plus size={16} /> Ajouter un bloc
          </button>
        </div>
      )}

      {(activity === 'velo' || activity === 'marche') && (
        <div className="grid grid-cols-2 gap-3">
          <DurationInput value={duration} onChange={setDuration} label="Duree" />
          <div>
            <label className="text-xs text-gray-500">Distance (km)</label>
            <input type="number" step="0.1" min={0} placeholder="km" value={distanceKm} onChange={e => setDistanceKm(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
      )}

      {activity === 'renfo' && (
        <div className="space-y-3">
          <DurationInput value={duration} onChange={setDuration} label="Duree" />
          <div>
            <label className="text-xs text-gray-500">Description (facultatif)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Details de la seance..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
        </div>
      )}

      {!editSession && (
        <div className="space-y-3 border-t border-gray-200 pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ressenti</p>

          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Target size={12} /> Objectif atteint ?</p>
            <div className="flex gap-2">
              {([['oui', 'Oui', 'bg-green-100 text-green-700 border-green-300'], ['partiel', 'Partiel', 'bg-yellow-100 text-yellow-700 border-yellow-300'], ['non', 'Non', 'bg-red-100 text-red-700 border-red-300']] as const).map(([val, label, colors]) => (
                <button key={val} type="button" onClick={() => setObjectiveReached(objectiveReached === val ? '' : val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${objectiveReached === val ? colors : 'bg-white border-gray-200 text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Smile size={12} /> Sensations</p>
            <div className="flex gap-2">
              {([['excellentes', 'Excellentes', 'bg-green-100 text-green-700 border-green-300'], ['bonnes', 'Bonnes', 'bg-blue-100 text-blue-700 border-blue-300'], ['mauvaises', 'Mauvaises', 'bg-red-100 text-red-700 border-red-300']] as const).map(([val, label, colors]) => (
                <button key={val} type="button" onClick={() => setSensations(sensations === val ? '' : val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${sensations === val ? colors : 'bg-white border-gray-200 text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Commentaire (facultatif)</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder="Comment s'est passee la seance ?"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
        <button onClick={handleSave} disabled={!canSave() || saving}
          className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Enregistrement...' : editSession ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
