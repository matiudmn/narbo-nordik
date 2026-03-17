import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Trophy, Medal, Pencil, Plus, X, Star, Trash2 } from 'lucide-react';
import NordikButton from '../components/NordikButton';
import ExpandableText from '../components/ExpandableText';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SUPER_ADMIN_EMAIL } from '../lib/constants';
import type { RaceType } from '../types';

function formatDuration(duration: string): string {
  const parts = duration.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const raceTypeLabels: Record<string, string> = {
  route: 'Route',
  trail: 'Trail',
  piste: 'Piste',
};

const raceTypeColors: Record<string, string> = {
  route: 'bg-blue-100 text-blue-700',
  trail: 'bg-emerald-100 text-emerald-700',
  piste: 'bg-violet-100 text-violet-700',
};

function RaceForm({ users: usersList, onSubmit, onCancel, initial, showUserSelect }: {
  users: { id: string; firstname: string; lastname: string }[];
  onSubmit: (data: { user_id: string; race_name: string; race_type: RaceType; distance_km: number; date: string; time_duration: string; is_label: boolean; comment: string | null }) => void;
  onCancel: () => void;
  initial?: { user_id?: string; race_name: string; race_type: RaceType; distance_km: number; date: string; time_duration: string; is_label: boolean; comment?: string | null };
  showUserSelect?: boolean;
}) {
  const [userId, setUserId] = useState(initial?.user_id || '');
  const [name, setName] = useState(initial?.race_name || '');
  const [type, setType] = useState<RaceType>(initial?.race_type || 'route');
  const [distance, setDistance] = useState(initial?.distance_km ? String(initial.distance_km) : '');
  const [date, setDate] = useState(initial?.date || '');
  const [time, setTime] = useState(initial?.time_duration || '');
  const [label, setLabel] = useState(initial?.is_label || false);
  const [comment, setComment] = useState(initial?.comment || '');

  const handleSubmit = () => {
    if (!name || !distance || !date || !time) return;
    if (showUserSelect && !userId) return;
    onSubmit({
      user_id: userId,
      race_name: name,
      race_type: type,
      distance_km: parseFloat(distance),
      date,
      time_duration: time,
      is_label: label,
      comment: comment.trim() || null,
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      {showUserSelect && (
        <select
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Sélectionner un athlète</option>
          {usersList.map(u => (
            <option key={u.id} value={u.id}>{u.firstname} {u.lastname}</option>
          ))}
        </select>
      )}
      <input
        type="text"
        placeholder="Nom de la course"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={type}
          onChange={e => setType(e.target.value as RaceType)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="route">Route</option>
          <option value="trail">Trail</option>
          <option value="piste">Piste</option>
        </select>
        <input
          type="number"
          step="0.1"
          placeholder="Distance (km)"
          value={distance}
          onChange={e => setDistance(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          placeholder="h:mm:ss"
          value={time}
          onChange={e => setTime(e.target.value)}
          onBlur={() => {
            const parts = time.split(':').map(s => s.trim());
            if (parts.length === 3) {
              setTime(parts.map(p => p.padStart(2, '0')).join(':'));
            } else if (parts.length === 2) {
              setTime(`00:${parts.map(p => p.padStart(2, '0')).join(':')}`);
            }
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <textarea
        placeholder="Commentaire (optionnel)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={label} onChange={e => setLabel(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary/30" />
        <span className="text-sm text-gray-700">Course a label</span>
      </label>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
        <button onClick={handleSubmit} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          {initial ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

export default function Palmares() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { raceResults, users, addRaceResult, updateRaceResult, deleteRaceResult } = useData();
  const isCoach = user?.role === 'coach';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCoachAdd, setShowCoachAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedUsers = useMemo(() =>
    [...users].filter(u => u.email !== SUPER_ADMIN_EMAIL).sort((a, b) => a.firstname.localeCompare(b.firstname)),
    [users]
  );

  const palmares = useMemo(() => {
    return raceResults
      .map(r => {
        const u = users.find(u => u.id === r.user_id);
        return { ...r, user: u };
      })
      .filter(r => r.user && r.user.email !== SUPER_ADMIN_EMAIL)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceResults, users]);

  const canEdit = (raceUserId: string) => raceUserId === user?.id || isCoach;

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          <Trophy size={22} className="text-amber-500" />
          Palmares Collectif
        </h1>
        {isCoach && (
          <button
            onClick={() => { setShowCoachAdd(!showCoachAdd); setEditingId(null); }}
            className="flex items-center gap-1 text-sm text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            {showCoachAdd ? <X size={14} /> : <Plus size={14} />}
            {showCoachAdd ? 'Fermer' : 'Ajouter'}
          </button>
        )}
      </div>

      {showCoachAdd && (
        <div className="mb-4">
          <RaceForm
            users={sortedUsers}
            showUserSelect
            onCancel={() => setShowCoachAdd(false)}
            onSubmit={data => {
              addRaceResult({
                user_id: data.user_id,
                race_name: data.race_name,
                race_type: data.race_type,
                distance_km: data.distance_km,
                date: data.date,
                time_duration: data.time_duration,
                is_label: data.is_label,
                comment: data.comment,
              });
              setShowCoachAdd(false);
            }}
          />
        </div>
      )}

      {palmares.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun resultat enregistre</p>
      ) : (
        <div className="space-y-2">
          {palmares.map((race, idx) => (
            <div key={race.id}>
              {editingId === race.id ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                  <RaceForm
                    users={sortedUsers}
                    initial={{
                      user_id: race.user_id,
                      race_name: race.race_name,
                      race_type: race.race_type,
                      distance_km: race.distance_km,
                      date: race.date,
                      time_duration: race.time_duration,
                      is_label: race.is_label,
                      comment: race.comment,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={data => {
                      updateRaceResult(race.id, {
                        race_name: data.race_name,
                        race_type: data.race_type,
                        distance_km: data.distance_km,
                        date: data.date,
                        time_duration: data.time_duration,
                        is_label: data.is_label,
                        comment: data.comment,
                      });
                      setEditingId(null);
                    }}
                  />
                </div>
              ) : (
                <>
                  <div
                    className={`bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 ${
                      idx === 0 ? 'ring-2 ring-amber-200' : ''
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {idx < 3 ? (
                        <Medal size={20} className={
                          idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700'
                        } />
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 font-bold">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {race.race_name}
                        {race.is_label && (
                          <Star size={12} className="inline ml-1 text-amber-500 fill-amber-500" />
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {race.user?.firstname} {race.user?.lastname.charAt(0)}.
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(race.date), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      {race.comment && (
                        <ExpandableText text={race.comment} maxLines={2} className="text-xs text-gray-500 italic mt-1" />
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">{formatDuration(race.time_duration)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-xs text-gray-400">{race.distance_km}km</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${raceTypeColors[race.race_type] || 'bg-gray-100 text-gray-600'}`}>
                          {raceTypeLabels[race.race_type] || race.race_type}
                        </span>
                      </div>
                    </div>
                    <NordikButton raceId={race.id} />
                    {canEdit(race.user_id) && (
                      <>
                        <button
                          onClick={() => { setEditingId(race.id); setShowCoachAdd(false); setConfirmDeleteId(null); }}
                          className="p-1.5 text-gray-300 hover:text-primary transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(race.id); setEditingId(null); }}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {confirmDeleteId === race.id && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-red-700 mb-2">Supprimer ce résultat de "{race.race_name}" ?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600">Annuler</button>
                        <button onClick={() => { deleteRaceResult(race.id); setConfirmDeleteId(null); }} className="flex-1 py-1.5 text-sm bg-red-500 text-white rounded-lg font-medium">Supprimer</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
