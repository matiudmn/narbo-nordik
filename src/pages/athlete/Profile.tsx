import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Trophy, Bell, BellOff, Shield, Download, UserX, Camera, X, Lock, Loader2, Phone, Pencil, Check, IdCard, Cake, AlertTriangle, ChevronDown, User as UserIcon, History, Activity, RefreshCw, Unlink, ExternalLink, Link2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NordikButton from '../../components/NordikButton';
import PersonalSessionForm from '../../components/PersonalSessionForm';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDuration, formatSeconds } from '../../lib/calculations';
import { getFFACategory } from '../../lib/ffa';
import Avatar from '../../components/Avatar';
import { supabase } from '../../lib/supabase';
import ExpandableText from '../../components/ExpandableText';
import { useStrava } from '../../hooks/useStrava';
import type { RaceType, NotificationPreferences, Session, StravaActivity } from '../../types';

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
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-gray-900">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </div>
  );
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { sessions, raceResults, addRaceResult, updateRaceResult, deleteRaceResult, deleteSession, addSession, validateSession, groups, users, validations, preparations, userPreparations, updateUserPublic, updateUserPhone, updateUserLicense, updateUserBirthDate, updateUserPhoto, updateUserGroup, updateUserVma, updateNotificationPreferences } = useData();
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
  const [confirmDisconnectStrava, setConfirmDisconnectStrava] = useState(false);
  const [editingLicense, setEditingLicense] = useState(false);
  const [licenseValue, setLicenseValue] = useState('');
  const [editingBirthDate, setEditingBirthDate] = useState(false);
  const [birthDateValue, setBirthDateValue] = useState('');
  const [editingVma, setEditingVma] = useState(false);
  const [vmaValue, setVmaValue] = useState('');
  const [vmaReason, setVmaReason] = useState('');

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

  const strava = useStrava();
  useEffect(() => { strava.checkConnection(); }, [strava.checkConnection]);

  const stravaClientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const stravaRedirectUri = `${window.location.origin}/strava/callback`;
  const stravaAuthUrl = stravaClientId
    ? `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaRedirectUri)}&approval_prompt=auto&scope=activity:read_all,profile:read_all`
    : null;
  const [creatingFromStrava, setCreatingFromStrava] = useState<string | null>(null);
  const [allStravaActivities, setAllStravaActivities] = useState<StravaActivity[]>([]);
  const [showStravaMatching, setShowStravaMatching] = useState(false);
  const [matchingActivityId, setMatchingActivityId] = useState<string | null>(null);

  const loadStravaActivities = async () => {
    if (!user) return;
    const { data } = await supabase.from('strava_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date_local', { ascending: false })
      .limit(30);
    if (data) setAllStravaActivities(data as StravaActivity[]);
    setShowStravaMatching(true);
    if (!strava.athleteStats) strava.fetchStats();
  };

  const getSessionsForDate = (dateStr: string) => {
    if (!user) return [];
    const actDate = new Date(dateStr);
    const minDate = new Date(actDate);
    minDate.setDate(minDate.getDate() - 4);
    const maxDate = new Date(actDate);
    maxDate.setDate(maxDate.getDate() + 4);
    return sessions.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= minDate && sDate <= maxDate && (
        s.created_by === user.id ||
        validations.some(v => v.session_id === s.id && v.user_id === user.id)
      );
    });
  };

  const handleMatchToSession = async (act: StravaActivity, sessionId: string) => {
    setMatchingActivityId(act.id);
    const { error } = await supabase.from('strava_activities')
      .update({ matched_session_id: sessionId, match_status: 'manual' })
      .eq('id', act.id);
    if (error) {
      console.error('Match error:', error);
      alert(`Erreur lors de l'association : ${error.message}`);
    } else {
      setAllStravaActivities(prev => prev.map(a => a.id === act.id ? { ...a, matched_session_id: sessionId, match_status: 'manual' } : a));
    }
    setMatchingActivityId(null);
  };

  const handleCreateSessionFromStrava = async (act: StravaActivity) => {
    if (!user) return;
    setCreatingFromStrava(act.id);

    const sportMap: Record<string, Session['session_type']> = {
      Run: 'entrainement', Trail: 'entrainement', Walk: 'marche',
      Hike: 'marche', Ride: 'velo', VirtualRide: 'velo',
    };
    const sessionType = sportMap[act.sport_type] || 'entrainement';

    const distMeters = act.distance_meters || null;
    const durationSec = act.moving_time_seconds || 0;

    const block = {
      id: `blk_strava_${Date.now()}`,
      type: 'travail' as const,
      allure: 'ef' as const,
      duration_seconds: durationSec,
      distance_meters: distMeters,
      repetitions: 1,
      rest_seconds: 0,
      rest_distance_meters: null,
    };

    const result = await addSession({
      title: act.name || act.sport_type,
      date: act.start_date_local || act.start_date,
      session_type: sessionType,
      terrain_options: [],
      location: null,
      location_url: null,
      description: null,
      group_id: null,
      preparation_id: null,
      target_distance: null,
      vma_percent_min: null,
      vma_percent_max: null,
      blocks: [block],
      is_personal: true,
      created_by: user.id,
    });

    if ('id' in result) {
      await validateSession(result.id, user.id, 'done');
      const { error } = await supabase.from('strava_activities')
        .update({ matched_session_id: result.id, match_status: 'manual' })
        .eq('id', act.id);
      if (error) {
        console.error('Auto-match error:', error);
        alert(`Seance creee mais erreur lors de l'association automatique : ${error.message}`);
      } else {
        setAllStravaActivities(prev => prev.map(a => a.id === act.id ? { ...a, matched_session_id: result.id, match_status: 'manual' } : a));
      }
    }
    setCreatingFromStrava(null);
  };

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
    course: 'bg-amber-100 text-amber-700',
    velo: 'bg-blue-100 text-blue-700',
    marche: 'bg-green-100 text-green-700',
    renfo: 'bg-orange-100 text-orange-700',
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
        updateUserPhoto(user.id, canvas.toDataURL('image/jpeg', 0.7));
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
      <div className="bg-white rounded-xl border border-gray-100 p-4">
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
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
              >
                <X size={12} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg">{user.firstname} {user.lastname}</p>
            <p className="text-sm text-gray-400">
              {group?.name || 'Aucun groupe'}
              {currentPrep && <span className="text-amber-600 ml-2">| {currentPrep.name}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {user.vma && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  VMA {user.vma} km/h
                </span>
              )}
              {user.birth_date && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {getFFACategory(user.birth_date).code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <Accordion
        title="Informations"
        icon={<UserIcon size={18} className="text-primary" />}
        defaultOpen={false}
      >
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Prenom</p>
              <p className="font-medium text-gray-900">{user.firstname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Nom</p>
              <p className="font-medium text-gray-900">{user.lastname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="font-medium text-gray-900 text-sm">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Groupe</p>
              {user.role === 'coach' ? (
                <select
                  value={user.group_id || ''}
                  onChange={async (e) => {
                    await updateUserGroup(user.id, e.target.value || null);
                    await refreshUser();
                  }}
                  className="font-medium text-gray-900 text-sm bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Aucun groupe</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-gray-900">{group?.name || '-'}</p>
              )}
            </div>
          </div>

          {/* VMA */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">VMA</p>
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
                      className="w-20 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    <span className="text-xs text-gray-400">km/h</span>
                    <button
                      onClick={async () => {
                        const v = parseFloat(vmaValue);
                        if (v >= 5 && v <= 30) {
                          await updateUserVma(user.id, v, vmaReason.trim() || undefined);
                          await refreshUser();
                          setEditingVma(false);
                          setVmaReason('');
                        }
                      }}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <Check size={16} />
                    </button>
                    <button onClick={() => { setEditingVma(false); setVmaReason(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={vmaReason}
                    onChange={e => setVmaReason(e.target.value)}
                    placeholder="Raison (test piste, estimation...)"
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ) : (
                <p className="font-medium text-gray-900">{user.vma ? `${user.vma} km/h` : 'Non renseignee'}</p>
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
              <span className="text-xs text-gray-400 italic">Modifiable par le coach</span>
            ) : null}
          </div>
          {user.vma_history.length > 0 && (
            <Link to="/vma-history" className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
              <History size={12} />
              Voir l'historique VMA
            </Link>
          )}
          <Link to="/training-history" className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
            <History size={12} />
            Historique des seances
          </Link>

          {/* Phone */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-green-600" />
              <div>
                <p className="text-xs text-gray-400">Telephone (WhatsApp)</p>
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
                      className="w-36 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const raw = phoneValue.replace(/[^0-9]/g, '').replace(/^0/, '33');
                        const v = raw || null;
                        updateUserPhone(user.id, v).then(() => refreshUser());
                        setEditingPhone(false);
                      }}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingPhone(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900 text-sm">{user.phone ? `+${user.phone}` : 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingPhone && (
              <button
                onClick={() => { setPhoneValue(user.phone || ''); setEditingPhone(true); setEditingLicense(false); setEditingBirthDate(false); }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* Strava status badge (detail in section below) */}
          {strava.connected && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#FC4C02]" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                  <Check size={12} /> Strava connecte
                </span>
              </div>
            </div>
          )}

          {/* License number */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IdCard size={16} className="text-primary" />
              <div>
                <p className="text-xs text-gray-400">Numero de licence</p>
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
                      className="w-36 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    <button onClick={() => setEditingLicense(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900 text-sm">{user.license_number || 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingLicense && (
              <button
                onClick={() => { setLicenseValue(user.license_number || ''); setEditingLicense(true); setEditingPhone(false); setEditingBirthDate(false); }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
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
                <p className="text-xs text-gray-400">Date de naissance</p>
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
                      className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    <button onClick={() => setEditingBirthDate(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm">
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
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* Toggle public */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Profil public</p>
              <p className="text-xs text-gray-400">VMA, telephone et Strava visibles par les athletes</p>
            </div>
            <button
              onClick={async () => { await updateUserPublic(user.id, !user.is_public); await refreshUser(); }}
              className={`w-11 h-6 rounded-full relative transition-colors ${user.is_public ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${user.is_public ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </Accordion>

      {/* Seances personnelles */}
      <Accordion
        title="Seances personnelles"
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
          <p className="text-sm text-gray-400 text-center py-4">Aucune seance personnelle</p>
        ) : (
          <div className="space-y-2">
            {personalSessions.map(s => {
              const dur = getPersoSessionDuration(s);
              return (
                <div key={s.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PERSO_TYPE_COLOR[s.session_type] || 'bg-gray-100 text-gray-600'}`}>
                        {PERSO_TYPE_LABEL[s.session_type] || s.session_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(s.date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                      {dur && <span className="text-xs text-gray-500 font-medium">{dur}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingPersoSession(s); setShowAddPerso(false); }}
                    className="p-1.5 text-gray-300 hover:text-primary transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Accordion>

      {/* Palmares */}
      <Accordion
        title="Palmares"
        icon={<Trophy size={18} className="text-accent" />}
        defaultOpen={false}
        badge={userRaces.length > 0 ? <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">{userRaces.length}</span> : undefined}
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
          <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
            <input
              type="text"
              placeholder="Nom de la course"
              value={raceName}
              onChange={e => setRaceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={raceType}
                onChange={e => setRaceType(e.target.value as RaceType)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <textarea
              placeholder="Commentaire (optionnel)"
              value={raceComment}
              onChange={e => setRaceComment(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={raceLabel} onChange={e => setRaceLabel(e.target.checked)} className="rounded border-gray-300 text-accent focus:ring-accent/30" />
              <span className="text-sm text-gray-700">Course a label</span>
            </label>
            <div className="flex gap-2">
              <button onClick={resetRaceForm} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
              <button onClick={handleAddRace} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">{editingRaceId ? 'Modifier' : 'Ajouter'}</button>
            </div>
          </div>
        )}

        {/* Race list */}
        {userRaces.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune course enregistree</p>
        ) : (
          <div className="space-y-2">
            {userRaces.map(race => (
              <div key={race.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {race.race_name}
                    {race.is_label && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Label</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${raceTypeColor[race.race_type]}`}>
                      {raceTypeLabel[race.race_type]}
                    </span>
                    <span className="text-xs text-gray-400">{race.distance_km} km</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(race.date), 'dd/MM/yyyy', { locale: fr })}
                    </span>
                  </div>
                  {race.comment && (
                    <ExpandableText text={race.comment} maxLines={2} className="text-xs text-gray-500 italic mt-1" />
                  )}
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">{formatDuration(race.time_duration)}</span>
                <NordikButton raceId={race.id} />
                <button
                  onClick={() => startEditRace(race)}
                  className="p-1.5 text-gray-300 hover:text-accent transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => deleteRaceResult(race.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Accordion>

      {/* Strava */}
      <Accordion
        title="Strava"
        icon={<Activity size={18} className="text-[#FC4C02]" />}
        badge={strava.connected
          ? <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Connecte</span>
          : undefined
        }
      >
        {strava.connected ? (
          <div className="space-y-4">
            {/* Action buttons - square cards */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={async () => {
                  const count = await strava.syncActivities();
                  if (count > 0) alert(`${count} activite(s) synchronisee(s)`);
                  else alert('Aucune nouvelle activite');
                }}
                disabled={strava.loading}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-[#FC4C02]/5 border border-[#FC4C02]/20 rounded-xl hover:bg-[#FC4C02]/10 transition-colors disabled:opacity-50"
              >
                {strava.loading ? (
                  <Loader2 size={24} className="text-[#FC4C02] animate-spin" />
                ) : (
                  <RefreshCw size={24} className="text-[#FC4C02]" />
                )}
                <span className="text-xs font-medium text-gray-700">Synchroniser</span>
              </button>
              <button
                onClick={loadStravaActivities}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-[#FC4C02]/5 border border-[#FC4C02]/20 rounded-xl hover:bg-[#FC4C02]/10 transition-colors"
              >
                <Link2 size={24} className="text-[#FC4C02]" />
                <span className="text-xs font-medium text-gray-700">Mes seances</span>
              </button>
              <button
                onClick={() => setConfirmDisconnectStrava(true)}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <Unlink size={24} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Deconnecter</span>
              </button>
            </div>

            {/* Disconnect confirmation */}
            {confirmDisconnectStrava && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">Deconnecter Strava ?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmDisconnectStrava(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      await strava.disconnect();
                      setConfirmDisconnectStrava(false);
                    }}
                    className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            )}

            {/* Connection info */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Check size={12} className="text-green-500" />
              {strava.connectionStatus?.connected_at && (
                <span>Connecte depuis le {format(new Date(strava.connectionStatus.connected_at), 'd MMM yyyy', { locale: fr })}</span>
              )}
            </div>

            {/* Stats display */}
            {strava.athleteStats && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Statistiques annuelles</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{strava.athleteStats.ytd_run_totals?.count ?? 0}</p>
                    <p className="text-[10px] text-gray-400">Sorties</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {strava.athleteStats.ytd_run_totals?.distance ? (strava.athleteStats.ytd_run_totals.distance / 1000).toFixed(0) : 0}
                    </p>
                    <p className="text-[10px] text-gray-400">km</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {strava.athleteStats.ytd_run_totals?.moving_time ? Math.round(strava.athleteStats.ytd_run_totals.moving_time / 3600) : 0}
                    </p>
                    <p className="text-[10px] text-gray-400">heures</p>
                  </div>
                </div>
              </div>
            )}

            {/* All Strava activities */}
            {showStravaMatching && (
              <div className="space-y-3">
                {(() => {
                  const unmatched = allStravaActivities.filter(a => !a.matched_session_id);
                  const matched = allStravaActivities.filter(a => a.matched_session_id);
                  return (
                    <>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Seances a traiter
                        {unmatched.length > 0 && (
                          <span className="ml-2 text-[10px] bg-[#FC4C02]/10 text-[#FC4C02] px-1.5 py-0.5 rounded-full font-medium">{unmatched.length}</span>
                        )}
                      </p>
                      {unmatched.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-3">Toutes les activites sont associees</p>
                      ) : (
                        unmatched.map(act => {
                          const distKm = act.distance_meters ? (act.distance_meters / 1000).toFixed(1) : null;
                          const durationMin = act.moving_time_seconds ? Math.round(act.moving_time_seconds / 60) : null;
                          const matchingSessions = act.start_date_local ? getSessionsForDate(act.start_date_local) : [];
                          const isProcessing = creatingFromStrava === act.id || matchingActivityId === act.id;

                          return (
                            <div key={act.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-3">
                                <Activity size={14} className="text-[#FC4C02] shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{act.name || act.sport_type}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    {act.start_date_local && <span>{format(new Date(act.start_date_local), 'd MMM', { locale: fr })}</span>}
                                    {distKm && <span>{distKm} km</span>}
                                    {durationMin && <span>{durationMin} min</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Matching options */}
                              <div className="pl-7 space-y-1.5">
                                {matchingSessions.length > 0 && (
                                  <>
                                    <p className="text-[10px] text-gray-400 uppercase font-medium">Associer a une seance existante :</p>
                                    {matchingSessions.map(s => (
                                      <div key={s.id} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-100">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-gray-900 truncate">{s.title}</p>
                                          <p className="text-[10px] text-gray-400">{format(new Date(s.date), 'd MMM - HH:mm', { locale: fr })}</p>
                                        </div>
                                        <button
                                          onClick={() => handleMatchToSession(act, s.id)}
                                          disabled={isProcessing}
                                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white text-[10px] font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                          {matchingActivityId === act.id ? <Loader2 size={10} className="animate-spin" /> : <Link2 size={10} />}
                                          Associer
                                        </button>
                                      </div>
                                    ))}
                                  </>
                                )}
                                <button
                                  onClick={() => handleCreateSessionFromStrava(act)}
                                  disabled={isProcessing}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#FC4C02]/30 text-[#FC4C02] text-xs font-medium rounded-lg hover:bg-[#FC4C02]/5 transition-colors disabled:opacity-50"
                                >
                                  {creatingFromStrava === act.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                  Creer une seance personnelle
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Already matched activities */}
                      {matched.length > 0 && (
                        <>
                          <p className="text-xs font-bold text-gray-500 uppercase mt-4">
                            Deja associees
                            <span className="ml-2 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{matched.length}</span>
                          </p>
                          {matched.map(act => {
                            const distKm = act.distance_meters ? (act.distance_meters / 1000).toFixed(1) : null;
                            const durationMin = act.moving_time_seconds ? Math.round(act.moving_time_seconds / 60) : null;
                            return (
                              <div key={act.id} className="flex items-center gap-3 bg-green-50/50 rounded-lg p-3">
                                <Activity size={14} className="text-green-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{act.name || act.sport_type}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    {act.start_date_local && <span>{format(new Date(act.start_date_local), 'd MMM', { locale: fr })}</span>}
                                    {distKm && <span>{distKm} km</span>}
                                    {durationMin && <span>{durationMin} min</span>}
                                  </div>
                                </div>
                                <Check size={14} className="text-green-600 shrink-0" />
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {strava.error && (
              <p className="text-xs text-red-500">{strava.error}</p>
            )}
          </div>
        ) : stravaAuthUrl ? (
          <div className="text-center py-6">
            <Activity size={40} className="text-[#FC4C02]/30 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">Connecte ton compte Strava pour synchroniser tes activites et enrichir tes seances.</p>
            <a
              href={stravaAuthUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FC4C02] text-white text-sm font-medium rounded-xl hover:bg-[#e04400] transition-colors"
            >
              <ExternalLink size={16} />
              Connecter Strava
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Integration Strava non configuree</p>
        )}
      </Accordion>

      {/* Notifications */}
      <Accordion
        title="Notifications"
        icon={<Bell size={18} className="text-primary" />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Notifications push</p>
              <p className="text-xs text-gray-400">
                {permission === 'granted' ? 'Actives' : permission === 'denied' ? 'Bloquees par le navigateur' : 'Non activees'}
              </p>
            </div>
            {permission === 'granted' ? (
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${notificationsEnabled ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            ) : permission === 'denied' ? (
              <BellOff size={20} className="text-gray-400" />
            ) : (
              <button
                onClick={requestPermission}
                className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-light transition-colors"
              >
                Activer
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-sm font-medium text-gray-900 mb-3">Preferences par type</p>
            <div className="space-y-3">
              {([
                { key: 'new_session', label: 'Nouvelle seance', hasInApp: true, hasEmail: true },
                { key: 'palmares', label: 'Palmares', hasInApp: true, hasEmail: false },
                { key: 'vma_update', label: 'Mise a jour VMA', hasInApp: true, hasEmail: true },
                { key: 'weekly_digest', label: 'Digest hebdo', hasInApp: false, hasEmail: true },
              ] as const).map(({ key, label, hasInApp, hasEmail }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <div className="flex items-center gap-3">
                    {hasInApp && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-xs text-gray-400">In-app</span>
                        <button
                          onClick={async () => {
                            if (!user) return;
                            const prefs = { ...user.notification_preferences };
                            const current = prefs[key] as { in_app: boolean; email: boolean };
                            (prefs as Record<string, unknown>)[key] = { ...current, in_app: !current.in_app };
                            await updateNotificationPreferences(user.id, prefs as NotificationPreferences);
                            refreshUser();
                          }}
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            (user?.notification_preferences[key] as { in_app?: boolean })?.in_app ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${
                            (user?.notification_preferences[key] as { in_app?: boolean })?.in_app ? 'left-4.5' : 'left-0.5'
                          }`} />
                        </button>
                      </label>
                    )}
                    {hasEmail && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-xs text-gray-400">Email</span>
                        <button
                          onClick={async () => {
                            if (!user) return;
                            const prefs = { ...user.notification_preferences };
                            const current = prefs[key] as { email: boolean };
                            (prefs as Record<string, unknown>)[key] = { ...current, email: !current.email };
                            await updateNotificationPreferences(user.id, prefs as NotificationPreferences);
                            refreshUser();
                          }}
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            (user?.notification_preferences[key] as { email?: boolean })?.email ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${
                            (user?.notification_preferences[key] as { email?: boolean })?.email ? 'left-4.5' : 'left-0.5'
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
      </Accordion>

      {/* Securite */}
      <Accordion
        title="Sécurité"
        icon={<Lock size={18} className="text-primary" />}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Modifier votre mot de passe</p>
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
          {passwordSuccess && <p className="text-green-600 text-sm">Mot de passe modifié avec succès</p>}
          <button
            onClick={handleChangePassword}
            disabled={!newPassword || !confirmPassword || passwordLoading}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {passwordLoading && <Loader2 size={16} className="animate-spin" />}
            Modifier
          </button>
        </div>
      </Accordion>

      {/* Donnees personnelles */}
      <Accordion
        title="Données personnelles"
        icon={<Shield size={18} className="text-primary" />}
      >
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
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
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
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <UserX size={16} />
            <span>Supprimer mon compte et mes donnees</span>
          </button>
          <p className="text-xs text-gray-400">
            Conforme RGPD. Vos donnees sont stockees de maniere securisee.
          </p>
        </div>
      </Accordion>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Supprimer mon compte</h3>
                  <p className="text-xs text-gray-500">Action irreversible</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Cette action supprimera definitivement votre compte, vos resultats de courses, vos validations de seances et toutes vos donnees personnelles. Aucune recuperation ne sera possible.
                </p>
              </div>

              {isSoleCoach && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-medium">
                    Vous etes le seul coach du club. Veuillez d'abord nommer un autre coach avant de supprimer votre compte.
                  </p>
                </div>
              )}

              {!isSoleCoach && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
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
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 block mb-1">
                      Commentaire (optionnel)
                    </label>
                    <textarea
                      value={exitComment}
                      onChange={e => setExitComment(e.target.value)}
                      placeholder="Un retour pour nous aider a nous ameliorer..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-700 block mb-1">
                      Tapez <span className="font-bold text-red-600">SUPPRIMER</span> pour confirmer
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder="SUPPRIMER"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                {!isSoleCoach && (
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'SUPPRIMER' || !exitReason || deleteLoading}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
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
