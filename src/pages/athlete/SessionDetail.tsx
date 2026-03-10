import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, MapPin, ExternalLink, Timer, Gauge, Check, Paperclip, X, Pencil, Target, Smile } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { calculatePaces, ALLURE_ZONES, BLOCK_TYPES, calculateBlockPace, calculateBlockTotalSeconds, calculateSessionTotalSeconds, formatSeconds, formatBlockSummary } from '../../lib/calculations';
import { useState, useRef } from 'react';
import { getAttachmentUrl } from '../../lib/storage';
import type { ObjectiveReached, Sensations } from '../../types';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, validations, validateSession, updateValidation, groups, userPreparations } = useData();

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Format non supporte. Utilise JPG, PNG, WebP, HEIC ou PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    setAttachedFile(file);
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
        <p className="text-gray-500">Seance introuvable</p>
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

  const handleValidate = () => {
    if (user) {
      validateSession(session.id, user.id, 'done', feedback || undefined, attachedFile || undefined, objectiveReached || undefined, sensations || undefined);
      setShowValidation(false);
      setFeedback('');
      setObjectiveReached(null);
      setSensations(null);
      removeFile();
    }
  };

  const handleEditSave = () => {
    if (validation) {
      updateValidation(validation.id, {
        feedback: feedback || undefined,
        objective_reached: objectiveReached,
        sensations: sensations,
      }, attachedFile || undefined);
      setIsEditing(false);
      setFeedback('');
      setObjectiveReached(null);
      setSensations(null);
      removeFile();
    }
  };

  const startEditing = () => {
    if (validation) {
      setFeedback(validation.feedback || '');
      setObjectiveReached(validation.objective_reached || null);
      setSensations(validation.sensations || null);
      setIsEditing(true);
    }
  };

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
          <h1 className="text-xl font-bold">{session.title}</h1>
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
                {session.blocks.some(b => b.distance_meters) ? '~' : ''}{formatSeconds(calculateSessionTotalSeconds(session.blocks, user?.vma || undefined))} au total
              </span>
            </div>
            <div className="space-y-2">
              {session.blocks.map(block => {
                const zone = ALLURE_ZONES[block.allure];
                const blockType = BLOCK_TYPES[block.type];
                const pace = user?.vma ? calculateBlockPace(user.vma, block.allure) : null;
                const blockDur = formatSeconds(calculateBlockTotalSeconds(block, user?.vma || undefined));

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
                        {formatBlockSummary(block)}
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

        {/* Validation */}
        <div className="p-4 border-t border-gray-100">
          {validation?.status === 'done' && !isEditing ? (
            <div className="bg-success/10 rounded-xl p-4">
              <div className="text-center">
                <Check size={24} className="mx-auto mb-1 text-success" />
                <p className="font-semibold text-success">Seance validee !</p>
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
                <button
                  onClick={() => setShowValidation(true)}
                  className="w-full bg-accent hover:bg-accent-light text-white font-semibold py-3.5 rounded-xl transition-colors text-lg"
                >
                  Valider la seance
                </button>
              ) : (
                <div className="space-y-3">
                  {isEditing && (
                    <p className="text-sm font-medium text-gray-500">Modifier votre validation</p>
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
