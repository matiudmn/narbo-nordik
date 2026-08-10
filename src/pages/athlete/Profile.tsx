import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Disclosure, useToast } from '../../components/ui';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Trophy, Bell, BellOff, Shield, Download, UserX, Camera, X, Lock, Loader2, Phone, Pencil, Check, IdCard, Cake, AlertTriangle, ChevronDown, User as UserIcon, History, Activity, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NordikButton from '../../components/NordikButton';
import PersonalSessionForm from '../../components/PersonalSessionForm';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDuration, formatSeconds } from '../../lib/calculations';
import { getFFACategory } from '../../lib/ffa';
import { isPrefChannelEnabled } from '../../lib/notificationPrefs';
import Avatar from '../../components/Avatar';
import { supabase } from '../../lib/supabase';
import ExpandableText from '../../components/ExpandableText';
import { ProfileTabs } from '../../components/athlete/ProfileTabs';
import type { ProfileTab } from '../../components/athlete/ProfileTabs';
import type { RaceType, NotificationPreferences, Session } from '../../types';

/**
 * Accordéon local historique. Ne reste utilisé que pour les sections qui ont
 * besoin d'un badge (compteur) et/ou d'une action dans l'en-tête (Séances
 * personnelles, Palmarès) : la primitive partagée `Disclosure` (C9,
 * src/components/ui/Disclosure.tsx) ne supporte pas ces deux props. Toutes
 * les autres sections du profil utilisent désormais `Disclosure`.
 */
function Accordion({ title, icon, children, defaultOpen = false, badge, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card padding="none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-neutral-900">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
          <ChevronDown size={18} className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </Card>
  );
}

const VALID_TABS = ['infos', 'sessions', 'account'] as const;

type NotifTypeRow = {
  key: keyof NotificationPreferences;
  label: string;
  hasInApp: boolean;
  hasEmail: boolean;
};

// Chaque rôle ne liste que les types qu'il peut réellement recevoir (cf. triggers notify_*
// et destinataires des fonctions weekly-digest / vma-missing-reminder).
const NOTIF_TYPES_ATHLETE: NotifTypeRow[] = [
  { key: 'new_session', label: 'Nouvelle seance', hasInApp: true, hasEmail: true },
  { key: 'palmares', label: 'Palmarès', hasInApp: true, hasEmail: false },
  { key: 'vma_update', label: 'Mise a jour VMA', hasInApp: true, hasEmail: true },
  { key: 'reaction', label: 'Kudos reçus', hasInApp: true, hasEmail: false },
  { key: 'weekly_digest', label: 'Digest hebdo', hasInApp: false, hasEmail: true },
];
const NOTIF_TYPES_COACH: NotifTypeRow[] = [
  { key: 'new_athlete', label: 'Nouvel athlète inscrit', hasInApp: true, hasEmail: true },
  { key: 'vma_missing', label: 'Rappel VMA manquantes', hasInApp: true, hasEmail: false },
  { key: 'palmares', label: 'Palmarès', hasInApp: true, hasEmail: false },
];

/**
 * NOTE: file is large because state and handlers are intricately shared
 * between tabs (photo upload spans Infos and header, etc.). Phase 1
 * (tabs via ?tab=) already delivered the UX win. A physical split into
 * src/pages/athlete/profile/{Infos,Sessions,Account}.tsx would require a
 * state machine refactor — defer until a concrete feature needs it.
 */
