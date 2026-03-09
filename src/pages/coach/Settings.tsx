import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Check, X, Users, UserMinus, UsersRound, Search, Share2, Copy, Loader2, Eye, UserPlus, Calendar, Target } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/Avatar';
import type { Role } from '../../types';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';

type Tab = 'groups' | 'preparations' | 'athletes';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('groups');

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Parametres</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <UsersRound size={14} />
          Groupes
        </button>
        <button
          onClick={() => setTab('preparations')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'preparations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Target size={14} />
          Prep. Specifiques
        </button>
        <button
          onClick={() => setTab('athletes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'athletes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Users size={14} />
          Athletes
        </button>
      </div>

      {tab === 'groups' && <GroupsTab />}
      {tab === 'preparations' && <PreparationsTab />}
      {tab === 'athletes' && <AthletesTab />}
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

/* ─── Preparations Tab ─── */
function PreparationsTab() {
  const { users, preparations, userPreparations, addPreparation, deletePreparation, addUserToPreparation, removeUserFromPreparation } = useData();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allMembers = useMemo(() => users.filter(u => u.role === 'athlete'), [users]);

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
          <Plus size={16} /> Nouvelle preparation
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <input
            type="text" placeholder="Nom de la preparation" value={newName}
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
                    <option value="">+ Inscrire un athlete...</option>
                    {unassigned.map(a => (
                      <option key={a.id} value={a.id}>{a.firstname} {a.lastname}</option>
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

/* ─── Athletes Tab ─── */
function AthletesTab() {
  const { users, groups, validations, sessions, preparations, userPreparations, updateUserVma, updateUserLicense, updateUserGroup, addUser, deleteUser } = useData();
  const { isSuperAdmin, impersonate } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingVma, setEditingVma] = useState<string | null>(null);
  const [vmaValue, setVmaValue] = useState('');
  const [vmaReason, setVmaReason] = useState('');
  const [editingLicense, setEditingLicense] = useState<string | null>(null);
  const [licenseValue, setLicenseValue] = useState('');
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

  const newMembers = useMemo(() => {
    return users.filter(u => u.role === 'athlete' && !u.group_id && !u.vma);
  }, [users]);

  const athletes = useMemo(() => {
    return users
      .filter(u => {
        if (isSuperAdmin) return u.email !== SUPER_ADMIN_EMAIL;
        return u.role === 'athlete';
      })
      .filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q);
      });
  }, [users, search, isSuperAdmin]);

  const getAttendanceRate = (userId: string) => {
    const totalSessions = sessions.length;
    if (totalSessions === 0) return 0;
    const done = validations.filter(v => v.user_id === userId && v.status === 'done').length;
    return Math.round((done / totalSessions) * 100);
  };

  const handleVmaEdit = (userId: string) => {
    if (vmaValue && !isNaN(parseFloat(vmaValue))) {
      updateUserVma(userId, parseFloat(vmaValue), vmaReason.trim() || undefined);
    }
    setEditingVma(null);
    setVmaValue('');
    setVmaReason('');
  };

  const handleLicenseEdit = (userId: string) => {
    updateUserLicense(userId, licenseValue.trim() || null);
    setEditingLicense(null);
    setLicenseValue('');
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

      {/* New members */}
      {newMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              {newMembers.length} nouveau{newMembers.length > 1 ? 'x' : ''} membre{newMembers.length > 1 ? 's' : ''}
            </span>
          </div>
          {newMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-amber-100">
              <Avatar user={m} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.firstname} {m.lastname}</p>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
              </div>
              <select
                defaultValue=""
                onChange={e => { if (e.target.value) updateUserGroup(m.id, e.target.value); }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="" disabled>Groupe...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          ))}
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
      <div className="space-y-2">
        {athletes.map(athlete => {
          const group = groups.find(g => g.id === athlete.group_id);
          const rate = getAttendanceRate(athlete.id);
          return (
            <div key={athlete.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Avatar user={athlete} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    {athlete.firstname} {athlete.lastname}
                    {athlete.role === 'coach' && (
                      <span className="inline-flex items-center text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Coach</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{athlete.email}</p>
                  {group && <p className="text-xs text-gray-500">{group.name}</p>}
                  {(() => {
                    const prepId = userPreparations.find(up => up.user_id === athlete.id)?.preparation_id;
                    const prep = prepId ? preparations.find(p => p.id === prepId) : null;
                    return prep ? <p className="text-xs text-amber-600">{prep.name}</p> : null;
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  {isSuperAdmin && (
                    <button
                      onClick={async () => { await impersonate(athlete.id); navigate('/'); }}
                      className="p-2 text-gray-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Voir en tant que"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {confirmDeleteId === athlete.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(athlete.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(athlete.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">VMA</span>
                  {editingVma === athlete.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" step="0.5" inputMode="decimal"
                        value={vmaValue}
                        onChange={e => setVmaValue(e.target.value)}
                        className="w-16 px-2 py-1 border border-primary rounded-lg text-center text-sm focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleVmaEdit(athlete.id)} className="p-1 text-green-600 hover:text-green-700"><Check size={14} /></button>
                      <button onClick={() => { setEditingVma(null); setVmaValue(''); setVmaReason(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingVma(athlete.id); setVmaValue(String(athlete.vma || '')); setVmaReason(''); }}
                      className="font-bold text-primary hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors text-sm min-w-[3rem]"
                    >
                      {athlete.vma || '-'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Licence</span>
                  {editingLicense === athlete.id ? (
                    <input
                      type="text"
                      value={licenseValue}
                      onChange={e => setLicenseValue(e.target.value)}
                      onBlur={() => handleLicenseEdit(athlete.id)}
                      onKeyDown={e => e.key === 'Enter' && handleLicenseEdit(athlete.id)}
                      className="w-20 px-2 py-1 border border-primary rounded-lg text-center text-sm focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingLicense(athlete.id); setLicenseValue(athlete.license_number || ''); }}
                      className="font-bold text-primary hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors text-sm min-w-[3rem]"
                    >
                      {athlete.license_number || '-'}
                    </button>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Assiduite</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                    <div
                      className={`h-full rounded-full ${rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-red-400'}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{rate}%</span>
                </div>
              </div>
              {editingVma === athlete.id && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <input
                    type="text"
                    value={vmaReason}
                    onChange={e => setVmaReason(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVmaEdit(athlete.id)}
                    placeholder="Raison (test piste, estimation...)"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
