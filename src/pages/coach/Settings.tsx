import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, X, Users, UserMinus, UsersRound, Search, Share2, Copy, Loader2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';
import type { Role } from '../../types';

type Tab = 'groups' | 'athletes';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('groups');

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Parametres</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <UsersRound size={16} />
          Groupes
        </button>
        <button
          onClick={() => setTab('athletes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'athletes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Users size={16} />
          Athletes
        </button>
      </div>

      {tab === 'groups' ? <GroupsTab /> : <AthletesTab />}
    </div>
  );
}

/* ─── Groups Tab ─── */
function GroupsTab() {
  const { groups, users, sessions, addGroup, updateGroup, deleteGroup, updateUserGroup } = useData();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const athletes = users.filter(u => u.role === 'athlete');

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

  const getGroupAthletes = (groupId: string) => athletes.filter(a => a.group_id === groupId);
  const getGroupSessionCount = (groupId: string) => sessions.filter(s => s.group_id === groupId).length;
  const unassigned = athletes.filter(a => !a.group_id);

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
        const groupAthletes = getGroupAthletes(group.id);
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
                      {groupAthletes.length} athlete{groupAthletes.length !== 1 ? 's' : ''} · {sessionCount} seance{sessionCount !== 1 ? 's' : ''}
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
                  {groupAthletes.length > 0 && ` Les ${groupAthletes.length} athlete(s) seront sans groupe.`}
                  {sessionCount > 0 && ` Les ${sessionCount} seance(s) deviendront "Tous groupes".`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600">Annuler</button>
                  <button onClick={() => handleDelete(group.id)} className="flex-1 py-1.5 text-sm bg-red-500 text-white rounded-lg font-medium">Supprimer</button>
                </div>
              </div>
            )}

            {groupAthletes.length > 0 ? (
              <div className="space-y-1.5">
                {groupAthletes.map(athlete => (
                  <div key={athlete.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <Avatar user={athlete} size="sm" />
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                      {athlete.firstname} {athlete.lastname}
                    </span>
                    <button
                      onClick={() => updateUserGroup(athlete.id, null)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title="Retirer du groupe"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">Aucun athlete dans ce groupe</p>
            )}

            {unassigned.length > 0 && (
              <div className="mt-2">
                <select
                  value=""
                  onChange={e => { if (e.target.value) updateUserGroup(e.target.value, group.id); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">+ Ajouter un athlete...</option>
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

/* ─── Athletes Tab ─── */
function AthletesTab() {
  const { users, groups, validations, sessions, updateUserVma, addUser, deleteUser } = useData();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingVma, setEditingVma] = useState<string | null>(null);
  const [vmaValue, setVmaValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [addError, setAddError] = useState('');

  const [newFirstname, setNewFirstname] = useState('');
  const [newLastname, setNewLastname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newVma, setNewVma] = useState('');

  const athletes = useMemo(() => {
    return users
      .filter(u => u.role === 'athlete')
      .filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q);
      });
  }, [users, search]);

  const getAttendanceRate = (userId: string) => {
    const totalSessions = sessions.length;
    if (totalSessions === 0) return 0;
    const done = validations.filter(v => v.user_id === userId && v.status === 'done').length;
    return Math.round((done / totalSessions) * 100);
  };

  const handleVmaEdit = (userId: string) => {
    if (vmaValue && !isNaN(parseFloat(vmaValue))) {
      updateUserVma(userId, parseFloat(vmaValue));
    }
    setEditingVma(null);
    setVmaValue('');
  };

  const getShareMessage = (name: string, email: string, tempPassword: string) =>
    `Salut ${name} ! Bienvenue sur Narbo Nordik. Ton compte a ete cree.\nEmail : ${email}\nMot de passe : ${tempPassword}\n${window.location.origin}`;

  const handleAddAthlete = async () => {
    if (!newFirstname || !newLastname || !newEmail) return;
    setAddingAthlete(true);
    setAddError('');
    const name = `${newFirstname} ${newLastname}`;
    const email = newEmail;
    const result = await addUser({
      firstname: newFirstname,
      lastname: newLastname,
      email,
      role: 'athlete' as Role,
      vma: newVma ? parseFloat(newVma) : null,
      group_id: newGroup || null,
      phone: null,
      strava_id: null,
      is_public: false,
    });
    setAddingAthlete(false);
    if (!result) {
      setAddError('Erreur lors de la creation du compte. Verifiez que l\'email n\'est pas deja utilise.');
      return;
    }
    setShowAdd(false);
    setNewFirstname(''); setNewLastname(''); setNewEmail(''); setNewGroup(''); setNewVma('');
    setShareInfo({ name, email, tempPassword: result.tempPassword });
    setCopied(false);
  };

  const handleShare = async () => {
    if (!shareInfo) return;
    const text = getShareMessage(shareInfo.name, shareInfo.email, shareInfo.tempPassword);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Narbo Nordik - Invitation', text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopy = async () => {
    if (!shareInfo) return;
    await navigator.clipboard.writeText(getShareMessage(shareInfo.name, shareInfo.email, shareInfo.tempPassword));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 bg-accent text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Fermer' : 'Ajouter'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <h2 className="font-bold text-gray-900 text-sm">Nouvel athlete</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" placeholder="Prenom" value={newFirstname}
              onChange={e => setNewFirstname(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="text" placeholder="Nom" value={newLastname}
              onChange={e => setNewLastname(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <input
            type="email" placeholder="Email" value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newGroup} onChange={e => setNewGroup(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Groupe...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input
              type="number" step="0.5" placeholder="VMA (km/h)" value={newVma}
              onChange={e => setNewVma(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {addError && <p className="text-red-500 text-sm">{addError}</p>}
          <button
            onClick={handleAddAthlete}
            disabled={!newFirstname || !newLastname || !newEmail || addingAthlete}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {addingAthlete && <Loader2 size={16} className="animate-spin" />}
            {addingAthlete ? 'Creation en cours...' : 'Ajouter l\'athlete'}
          </button>
        </div>
      )}

      {/* Share panel */}
      {shareInfo && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-green-800">
              {shareInfo.name} ajoute !
            </p>
            <button onClick={() => setShareInfo(null)} className="p-1 text-green-600 hover:bg-green-100 rounded">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-green-700 bg-white rounded-lg p-3 whitespace-pre-line">
            {getShareMessage(shareInfo.name, shareInfo.email, shareInfo.tempPassword)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-white rounded-lg text-sm font-medium"
            >
              <Share2 size={16} />
              Partager
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <Copy size={16} />
              {copied ? 'Copie !' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Athletes list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Athlete</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Groupe</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">VMA</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Assiduite</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {athletes.map(athlete => {
                const group = groups.find(g => g.id === athlete.group_id);
                const rate = getAttendanceRate(athlete.id);
                return (
                  <tr key={athlete.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar user={athlete} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900">{athlete.firstname} {athlete.lastname}</p>
                          <p className="text-xs text-gray-400">{athlete.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{group?.name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {editingVma === athlete.id ? (
                        <input
                          type="number" step="0.5"
                          value={vmaValue}
                          onChange={e => setVmaValue(e.target.value)}
                          onBlur={() => handleVmaEdit(athlete.id)}
                          onKeyDown={e => e.key === 'Enter' && handleVmaEdit(athlete.id)}
                          className="w-16 px-2 py-1 border border-primary rounded text-center text-sm focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingVma(athlete.id); setVmaValue(String(athlete.vma || '')); }}
                          className="font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                        >
                          {athlete.vma || '-'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400'}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {confirmDeleteId === athlete.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(athlete.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(athlete.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
