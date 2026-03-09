import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, UserMinus, UsersRound } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';

export default function GroupsTab() {
  const { groups, users, sessions, addGroup, updateGroup, deleteGroup, updateUserGroup } = useData();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allMembers = users;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addGroup(name);
    setNewName('');
  };

  const handleEdit = (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    updateGroup(id, name);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteGroup(id);
    setConfirmDeleteId(null);
  };

  const getGroupMembers = (groupId: string) => allMembers.filter(a => a.group_id === groupId);
  const getGroupSessionCount = (groupId: string) => sessions.filter(s => s.group_id === groupId).length;
  const unassigned = allMembers.filter(a => !a.group_id);

  return (
    <div className="space-y-3">
      {/* Add group */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nom du nouveau groupe"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      </div>

      {/* Groups list */}
      {groups.map(group => {
        const groupMembers = getGroupMembers(group.id);
        const sessionCount = getGroupSessionCount(group.id);
        const isEditing = editingId === group.id;
        const isConfirmingDelete = confirmDeleteId === group.id;

        return (
          <div key={group.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <UsersRound size={20} className="text-primary" />
              </div>
              {isEditing ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit(group.id)}
                    autoFocus
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button onClick={() => handleEdit(group.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-400">
                      {groupMembers.length} membre{groupMembers.length !== 1 ? 's' : ''} · {sessionCount} seance{sessionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditingId(group.id); setEditingName(group.name); }}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(group.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>

            {isConfirmingDelete && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-red-700 mb-2">
                  Supprimer le groupe "{group.name}" ?
                  {groupMembers.length > 0 && ` Les ${groupMembers.length} membre(s) seront sans groupe.`}
                  {sessionCount > 0 && ` Les ${sessionCount} seance(s) deviendront "Tous groupes".`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600">Annuler</button>
                  <button onClick={() => handleDelete(group.id)} className="flex-1 py-1.5 text-sm bg-red-500 text-white rounded-lg font-medium">Supprimer</button>
                </div>
              </div>
            )}

            {groupMembers.length > 0 ? (
              <div className="space-y-1.5">
                {groupMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <Avatar user={member} size="sm" />
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                      {member.firstname} {member.lastname}
                      {member.role === 'coach' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          Coach
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => updateUserGroup(member.id, null)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title="Retirer du groupe"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">Aucun membre dans ce groupe</p>
            )}

            {unassigned.length > 0 && (
              <div className="mt-2">
                <select
                  value=""
                  onChange={e => { if (e.target.value) updateUserGroup(e.target.value, group.id); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">+ Ajouter un membre...</option>
                  {unassigned.map(a => (
                    <option key={a.id} value={a.id}>{a.firstname} {a.lastname}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
            <UserMinus size={18} className="text-gray-400" />
            Sans groupe ({unassigned.length})
          </h2>
          <div className="space-y-1.5">
            {unassigned.map(athlete => (
              <div key={athlete.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                <Avatar user={athlete} size="sm" />
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {athlete.firstname} {athlete.lastname}
                </span>
                <select
                  value=""
                  onChange={e => { if (e.target.value) updateUserGroup(athlete.id, e.target.value); }}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 focus:outline-none"
                >
                  <option value="">Assigner...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
