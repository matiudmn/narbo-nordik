import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

export default function VmaHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { users } = useData();

  const targetUserId = searchParams.get('user');
  const targetUser = targetUserId ? users.find(u => u.id === targetUserId) : user;

  if (!targetUser) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Utilisateur introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const history = [...targetUser.vma_history].reverse();
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <h1 className="text-lg font-bold text-gray-900 mb-1">
        Historique VMA
      </h1>
      {!isOwnProfile && (
        <p className="text-sm text-gray-500 mb-4">{targetUser.firstname} {targetUser.lastname}</p>
      )}

      {targetUser.vma && (
        <div className="bg-primary/5 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-400 mb-1">VMA actuelle</p>
          <p className="text-3xl font-bold text-primary">{targetUser.vma} <span className="text-base font-normal">km/h</span></p>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Aucun historique</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry, idx) => {
            const prevEntry = idx < history.length - 1 ? history[idx + 1] : null;
            const diff = prevEntry ? entry.vma - prevEntry.vma : null;
            return (
              <div key={`${entry.date}-${entry.vma}`} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-primary">{entry.vma}</span>
                    <span className="text-sm text-gray-400">km/h</span>
                    {diff !== null && diff !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {format(new Date(entry.date), 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-sm text-gray-600 mt-2 italic">{entry.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
