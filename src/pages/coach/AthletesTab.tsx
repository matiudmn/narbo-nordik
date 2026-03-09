import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, X, Search, Share2, Copy, Loader2, Eye, UserPlus } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import Avatar from '../../components/Avatar';
import type { Role } from '../../types';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';

export default function AthletesTab() {
  const { users, groups, validations, sessions, preparations, userPreparations, updateUserVma, updateUserLicense, updateUserGroup, addUser, deleteUser } = useData();
  const { isSuperAdmin, impersonate } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
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
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        return u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q);
      });
  }, [users, debouncedSearch, isSuperAdmin]);

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
