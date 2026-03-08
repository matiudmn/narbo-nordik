import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Trophy, Bell, BellOff, Shield, Download, UserX, Camera, X, Lock, Loader2, Phone, ExternalLink, Pencil, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NordikButton from '../../components/NordikButton';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDuration } from '../../lib/calculations';
import Avatar from '../../components/Avatar';
import { supabase } from '../../lib/supabase';
import type { RaceType } from '../../types';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { raceResults, addRaceResult, deleteRaceResult, groups, validations, updateUserPublic, updateUserPhone, updateUserStrava, updateUserPhoto } = useData();
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

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Mon Profil</h1>

      {/* User info */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-4 mb-4">
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
          <div>
            <p className="font-bold text-gray-900 text-lg">{user.firstname} {user.lastname}</p>
            <p className="text-sm text-gray-400">{group?.name || 'Aucun groupe'}</p>
          </div>
        </div>
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
            <p className="font-medium text-gray-900">{group?.name || '-'}</p>
          </div>
        </div>

        {/* Phone */}
        <div className="mt-4 flex items-center justify-between">
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
              onClick={() => { setPhoneValue(user.phone || ''); setEditingPhone(true); setEditingStrava(false); }}
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
              <p className="text-xs text-gray-400">Profil Strava (ID ou username)</p>
              {editingStrava ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    placeholder="12345678"
                    value={stravaValue}
                    onChange={e => setStravaValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = stravaValue.trim() || null;
                        updateUserStrava(user.id, v).then(() => refreshUser());
                        setEditingStrava(false);
                      }
                    }}
                    className="w-36 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              onClick={() => { setStravaValue(user.strava_id || ''); setEditingStrava(true); setEditingPhone(false); }}
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

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <Bell size={18} className="text-primary" />
          Notifications
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Rappels de seances</p>
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
      </div>

      {/* Password change */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <Lock size={18} className="text-primary" />
          Changer le mot de passe
        </h2>
        <div className="space-y-3">
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
      </div>

      {/* RGPD */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <Shield size={18} className="text-primary" />
          Donnees personnelles
        </h2>
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
            onClick={async () => {
              if (confirm('Supprimer toutes vos donnees et votre compte ? Cette action est irreversible.')) {
                await supabase.from('users').delete().eq('id', user.id);
                await supabase.auth.signOut();
                localStorage.removeItem('narbo_rgpd_consent');
                localStorage.removeItem('narbo_notif_enabled');
                window.location.href = '/';
              }
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
      </div>

      {/* Palmares */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Trophy size={18} className="text-accent" />
            Palmares
          </h2>
          <button
            onClick={() => setShowAddRace(!showAddRace)}
            className="flex items-center gap-1 text-sm text-accent font-medium hover:text-accent-light"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>

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
                placeholder="Temps (hh:mm:ss)"
                value={raceTime}
                onChange={e => setRaceTime(e.target.value)}
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
      </div>
    </div>
  );
}
