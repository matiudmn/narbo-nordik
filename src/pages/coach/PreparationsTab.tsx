import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Check, X, UserMinus, Calendar, Target } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';

export default function PreparationsTab() {
  const { users, preparations, userPreparations, addPreparation, deletePreparation, addUserToPreparation, removeUserFromPreparation } = useData();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allMembers = useMemo(() => users.filter(u => u.role === 'athlete' || u.role === 'coach'), [users]);

  const getPrepMembers = (prepId: string) => {
    const memberIds = userPreparations.filter(up => up.preparation_id === prepId).map(up => up.user_id);
    return allMembers.filter(m => memberIds.includes(m.id));
  };

  const getUnassigned = (prepId: string) => {
    const memberIds = userPreparations.filter(up => up.preparation_id === prepId).map(up => up.user_id);
    return allMembers.filter(m => !memberIds.includes(m.id));
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newDate) return;
    await addPreparation(newName.trim(), newDate, newDesc.trim() || null);
    setNewName(''); setNewDate(''); setNewDesc(''); setShowAdd(false);
  };

  const handleDelete = async (id: string) => {
    await deletePreparation(id);
    setConfirmDeleteId(null);
  };

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Plus size={16} /> Nouvelle préparation
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <input
            type="text" placeholder="Nom de la préparation" value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <textarea
            placeholder="Description (optionnel)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Annuler</button>
            <button onClick={handleAdd} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">Creer</button>
          </div>
        </div>
      )}

      {/* Preparations list */}
      {preparations.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Target size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune preparation specifique</p>
        </div>
      ) : (
        <div className="space-y-4">
          {preparations.map(prep => {
            const members = getPrepMembers(prep.id);
            const unassigned = getUnassigned(prep.id);
            const days = daysUntil(prep.event_date);

            return (
              <div key={prep.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{prep.name}</h3>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Specifique</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(prep.event_date), 'd MMMM yyyy', { locale: fr })}
                      {days >= 0 && <span className="ml-1 text-primary font-medium">· J-{days}</span>}
                      {days < 0 && days >= -3 && <span className="ml-1 text-red-500 font-medium">· Termine</span>}
                    </p>
                    {prep.description && <p className="text-xs text-gray-400 mt-1">{prep.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {confirmDeleteId === prep.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(prep.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(prep.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">{members.length} inscrit(s)</p>
                  {members.length > 0 && (
                    <div className="space-y-1.5">
                      {members.map(member => (
                        <div key={member.id} className="flex items-center gap-3 px-3 py-2 bg-amber-50/50 rounded-lg">
                          <Avatar user={member} size="sm" />
                          <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                            {member.firstname} {member.lastname}
                          </span>
                          <button
                            onClick={() => removeUserFromPreparation(member.id, prep.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            title="Retirer"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add member */}
                {unassigned.length > 0 && (
                  <select
                    onChange={e => { if (e.target.value) addUserToPreparation(e.target.value, prep.id); e.target.value = ''; }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="">+ Inscrire un membre...</option>
                    {unassigned.map(a => (
                      <option key={a.id} value={a.id}>{a.firstname} {a.lastname}{a.role === 'coach' ? ' (Coach)' : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
