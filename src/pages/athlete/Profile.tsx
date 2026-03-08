import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Trophy, Bell, BellOff, Shield, Download, UserX, Camera, X, Lock, Loader2, Phone, ExternalLink, Pencil, Check, IdCard, Cake, AlertTriangle, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NordikButton from '../../components/NordikButton';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDuration } from '../../lib/calculations';
import { getFFACategory } from '../../lib/ffa';
import Avatar from '../../components/Avatar';
import { supabase } from '../../lib/supabase';
import type { RaceType, NotificationPreferences } from '../../types';

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
  const { raceResults, addRaceResult, deleteRaceResult, groups, users, validations, updateUserPublic, updateUserPhone, updateUserStrava, updateUserLicense, updateUserBirthDate, updateUserPhoto, updateUserGroup, updateUserVma, updateNotificationPreferences } = useData();
  const { permission, requestPermission, notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const [showAddRace, setShowAddRace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [raceName, setRaceName] = useState('');
  const [raceType, setRaceType] = useState<RaceType>('route');
  const [raceDistance, setRaceDistance] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [raceTime, setRaceTime] = useState('');

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [editingStrava, setEditingStrava] = useState(false);
  const [stravaValue, setStravaValue] = useState('');
  const [editingLicense, setEditingLicense] = useState(false);
  const [licenseValue, setLicenseValue] = useState('');
  const [editingBirthDate, setEditingBirthDate] = useState(false);
  const [birthDateValue, setBirthDateValue] = useState('');
  const [editingVma, setEditingVma] = useState(false);
  const [vmaValue, setVmaValue] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  const group = groups.find(g => g.id === user.group_id);

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

  const handleAddRace = () => {
    if (!raceName || !raceDistance || !raceDate || !raceTime) return;
    addRaceResult({
      user_id: user.id,
      race_name: raceName,
      race_type: raceType,
      distance_km: parseFloat(raceDistance),
      date: raceDate,
      time_duration: raceTime,
    });
    setShowAddRace(false);
    setRaceName(''); setRaceDistance(''); setRaceDate(''); setRaceTime('');
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
            <p className="text-sm text-gray-400">{group?.name || 'Aucun groupe'}</p>
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
                <div className="flex items-center gap-1 mt-0.5">
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
                        await updateUserVma(user.id, v);
                        await refreshUser();
                        setEditingVma(false);
                      }
                    }}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingVma(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <p className="font-medium text-gray-900">{user.vma ? `${user.vma} km/h` : 'Non renseignee'}</p>
              )}
            </div>
            {user.role === 'coach' && !editingVma ? (
              <button
                onClick={() => { setVmaValue(user.vma?.toString() || ''); setEditingVma(true); }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Modifier
              </button>
            ) : user.role !== 'coach' ? (
              <span className="text-xs text-gray-400 italic">Modifiable par le coach</span>
            ) : null}
          </div>

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
                      placeholder="+33612345678"
                      value={phoneValue}
                      onChange={e => setPhoneValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = phoneValue.trim() || null;
                          updateUserPhone(user.id, v).then(() => refreshUser());
                          setEditingPhone(false);
                        }
                      }}
                      className="w-36 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const v = phoneValue.trim() || null;
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
                  <p className="font-medium text-gray-900 text-sm">{user.phone || 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingPhone && (
              <button
                onClick={() => { setPhoneValue(user.phone || ''); setEditingPhone(true); setEditingStrava(false); setEditingLicense(false); setEditingBirthDate(false); }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* Strava */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink size={16} className="text-orange-500" />
              <div>
                <p className="text-xs text-gray-400">Profil Strava (lien URL)</p>
                {editingStrava ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="url"
                      placeholder="https://www.strava.com/athletes/..."
                      value={stravaValue}
                      onChange={e => setStravaValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = stravaValue.trim() || null;
                          updateUserStrava(user.id, v).then(() => refreshUser());
                          setEditingStrava(false);
                        }
                      }}
                      className="w-52 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const v = stravaValue.trim() || null;
                        updateUserStrava(user.id, v).then(() => refreshUser());
                        setEditingStrava(false);
                      }}
                      className="p-1 text-orange-500 hover:bg-orange-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingStrava(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900 text-sm">{user.strava_id || 'Non renseigne'}</p>
                )}
              </div>
            </div>
            {!editingStrava && (
              <button
                onClick={() => { setStravaValue(user.strava_id || ''); setEditingStrava(true); setEditingPhone(false); setEditingLicense(false); setEditingBirthDate(false); }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
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
                onClick={() => { setLicenseValue(user.license_number || ''); setEditingLicense(true); setEditingPhone(false); setEditingStrava(false); setEditingBirthDate(false); }}
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
                onClick={() => { setBirthDateValue(user.birth_date || ''); setEditingBirthDate(true); setEditingPhone(false); setEditingStrava(false); setEditingLicense(false); }}
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
              <p className="text-xs text-gray-400">VMA, telephone et Strava visibles dans l'annuaire</p>
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
            <div className="flex gap-2">
              <button onClick={() => setShowAddRace(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
              <button onClick={handleAddRace} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">Ajouter</button>
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
                  <p className="font-medium text-gray-900 text-sm truncate">{race.race_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${raceTypeColor[race.race_type]}`}>
                      {raceTypeLabel[race.race_type]}
                    </span>
                    <span className="text-xs text-gray-400">{race.distance_km} km</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(race.date), 'dd/MM/yyyy', { locale: fr })}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">{formatDuration(race.time_duration)}</span>
                <NordikButton raceId={race.id} />
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
                { key: 'palmares', label: 'Palmares', hasInApp: true, hasEmail: true },
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
        title="Securite"
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
          {passwordSuccess && <p className="text-green-600 text-sm">Mot de passe modifie avec succes</p>}
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
        title="Donnees personnelles"
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
            <span>Exporter mes donnees (JSON)</span>
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
