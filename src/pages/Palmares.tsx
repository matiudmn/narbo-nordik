import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Trophy, Medal } from 'lucide-react';
import NordikButton from '../components/NordikButton';
import { useData } from '../contexts/DataContext';
import { SUPER_ADMIN_EMAIL } from '../lib/constants';

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

export default function Palmares() {
  const navigate = useNavigate();
  const { raceResults, users } = useData();

  const palmares = useMemo(() => {
    return raceResults
      .map(r => {
        const user = users.find(u => u.id === r.user_id);
        return { ...r, user };
      })
      .filter(r => r.user && r.user.email !== SUPER_ADMIN_EMAIL)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceResults, users]);

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <h1 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2 mb-4">
        <Trophy size={22} className="text-amber-500" />
        Palmares Collectif
      </h1>

      {palmares.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun resultat enregistre</p>
      ) : (
        <div className="space-y-2">
          {palmares.map((race, idx) => (
            <div
              key={race.id}
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
                <p className="text-sm font-semibold text-gray-900 truncate">{race.race_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {race.user?.firstname} {race.user?.lastname.charAt(0)}.
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(race.date), 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
