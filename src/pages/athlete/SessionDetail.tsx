import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, MapPin, ExternalLink, Timer, Gauge, Check, Paperclip, X, Pencil, Target, Smile, Heart, Activity, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { calculatePaces, ALLURE_ZONES, BLOCK_TYPES, calculateBlockPace, calculateBlockTotalSeconds, calculateSessionTotalSeconds, formatSeconds, formatBlockSummary, getSessionCode, getAllureZones, pacePerKm } from '../../lib/calculations';
import { useState, useRef } from 'react';
import { getAttachmentUrl } from '../../lib/storage';
import { useToast, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { motion, DUR, EASE } from '../../lib/motion';
import type { ObjectiveReached, Sensations, SessionMetricsInput } from '../../types';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, validations, validateSession, updateValidation, groups, userPreparations, sessionNordiks, toggleSessionNordik, validationReactions, clubSettings } = useData();
  const toast = useToast();
  const allureZones = getAllureZones(clubSettings?.allure_zones);

  const session = sessions.find(s => s.id === id);
  const validation = validations.find(v => v.session_id === id && v.user_id === user?.id);
  const group = session?.group_id ? groups.find(g => g.id === session.group_id) : null;

  const [showValidation, setShowValidation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [objectiveReached, setObjectiveReached] = useState<ObjectiveReached | null>(null);
  const [sensations, setSensations] = useState<Sensations | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [elevationM, setElevationM] = useState('');
  const [avgHrV, setAvgHrV] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrFilled, setOcrFilled] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilise JPG, PNG, WebP, HEIC ou PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    setAttachedFile(file);
    if (filePreview) URL.revokeObjectURL(filePreview);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
    e.target.value = '';
  };

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setAttachedFile(null);
    setFilePreview(null);
  };

  if (!session) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Séance introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const userPrepIds = userPreparations.filter(up => up.user_id === user?.id).map(up => up.preparation_id);
  const hasAccessViaPrep = session.preparation_id ? userPrepIds.includes(session.preparation_id) : false;

  const isGroupRestricted = session.group_id && session.group_id !== user?.group_id;
  const isPrepRestricted = session.preparation_id && !hasAccessViaPrep;
  const isRestricted = user?.role === 'athlete' && (
    (session.group_id && isGroupRestricted && !hasAccessViaPrep) ||
    (session.preparation_id && !session.group_id && isPrepRestricted)
  );

  if (isRestricted) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Cette seance ne vous est pas attribuee</p>
        <button onClick={() => navigate('/')} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const hasBlocks = session.blocks.length > 0;

  // Legacy pace calc (old sessions without blocks)
  const paces = !hasBlocks && user?.vma && session.target_distance && session.vma_percent_min && session.vma_percent_max
    ? calculatePaces(user.vma, session.vma_percent_min, session.vma_percent_max, session.target_distance)
    : null;

  const handleValidate = async () => {
    if (!user) return;
    const res = await validateSession(session.id, user.id, 'done', feedback || undefined, attachedFile || undefined, objectiveReached || undefined, sensations || undefined, buildMetrics());
    if ('error' in res) {
      toast.error("Échec de l'enregistrement. Vérifie tes chiffres.");
      return;
    }
    setShowValidation(false);
    setFeedback('');
    setObjectiveReached(null);
    setSensations(null);
    resetMetrics();
    removeFile();
  };

  const handleEditSave = async () => {
    if (!validation) return;
    const res = await updateValidation(validation.id, {
      feedback: feedback || undefined,
      objective_reached: objectiveReached,
      sensations: sensations,
      metrics: buildMetrics(true),
    }, attachedFile || undefined);
    if (res?.error) {
      toast.error('Échec de la mise à jour. Vérifie tes chiffres.');
      return;
    }
    setIsEditing(false);
    setFeedback('');
    setObjectiveReached(null);
    setSensations(null);
    resetMetrics();
    removeFile();
  };

  const startEditing = () => {
    if (validation) {
      setFeedback(validation.feedback || '');
      setObjectiveReached(validation.objective_reached || null);
      setSensations(validation.sensations || null);
      setDistanceKm(validation.distance_m != null ? String(validation.distance_m / 1000) : '');
      setDurationMin(validation.duration_s != null ? String(Math.round(validation.duration_s / 60)) : '');
      setElevationM(validation.elevation_m != null ? String(validation.elevation_m) : '');
      setAvgHrV(validation.avg_hr != null ? String(validation.avg_hr) : '');
      setIsEditing(true);
    }
  };

  const parseNum = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const buildMetrics = (forEdit = false): SessionMetricsInput | undefined => {
    const km = parseNum(distanceKm);
    const min = parseNum(durationMin);
    const elev = parseNum(elevationM);
    const hr = parseNum(avgHrV);
    const hasAny = km != null || min != null || elev != null || hr != null;
    // Création : aucune métrique saisie -> on n'envoie rien.
    // Édition : on renvoie toujours l'objet (les null effacent les champs gérés),
    // sans toucher aux champs non gérés par l'UI (max_hr, avg_cadence).
    if (!hasAny && !forEdit) return undefined;
    return {
      distance_m: km != null ? Math.round(km * 1000) : null,
      duration_s: min != null ? Math.round(min * 60) : null,
      elevation_m: elev != null ? Math.round(elev) : null,
      avg_hr: hr != null ? Math.round(hr) : null,
      metrics_source: hasAny ? (ocrFilled ? 'ocr' : 'manual') : null,
    };
  };
  const resetMetrics = () => {
    setDistanceKm('');
    setDurationMin('');
    setElevationM('');
    setAvgHrV('');
    setOcrFilled(false);
  };

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choisis une image (capture de ta montre ou de Strava).'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error('Image trop volumineuse (max 5 Mo).'); return; }
    setOcrLoading(true);
    setOcrError(null);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read'));
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('ai-ocr', { body: { image: dataUri } });
      if (error || data?.error || !data?.metrics) {
        setOcrError('Lecture impossible. Saisis tes chiffres à la main.');
        return;
      }
      const m = data.metrics;
      let any = false;
      if (m.distance_m != null) { setDistanceKm(String(m.distance_m / 1000)); any = true; }
      if (m.duration_s != null) { setDurationMin(String(Math.round(m.duration_s / 60))); any = true; }
      if (m.elevation_m != null) { setElevationM(String(m.elevation_m)); any = true; }
      if (m.avg_hr != null) { setAvgHrV(String(m.avg_hr)); any = true; }
      if (any) { setOcrFilled(true); toast.success("Chiffres détectés, vérifie-les avant d'enregistrer."); }
      else { setOcrError('Aucun chiffre détecté. Saisis-les à la main.'); }
    } catch {
      setOcrError('Lecture impossible. Saisis tes chiffres à la main.');
    } finally {
      setOcrLoading(false);
    }
  };
  const km = parseNum(distanceKm);
  const min = parseNum(durationMin);
  const livePace = pacePerKm(km != null ? Math.round(km * 1000) : null, min != null ? Math.round(min * 60) : null);

  return (
    <div className="py-4">
      {/* Header */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Title section */}
        <div className="bg-primary text-white p-5">
          <div className="flex items-center gap-2 mb-1">
            {group && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{group.name}</span>
            )}
            {!group && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Tous les groupes</span>
            )}
          </div>
          <h1 className="text-xl font-bold">
            {session.title}
            <span className="text-sm font-normal text-white/60 ml-2">{getSessionCode(session, sessions)}</span>
          </h1>
          <p className="text-white/80 mt-1">
            {format(new Date(session.date), 'EEEE d MMMM yyyy - HH:mm', { locale: fr })}
          </p>
          {session.location && (
            <div className="flex items-center gap-1 mt-2 text-white/70">
              <MapPin size={16} />
              {session.location_url ? (
                <a href={session.location_url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 underline hover:text-white">
                  {session.location} <ExternalLink size={12} />
                </a>
              ) : (
                <span>{session.location}</span>
              )}
            </div>
          )}
        </div>

        {/* Blocks timeline */}
        {hasBlocks && (
          <div className="mx-4 -mt-3 bg-accent/5 border-2 border-accent/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-accent font-bold text-sm uppercase">
                <Gauge size={18} />
                Programme
              </h2>
              <span className="text-xs text-gray-400">
                {session.blocks.some(b => b.distance_meters) ? '~' : ''}{formatSeconds(calculateSessionTotalSeconds(session.blocks, user?.vma || undefined, allureZones))} au total
              </span>
            </div>
            <div className="space-y-2">
              {session.blocks.map(block => {
                const zone = allureZones[block.allure] || ALLURE_ZONES[block.allure];
                const blockType = BLOCK_TYPES[block.type];
                const pace = user?.vma ? calculateBlockPace(user.vma, block.allure, allureZones) : null;
                const blockDur = formatSeconds(calculateBlockTotalSeconds(block, user?.vma || undefined, allureZones));

                return (
                  <div key={block.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">{blockType.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: zone.color }}>
                          {zone.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {formatBlockSummary(block, allureZones)}
                        <span className="text-gray-400 font-normal ml-2">({blockDur})</span>
                      </p>
                      {pace && (
                        <p className="text-xs mt-0.5" style={{ color: zone.color }}>
                          {pace.paceMin} - {pace.paceMax} min/km
                          <span className="text-gray-400 ml-1">
                            ({pace.speedMin.toFixed(1)}-{pace.speedMax.toFixed(1)} km/h)
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {user?.vma && (
              <p className="text-xs text-gray-400 mt-3">
                Calcule pour ta VMA de {user.vma} km/h
              </p>
            )}
          </div>
        )}

        {/* Legacy pace card (old sessions without blocks) */}
        {!hasBlocks && paces && (
          <div className="mx-4 -mt-3 bg-accent/5 border-2 border-accent/20 rounded-xl p-4">
            <h2 className="flex items-center gap-2 text-accent font-bold text-sm uppercase mb-3">
              <Gauge size={18} />
              Mes Allures Cibles
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Distance</p>
                <p className="text-2xl font-bold text-gray-900">{session.target_distance}m</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Intensite</p>
                <p className="text-2xl font-bold text-gray-900">
                  {session.vma_percent_min}-{session.vma_percent_max}%
                  <span className="text-sm font-normal text-gray-500 ml-1">VMA</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Allure cible</p>
                <p className="text-xl font-bold text-primary">
                  {paces.paceMin} - {paces.paceMax}
                  <span className="text-sm font-normal text-gray-500 ml-1">min/km</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">
                  <Timer size={14} className="inline mr-1" />
                  Chrono cible
                </p>
                <p className="text-xl font-bold text-accent">
                  {paces.timeMinDisplay} - {paces.timeMaxDisplay}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Calcule pour ta VMA de {user?.vma} km/h
            </p>
          </div>
        )}

        {/* No pace data but VMA percentages (legacy) */}
        {!hasBlocks && !paces && session.vma_percent_min && session.vma_percent_max && user?.vma && (
          <div className="mx-4 mt-4 bg-primary/5 rounded-xl p-4">
            <h2 className="flex items-center gap-2 text-primary font-bold text-sm uppercase mb-2">
              <Gauge size={18} />
              Intensite cible
            </h2>
            <p className="text-lg font-bold text-gray-900">
              {session.vma_percent_min}-{session.vma_percent_max}% VMA
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Soit {(user.vma * session.vma_percent_min / 100).toFixed(1)} - {(user.vma * session.vma_percent_max / 100).toFixed(1)} km/h
            </p>
          </div>
        )}

        {/* Description */}
        {session.description && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Consignes</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed">
              {session.description}
            </div>
          </div>
        )}

        {/* Nordik or Validation */}
        <div className="p-4 border-t border-gray-100">
          {session.is_personal && session.created_by !== user?.id ? (() => {
            const hasNordiked = user ? sessionNordiks.some(n => n.session_id === session.id && n.user_id === user.id) : false;
            return (
              <div className="text-center py-2">
                <button
                  onClick={() => user && toggleSessionNordik(session.id, user.id)}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-lg transition-all active:scale-110 ${
                    hasNordiked
                      ? 'bg-red-50 text-red-500'
                      : 'bg-gray-50 text-gray-400 hover:text-red-400 hover:bg-red-50'
                  }`}
                >
                  <Heart
                    size={22}
                    fill={hasNordiked ? 'currentColor' : 'none'}
                    className={hasNordiked ? 'animate-[pulse_0.3s_ease-in-out]' : ''}
                  />
                  Nordik
                </button>
                {hasNordiked && (
                  <p className="text-xs text-gray-400 mt-2">Tu as encourage cet athlete</p>
                )}
              </div>
            );
          })() : validation?.status === 'done' && !isEditing ? (
            <div className="bg-success/10 rounded-xl p-4">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ duration: DUR.slow, ease: EASE.bounce }}
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success-100 mb-2"
                >
                  <Check size={28} strokeWidth={3} className="text-success-700" aria-hidden="true" />
                </motion.div>
                <p className="font-semibold text-success-700">Séance validée !</p>
              </div>
              {(validation.objective_reached || validation.sensations) && (
                <div className="flex justify-center gap-4 mt-3">
                  {validation.objective_reached && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase">Objectif</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        validation.objective_reached === 'oui' ? 'bg-green-100 text-green-700' :
                        validation.objective_reached === 'partiel' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {validation.objective_reached === 'oui' ? 'Atteint' :
                         validation.objective_reached === 'partiel' ? 'Partiel' : 'Non atteint'}
                      </span>
                    </div>
                  )}
                  {validation.sensations && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase">Sensations</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        validation.sensations === 'excellentes' ? 'bg-green-100 text-green-700' :
                        validation.sensations === 'bonnes' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {validation.sensations.charAt(0).toUpperCase() + validation.sensations.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {(validation.distance_m != null || validation.duration_s != null || validation.elevation_m != null || validation.avg_hr != null) && (
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-sm">
                  {validation.distance_m != null && (
                    <span className="text-gray-600"><span className="font-semibold text-gray-900">{(validation.distance_m / 1000).toFixed(1)}</span> km</span>
                  )}
                  {validation.duration_s != null && (
                    <span className="font-semibold text-gray-900">{formatSeconds(validation.duration_s)}</span>
                  )}
                  {pacePerKm(validation.distance_m, validation.duration_s) && (
                    <span className="text-gray-600"><span className="font-semibold text-gray-900">{pacePerKm(validation.distance_m, validation.duration_s)}</span> /km</span>
                  )}
                  {validation.elevation_m != null && (
                    <span className="text-gray-600"><span className="font-semibold text-gray-900">{validation.elevation_m}</span> m D+</span>
                  )}
                  {validation.avg_hr != null && (
                    <span className="text-gray-600"><span className="font-semibold text-gray-900">{validation.avg_hr}</span> bpm</span>
                  )}
                </div>
              )}
              {validation.feedback && (
                <p className="text-sm text-gray-600 mt-3 italic text-center">"{validation.feedback}"</p>
              )}
              {validation.attachment_path && (
                <div className="text-center mt-2">
                  <a
                    href={getAttachmentUrl(validation.attachment_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Paperclip size={14} />
                    Voir la piece jointe
                  </a>
                </div>
              )}
              {validationReactions.filter(r => r.validation_id === validation?.id).length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {Array.from(new Set(validationReactions.filter(r => r.validation_id === validation?.id).map(r => r.emoji))).map(emoji => {
                    const count = validationReactions.filter(r => r.validation_id === validation?.id && r.emoji === emoji).length;
                    return (
                      <span key={emoji} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-sm">
                        <span aria-hidden="true">{emoji}</span>
                        {count > 1 && <span className="text-xs font-medium text-gray-600">{count}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="text-center mt-3">
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
                >
                  <Pencil size={12} />
                  Modifier
                </button>
              </div>
            </div>
          ) : (
            <>
              {!showValidation && !isEditing ? (
                <Button
                  variant="accent"
                  size="lg"
                  fullWidth
                  onClick={() => setShowValidation(true)}
                  className="text-lg py-3.5 h-auto"
                >
                  J'ai fait ma séance
                </Button>
              ) : (
                <div className="space-y-3">
                  {isEditing && (
                    <p className="text-sm font-medium text-gray-500">Modifier ta validation</p>
                  )}
                  {/* Mini-survey */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase mb-2">
                        <Target size={14} className="text-primary" />
                        Objectif atteint ?
                      </label>
                      <div className="flex gap-2">
                        {([['oui', 'Oui', 'bg-green-100 text-green-700 border-green-300'], ['partiel', 'Partiel', 'bg-yellow-100 text-yellow-700 border-yellow-300'], ['non', 'Non', 'bg-red-100 text-red-700 border-red-300']] as const).map(([val, label, colors]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setObjectiveReached(objectiveReached === val ? null : val)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              objectiveReached === val ? colors : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase mb-2">
                        <Smile size={14} className="text-accent" />
                        Sensations ?
                      </label>
                      <div className="flex gap-2">
                        {([['excellentes', 'Excellentes', 'bg-green-100 text-green-700 border-green-300'], ['bonnes', 'Bonnes', 'bg-blue-100 text-blue-700 border-blue-300'], ['mauvaises', 'Mauvaises', 'bg-red-100 text-red-700 border-red-300']] as const).map(([val, label, colors]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSensations(sensations === val ? null : val)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              sensations === val ? colors : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Métriques saisies (optionnel) */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase">
                      <Activity size={14} className="text-primary" />
                      Mes chiffres (optionnel)
                    </label>
                    <div>
                      <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOcrFile} />
                      <button
                        type="button"
                        onClick={() => ocrInputRef.current?.click()}
                        disabled={ocrLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-dark hover:text-accent disabled:opacity-60 transition-colors"
                      >
                        <Sparkles size={13} aria-hidden="true" />
                        {ocrLoading ? 'Lecture de la capture…' : 'Importer une capture (remplir par IA)'}
                      </button>
                      {ocrError && <p className="text-[11px] text-danger-600 mt-1">{ocrError}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[11px] text-gray-400 mb-1">Distance (km)</span>
                        <input inputMode="decimal" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="8"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-gray-400 mb-1">Durée (min)</span>
                        <input inputMode="numeric" value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder="45"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-gray-400 mb-1">D+ (m)</span>
                        <input inputMode="numeric" value={elevationM} onChange={e => setElevationM(e.target.value)} placeholder="120"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-gray-400 mb-1">FC moy (bpm)</span>
                        <input inputMode="numeric" value={avgHrV} onChange={e => setAvgHrV(e.target.value)} placeholder="148"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                      </label>
                    </div>
                    {livePace && (
                      <p className="text-xs text-gray-500">Allure estimée : <span className="font-semibold text-accent-dark">{livePace} /km</span></p>
                    )}
                  </div>

                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Comment t'es-tu senti ? (optionnel)"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <div>
                    {!attachedFile ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-accent transition-colors"
                      >
                        <Paperclip size={16} />
                        {isEditing && validation?.attachment_path ? 'Remplacer la piece jointe' : 'Ajouter un fichier (photo, PDF)'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                        {filePreview ? (
                          <img src={filePreview} alt="Preview" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-red-500">PDF</span>
                          </div>
                        )}
                        <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{attachedFile.name}</span>
                        <button type="button" onClick={removeFile} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowValidation(false);
                        setIsEditing(false);
                        setObjectiveReached(null);
                        setSensations(null);
                        setFeedback('');
                        resetMetrics();
                        removeFile();
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={isEditing ? handleEditSave : handleValidate}
                      className="flex-1 bg-accent hover:bg-accent-light text-white font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