export default function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'infos';
  const tab: ProfileTab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as ProfileTab)
    : 'infos';
  const setTab = (next: ProfileTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };
  const { sessions, raceResults, addRaceResult, updateRaceResult, deleteRaceResult, deleteSession, groups, users, validations, preparations, userPreparations, updateUserPublic, updateUserPhone, updateUserLicense, updateUserBirthDate, updateUserPhoto, updateUserGroup, updateUserVma, updateNotificationPreferences } = useData();
  const { permission, requestPermission, notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const [showAddRace, setShowAddRace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [raceName, setRaceName] = useState('');
  const [raceType, setRaceType] = useState<RaceType>('route');
  const [raceDistance, setRaceDistance] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [raceTime, setRaceTime] = useState('');
  const [raceLabel, setRaceLabel] = useState(false);
  const [raceComment, setRaceComment] = useState('');
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [editingLicense, setEditingLicense] = useState(false);
  const [licenseValue, setLicenseValue] = useState('');
  const [editingBirthDate, setEditingBirthDate] = useState(false);
  const [birthDateValue, setBirthDateValue] = useState('');
  const [editingVma, setEditingVma] = useState(false);
  const [vmaValue, setVmaValue] = useState('');
  const [vmaReason, setVmaReason] = useState('');
  const [submittingVma, setSubmittingVma] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showAddPerso, setShowAddPerso] = useState(false);
  const [editingPersoSession, setEditingPersoSession] = useState<Session | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [exitComment, setExitComment] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const EXIT_REASONS = [
    { value: 'blessure', label: 'Blessure' },
    { value: 'demenagement', label: 'Demenagement' },
    { value: 'arret_sport', label: 'Arret du sport' },
    { value: 'app_complexe', label: 'Application trop complexe' },
    { value: 'tarif', label: 'Tarif' },
    { value: 'autre', label: 'Autre' },
  ];

  const isSoleCoach = user?.role === 'coach' && users.filter(u => u.role === 'coach').length <= 1;

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'SUPPRIMER' || !exitReason) return;
    setDeleteLoading(true);
    try {
      await supabase.from('exit_feedbacks').insert({
        reason: exitReason,
        comment: exitComment.trim() || null,
      });
      await supabase.from('users').delete().eq('id', user.id);
      await supabase.auth.signOut();
      localStorage.removeItem('narbo_rgpd_consent');
      localStorage.removeItem('narbo_notif_enabled');
      window.location.href = '/';
    } catch {
      setDeleteLoading(false);
    }
  };

  if (!user) return null;

  const userRaces = raceResults
    .filter(r => r.user_id === user.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const personalSessions = sessions
    .filter(s => s.is_personal && s.created_by === user.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const PERSO_TYPE_LABEL: Record<string, string> = {
    entrainement: 'Run',
    course: 'Course',
    velo: 'Velo',
    marche: 'Marche',
    renfo: 'Renfo',
  };

  const PERSO_TYPE_COLOR: Record<string, string> = {
    entrainement: 'bg-primary/10 text-primary',
    course: 'bg-warning-100 text-warning-700',
    velo: 'bg-info-100 text-info-700',
    marche: 'bg-success-100 text-success-700',
    renfo: 'bg-warning-100 text-warning-700',
  };

  const getPersoSessionDuration = (s: Session) => {
    if (s.session_type === 'entrainement' || s.session_type === 'course') {
      const total = s.blocks.reduce((acc, b) => acc + (b.duration_seconds * b.repetitions) + (b.rest_seconds * Math.max(0, b.repetitions - 1)), 0);
      return total > 0 ? formatSeconds(total) : null;
    }
    if (s.blocks[0]?.duration_seconds) return formatSeconds(s.blocks[0].duration_seconds);
    return null;
  };

  const group = groups.find(g => g.id === user.group_id);
  const userPrepId = userPreparations.find(up => up.user_id === user.id)?.preparation_id;
  const currentPrep = userPrepId ? preparations.find(p => p.id === userPrepId) : null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 200;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else { w = Math.round(w * max / h); h = max; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) updateUserPhoto(user.id, new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetRaceForm = () => {
    setShowAddRace(false);
    setEditingRaceId(null);
    setRaceName(''); setRaceDistance(''); setRaceDate(''); setRaceTime(''); setRaceLabel(false); setRaceComment('');
  };

  const handleAddRace = () => {
    if (!raceName || !raceDistance || !raceDate || !raceTime) return;
    if (editingRaceId) {
      updateRaceResult(editingRaceId, {
        race_name: raceName,
        race_type: raceType,
        distance_km: parseFloat(raceDistance),
        date: raceDate,
        time_duration: raceTime,
        is_label: raceLabel,
        comment: raceComment.trim() || null,
      });
    } else {
      addRaceResult({
        user_id: user.id,
        race_name: raceName,
        race_type: raceType,
        distance_km: parseFloat(raceDistance),
        date: raceDate,
        time_duration: raceTime,
        is_label: raceLabel,
        comment: raceComment.trim() || null,
      });
    }
    resetRaceForm();
  };

  const startEditRace = (race: typeof raceResults[0]) => {
    setEditingRaceId(race.id);
    setRaceName(race.race_name);
    setRaceType(race.race_type);
    setRaceDistance(String(race.distance_km));
    setRaceDate(race.date);
    setRaceTime(race.time_duration);
    setRaceLabel(race.is_label);
    setRaceComment(race.comment || '');
    setShowAddRace(true);
  };

  const raceTypeLabel: Record<RaceType, string> = { route: 'Route', trail: 'Trail', piste: 'Piste' };
  const raceTypeColor: Record<RaceType, string> = { route: 'bg-blue-100 text-blue-700', trail: 'bg-green-100 text-green-700', piste: 'bg-purple-100 text-purple-700' };

  return (
    <div className="py-4 space-y-3">
      {/* Header card - always visible */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={() => fileInputRef.current?.click()} className="group">
              <Avatar user={user} size="lg" />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
            </button>
            {user.photo_url && (
              <button
                onClick={() => updateUserPhoto(user.id, null)}
                className="absolute -top-1 -right-1 w-6 h-6 bg-danger-500 text-white rounded-full flex items-center justify-center shadow"
              >
                <X size={12} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900 text-lg">{user.firstname} {user.lastname}</p>
            <p className="text-sm text-neutral-400">
              {group?.name || 'Aucun groupe'}
              {currentPrep && <span className="text-warning-600 ml-2">| {currentPrep.name}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {user.vma && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  VMA {user.vma} km/h
                </span>
              )}
              {user.birth_date && (
                <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                  {getFFACategory(user.birth_date).code}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs sticky — découpe en 4 sections */}
      <ProfileTabs current={tab} onChange={setTab} />

      {/* === TAB: INFOS === */}
      {tab === 'infos' && (
      <>
      {/* Informations personnelles */}
      <Disclosure title="Informations" headingLevel={2} icon={<UserIcon size={18} className="text-primary" />}>
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-400">Prenom</p>
              <p className="font-medium text-neutral-900">{user.firstname}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Nom</p>
              <p className="font-medium text-neutral-900">{user.lastname}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Email</p>
              <p className="font-medium text-neutral-900 text-sm">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Groupe</p>
              {user.role === 'coach' ? (
                <select
                  value={user.group_id || ''}
                  onChange={async (e) => {
                    await updateUserGroup(user.id, e.target.value || null);
                    await refreshUser();
                  }}
                  className="font-medium text-neutral-900 text-sm bg-transparent border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Aucun groupe</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-neutral-900">{group?.name || '-'}</p>
              )}
            </div>
          </div>

          {/* VMA */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">VMA</p>
              {editingVma && user.role === 'coach' ? (
                <div className="space-y-1.5 mt-0.5">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="5"
                      max="30"
                      value={vmaValue}
                      onChange={e => setVmaValue(e.target.value)}
                      disabled={submittingVma}
                      className="w-20 px-2 py-1 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                      autoFocus
                    />
                    <span className="text-xs text-neutral-400">km/h</span>
                    <button
                      onClick={async () => {
                        if (submittingVma) return;
                        const v = parseFloat(vmaValue);
                        if (v >= 5 && v <= 30) {
                          setSubmittingVma(true);
                          const res = await updateUserVma(user.id, v, vmaReason.trim() || undefined);
                          setSubmittingVma(false);
                          if (res.error) {
                            toast.error("Échec de la mise à jour de la VMA.");
                            return;
                          }
                          await refreshUser();
                          setEditingVma(false);
                          setVmaReason('');
                        }
                      }}
                      disabled={submittingVma}
                      className="p-1 text-success-600 hover:text-success-700 disabled:opacity-60"
                    >
                      <Check size={16} />
                    </button>
                    <button onClick={() => { setEditingVma(false); setVmaReason(''); }} disabled={submittingVma} className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-60">
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={vmaReason}
                    onChange={e => setVmaReason(e.target.value)}
                    disabled={submittingVma}
                    placeholder="Raison (test piste, estimation...)"
                    className="w-full px-2 py-1 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  />
                </div>
              ) : (
                <p className="font-medium text-neutral-900">{user.vma ? `${user.vma} km/h` : 'Non renseignee'}</p>
              )}
            </div>
            {user.role === 'coach' && !editingVma ? (
              <button
                onClick={() => { setVmaValue(user.vma?.toString() || ''); setEditingVma(true); setVmaReason(''); }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Modifier
              </button>
            ) : user.role !== 'coach' ? (
              <span className="text-xs text-neutral-400 italic">Modifiable par le coach</span>
            ) : null}
          </div>

          {/* Toggle public */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900">Profil public</p>
              <p className="text-xs text-neutral-400">Visible dans l'annuaire et la recherche par les autres athletes</p>
            </div>
            <button
              onClick={async () => { await updateUserPublic(user.id, !user.is_public); await refreshUser(); }}
              className={`w-11 h-6 rounded-full relative transition-colors ${user.is_public ? 'bg-primary' : 'bg-neutral-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${user.is_public ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </Disclosure>

      {/* Historique (VMA + seances) */}
      <Disclosure title="Historique" headingLevel={2} icon={<History size={18} className="text-primary" />}>
        <div className="space-y-1">
          {user.vma_history.length > 0 && (
            <Link to="/vma-history" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <History size={12} />
              Voir l'historique VMA
            </Link>
          )}
          <Link to="/training-history" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <History size={12} />
            Historique des seances
          </Link>
        </div>
      </Disclosure>

      {/* Coordonnees (telephone, licence, date de naissance) */}
      <Disclosure title="Coordonnées" headingLevel={2} icon={<IdCard size={18} className="text-primary" />}>
        <div className="space-y-1">
          {/* Phone */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-success-600" />
              <div>
                <p className="text-xs text-neutral-400">Telephone (WhatsApp)</p>
                {editingPhone ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="0612345678 ou +33612345678"
                      value={phoneValue}
                      onChange={e => setPhoneValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const raw = phoneValue.replace(/[^0-9]/g, '').replace(/^0/, '33');
                          const v = raw || null;
                          updateUserPhone(user.id, v).then(() => refreshUser());
                          setEditingPhone(false);
                        }
                      }}
                      className="w-36 px-2 py-1 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const raw = phoneValue.replace(/[^0-9]/g, '').replace(/^0/, '33');
                        const v = raw || null;
                        updateUserPhone(user.id, v).then(() => refreshUser());
                        setEditingPhone(false);
                      }}
                      className="p-1 text-success-600 hover:bg-success-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingPhone(false)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-neutral-900 text-sm">{user.phone ? `+${user.phone}` : 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingPhone && (
              <button
                onClick={() => { setPhoneValue(user.phone || ''); setEditingPhone(true); setEditingLicense(false); setEditingBirthDate(false); }}
                className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* License number */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IdCard size={16} className="text-primary" />
              <div>
                <p className="text-xs text-neutral-400">Numero de licence</p>
                {editingLicense ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="text"
                      placeholder="Ex: 1234567"
                      value={licenseValue}
                      onChange={e => setLicenseValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = licenseValue.trim() || null;
                          updateUserLicense(user.id, v).then(() => refreshUser());
                          setEditingLicense(false);
                        }
                      }}
                      className="w-36 px-2 py-1 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const v = licenseValue.trim() || null;
                        updateUserLicense(user.id, v).then(() => refreshUser());
                        setEditingLicense(false);
                      }}
                      className="p-1 text-primary hover:bg-primary/10 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingLicense(false)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-neutral-900 text-sm">{user.license_number || 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingLicense && (
              <button
                onClick={() => { setLicenseValue(user.license_number || ''); setEditingLicense(true); setEditingPhone(false); setEditingBirthDate(false); }}
                className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* Birth date + FFA Category */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cake size={16} className="text-pink-500" />
              <div>
                <p className="text-xs text-neutral-400">Date de naissance</p>
                {editingBirthDate ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="date"
                      value={birthDateValue}
                      onChange={e => setBirthDateValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = birthDateValue || null;
                          updateUserBirthDate(user.id, v).then(() => refreshUser());
                          setEditingBirthDate(false);
                        }
                      }}
                      className="px-2 py-1 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const v = birthDateValue || null;
                        updateUserBirthDate(user.id, v).then(() => refreshUser());
                        setEditingBirthDate(false);
                      }}
                      className="p-1 text-pink-500 hover:bg-pink-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingBirthDate(false)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-900 text-sm">
                      {user.birth_date ? format(new Date(user.birth_date), 'dd/MM/yyyy') : 'Non renseigne'}
                    </p>
                    {user.birth_date && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        {getFFACategory(user.birth_date).label} ({getFFACategory(user.birth_date).code})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!editingBirthDate && (
              <button
                onClick={() => { setBirthDateValue(user.birth_date || ''); setEditingBirthDate(true); setEditingPhone(false); setEditingLicense(false); }}
                className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
      </Disclosure>
      </>
      )}

      {/* === TAB: SÉANCES (perso + palmarès) === */}
      {tab === 'sessions' && (
      <>
      {/* Seances personnelles */}
      <Accordion
        title="Séances personnelles"
        icon={<Activity size={18} className="text-primary" />}
        defaultOpen={false}
        badge={personalSessions.length > 0 ? <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{personalSessions.length}</span> : undefined}
        action={
          <button
            onClick={() => { setShowAddPerso(!showAddPerso); setEditingPersoSession(null); }}
            className="flex items-center gap-1 text-sm text-primary font-medium hover:text-primary/80"
          >
            <Plus size={16} />
          </button>
        }
      >
        {(showAddPerso || editingPersoSession) && (
          <PersonalSessionForm
            onClose={() => { setShowAddPerso(false); setEditingPersoSession(null); }}
            editSession={editingPersoSession || undefined}
          />
        )}

        {personalSessions.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">Aucune séance perso ajoutée pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {personalSessions.map(s => {
              const dur = getPersoSessionDuration(s);
              return (
                <div key={s.id} className="flex items-center gap-3 border border-neutral-100 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PERSO_TYPE_COLOR[s.session_type] || 'bg-neutral-100 text-neutral-600'}`}>
                        {PERSO_TYPE_LABEL[s.session_type] || s.session_type}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {format(new Date(s.date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                      {dur && <span className="text-xs text-neutral-500 font-medium">{dur}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingPersoSession(s); setShowAddPerso(false); }}
                    className="p-1.5 text-neutral-300 hover:text-primary transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="p-1.5 text-neutral-300 hover:text-danger-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Accordion>

      {/* Palmarès */}
      <Accordion
        title="Palmarès"
        icon={<Trophy size={18} className="text-accent" />}
        defaultOpen={false}
        badge={userRaces.length > 0 ? <span className="text-xs bg-accent/10 text-accent-text px-1.5 py-0.5 rounded-full font-medium">{userRaces.length}</span> : undefined}
        action={
          <button
            onClick={() => setShowAddRace(!showAddRace)}
            className="flex items-center gap-1 text-sm text-accent font-medium hover:text-accent-light"
          >
            <Plus size={16} />
          </button>
        }
      >
        {/* Add race form */}
        {showAddRace && (
          <div className="bg-neutral-50 rounded-lg p-3 mb-4 space-y-3">
            <input
              type="text"
              placeholder="Nom de la course"
              value={raceName}
              onChange={e => setRaceName(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={raceType}
                onChange={e => setRaceType(e.target.value as RaceType)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="route">Route</option>
                <option value="trail">Trail</option>
                <option value="piste">Piste</option>
              </select>
              <input
                type="number"
                step="0.1"
                placeholder="Distance (km)"
                value={raceDistance}
                onChange={e => setRaceDistance(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="hh:mm:ss"
                value={raceTime}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  let formatted = digits;
                  if (digits.length > 4) formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
                  else if (digits.length > 2) formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
                  setRaceTime(formatted);
                }}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <textarea
              placeholder="Commentaire (optionnel)"
              value={raceComment}
              onChange={e => setRaceComment(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={raceLabel} onChange={e => setRaceLabel(e.target.checked)} className="rounded border-neutral-300 text-accent focus:ring-accent/30" />
              <span className="text-sm text-neutral-700">Course a label</span>
            </label>
            <div className="flex gap-2">
              <button onClick={resetRaceForm} className="flex-1 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600">Annuler</button>
              <button onClick={handleAddRace} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">{editingRaceId ? 'Modifier' : 'Ajouter'}</button>
            </div>
          </div>
        )}

        {/* Race list */}
        {userRaces.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">Aucune course enregistrée pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {userRaces.map(race => (
              <div key={race.id} className="flex items-center gap-3 border border-neutral-100 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 text-sm truncate">
                    {race.race_name}
                    {race.is_label && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-warning-100 text-warning-700 rounded-full font-medium">Label</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${raceTypeColor[race.race_type]}`}>
                      {raceTypeLabel[race.race_type]}
                    </span>
                    <span className="text-xs text-neutral-400">{race.distance_km} km</span>
                    <span className="text-xs text-neutral-400">
                      {format(new Date(race.date), 'dd/MM/yyyy', { locale: fr })}
                    </span>
                  </div>
                  {race.comment && (
                    <ExpandableText text={race.comment} maxLines={2} className="text-xs text-neutral-500 italic mt-1" />
                  )}
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">{formatDuration(race.time_duration)}</span>
                <NordikButton raceId={race.id} />
                <button
                  onClick={() => startEditRace(race)}
                  className="p-1.5 text-neutral-300 hover:text-accent transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => deleteRaceResult(race.id)}
                  className="p-1.5 text-neutral-300 hover:text-danger-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Accordion>
      </>
      )}

      {/* === TAB: COMPTE (notifs + sécurité + données) === */}
      {tab === 'account' && (
      <>
      {/* Notifications */}
      <Disclosure title="Notifications" headingLevel={2} icon={<Bell size={18} className="text-primary" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900">Notifications push</p>
              <p className="text-xs text-neutral-400">
                {permission === 'granted' ? 'Actives' : permission === 'denied' ? 'Bloquees par le navigateur' : 'Non activees'}
              </p>
            </div>
            {permission === 'granted' ? (
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-neutral-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${notificationsEnabled ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            ) : permission === 'denied' ? (
              <BellOff size={20} className="text-neutral-400" />
            ) : (
              <button
                onClick={requestPermission}
                className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-light transition-colors"
              >
                Activer
              </button>
            )}
          </div>

          <div className="border-t border-neutral-100 pt-3">
            <p className="text-sm font-medium text-neutral-900 mb-3">Preferences par type</p>
            <div className="space-y-3">
              {(user?.role === 'coach' ? NOTIF_TYPES_COACH : NOTIF_TYPES_ATHLETE).map(({ key, label, hasInApp, hasEmail }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{label}</span>
                  <div className="flex items-center gap-3">
                    {hasInApp && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-xs text-neutral-400">In-app</span>
                        <button
                          onClick={async () => {
                            if (!user) return;
                            const prefs = { ...user.notification_preferences };
                            const current = prefs[key] as { in_app?: boolean } | undefined;
                            const enabled = isPrefChannelEnabled(current, 'in_app');
                            (prefs as Record<string, unknown>)[key] = { ...current, in_app: !enabled };
                            await updateNotificationPreferences(user.id, prefs as NotificationPreferences);
                            refreshUser();
                          }}
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            isPrefChannelEnabled(user?.notification_preferences?.[key], 'in_app') ? 'bg-primary' : 'bg-neutral-300'
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${
                            isPrefChannelEnabled(user?.notification_preferences?.[key], 'in_app') ? 'left-4.5' : 'left-0.5'
                          }`} />
                        </button>
                      </label>
                    )}
                    {hasEmail && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-xs text-neutral-400">Email</span>
                        <button
                          onClick={async () => {
                            if (!user) return;
                            const prefs = { ...user.notification_preferences };
                            const current = prefs[key] as { email?: boolean } | undefined;
                            const enabled = isPrefChannelEnabled(current, 'email');
                            (prefs as Record<string, unknown>)[key] = { ...current, email: !enabled };
                            await updateNotificationPreferences(user.id, prefs as NotificationPreferences);
                            refreshUser();
                          }}
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            isPrefChannelEnabled(user?.notification_preferences?.[key], 'email') ? 'bg-primary' : 'bg-neutral-300'
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${
                            isPrefChannelEnabled(user?.notification_preferences?.[key], 'email') ? 'left-4.5' : 'left-0.5'
                          }`} />
                        </button>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      {/* Securite */}
      <Disclosure title="Sécurité" headingLevel={2} icon={<Lock size={18} className="text-primary" />}>
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">Modifier ton mot de passe</p>
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {passwordError && <p className="text-danger-500 text-sm">{passwordError}</p>}
          {passwordSuccess && <p className="text-success-600 text-sm">Mot de passe modifié avec succès</p>}
          <button
            onClick={handleChangePassword}
            disabled={!newPassword || !confirmPassword || passwordLoading}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {passwordLoading && <Loader2 size={16} className="animate-spin" />}
            Modifier
          </button>
        </div>
      </Disclosure>

      {/* Donnees personnelles */}
      <Disclosure title="Données personnelles" headingLevel={2} icon={<Shield size={18} className="text-primary" />}>
        <div className="space-y-3">
          <button
            onClick={() => {
              const data = {
                profil: user,
                courses: userRaces,
                validations: validations.filter(v => v.user_id === user.id),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `narbo-nordik-export-${user.firstname.toLowerCase()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <Download size={16} className="text-primary" />
            <span>Exporter mes données (JSON)</span>
          </button>
          <button
            onClick={() => {
              setDeleteConfirmText('');
              setExitReason('');
              setExitComment('');
              setShowDeleteModal(true);
            }}
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm text-danger-600 bg-danger-50 hover:bg-danger-100 rounded-lg transition-colors"
          >
            <UserX size={16} />
            <span>Supprimer mon compte et mes donnees</span>
          </button>
          <Link
            to="/legal/privacy"
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <FileText size={16} className="text-primary" />
            <span>Lire la politique de confidentialité</span>
          </Link>
          <p className="text-xs text-neutral-400">
            Conforme RGPD. Tes données sont stockées de manière sécurisée.
          </p>
        </div>
      </Disclosure>
      </>
      )}

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-danger-600" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">Supprimer mon compte</h3>
                  <p className="text-xs text-neutral-500">Action irreversible</p>
                </div>
              </div>

              <div className="bg-danger-50 border border-danger-100 rounded-lg p-3">
                <p className="text-sm text-danger-700">
                  Cette action supprimera definitivement votre compte, vos resultats de courses, vos validations de seances et toutes vos donnees personnelles. Aucune recuperation ne sera possible.
                </p>
              </div>

              {isSoleCoach && (
                <div className="bg-warning-50 border border-warning-100 rounded-lg p-3">
                  <p className="text-sm text-warning-700 font-medium">
                    Vous etes le seul coach du club. Veuillez d'abord nommer un autre coach avant de supprimer votre compte.
                  </p>
                </div>
              )}

              {!isSoleCoach && (
                <>
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-2">
                      Pourquoi souhaitez-vous partir ?
                    </p>
                    <div className="space-y-2">
                      {EXIT_REASONS.map(r => (
                        <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="exitReason"
                            value={r.value}
                            checked={exitReason === r.value}
                            onChange={e => setExitReason(e.target.value)}
                            className="w-4 h-4 text-danger-600 focus:ring-danger-500"
                          />
                          <span className="text-sm text-neutral-700">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-500 block mb-1">
                      Commentaire (optionnel)
                    </label>
                    <textarea
                      value={exitComment}
                      onChange={e => setExitComment(e.target.value)}
                      placeholder="Un retour pour nous aider a nous ameliorer..."
                      rows={2}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-danger-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-700 block mb-1">
                      Tapez <span className="font-bold text-danger-600">SUPPRIMER</span> pour confirmer
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder="SUPPRIMER"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-danger-100"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-600 font-medium hover:bg-neutral-50 transition-colors"
                >
                  Annuler
                </button>
                {!isSoleCoach && (
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'SUPPRIMER' || !exitReason || deleteLoading}
                    className="flex-1 py-2.5 bg-danger-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-danger-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
