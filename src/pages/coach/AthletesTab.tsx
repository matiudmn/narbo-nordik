import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, X, Search, Share2, Copy, Eye, UserPlus, KeyRound, RefreshCw, ChevronRight } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import Avatar from '../../components/Avatar';
import { Button, Card, ConfirmDialog, useToast } from '../../components/ui';
import type { Role } from '../../types';
import { matchTokens } from '../../lib/search';
import { getUserPrepIds } from '../../lib/athleteSessions';
import { computeAttendance, formatAttendance } from '../../lib/attendance';
import { getSeasonRange } from '../../lib/date-utils';

// 4 octets aleatoires en hexa majuscules, meme format que le code seede par
// la migration 20260731130000 (encode(gen_random_bytes(4), 'hex')).
function generateInviteCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export default function AthletesTab() {
  const { users, groups, validations, sessions, preparations, userPreparations, clubSettings, updateClubSettings, updateUserVma, updateUserGroup, addUser, deleteUser } = useData();
  const { isSuperAdmin, impersonate } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRegenerateCode, setConfirmRegenerateCode] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [editingVma, setEditingVma] = useState<string | null>(null);
  const [vmaValue, setVmaValue] = useState('');
  const [vmaReason, setVmaReason] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [submittingVma, setSubmittingVma] = useState(false);
  const [addError, setAddError] = useState('');

  const [newFirstname, setNewFirstname] = useState('');
  const [newLastname, setNewLastname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newVma, setNewVma] = useState('');

  const newMembers = useMemo(() => {
    return users.filter(u => u.role === 'athlete' && !u.group_id && !u.vma);
  }, [users]);

  // Tri alphabétique (demande coach David : retrouver vite un athlète pour
  // changer une VMA) + recherche insensible aux accents (matchTokens).
  const athletes = useMemo(() => {
    return users
      .filter(u => {
        if (isSuperAdmin) return !u.is_super_admin;
        return u.role === 'athlete';
      })
      .filter(u => !debouncedSearch || matchTokens(`${u.firstname} ${u.lastname}`, debouncedSearch))
      .sort((a, b) =>
        a.firstname.localeCompare(b.firstname, 'fr', { sensitivity: 'base' }) ||
        a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' })
      );
  }, [users, debouncedSearch, isSuperAdmin]);

  const closeVmaEditor = () => {
    setEditingVma(null);
    setVmaValue('');
    setVmaReason('');
  };

  // Régularité sur la saison, calcul centralisé (cf. lib/attendance), mémoïsé
  // par athlète : ne se recalcule pas à chaque frappe dans la recherche.
  const attendanceById = useMemo(() => {
    const range = getSeasonRange();
    return new Map(users.map(u => [
      u.id,
      computeAttendance(u, sessions, validations, getUserPrepIds(u.id, userPreparations), range),
    ]));
  }, [users, sessions, validations, userPreparations]);

  const handleVmaEdit = async (userId: string) => {
    if (submittingVma) return;
    if (vmaValue && !isNaN(parseFloat(vmaValue))) {
      setSubmittingVma(true);
      const res = await updateUserVma(userId, parseFloat(vmaValue), vmaReason.trim() || undefined);
      setSubmittingVma(false);
      if (res.error) {
        toast.error("Échec de la mise à jour de la VMA.");
        return;
      }
    }
    closeVmaEditor();
  };

  const getShareMessage = (name: string, email: string, tempPassword: string) =>
    `Salut ${name} ! Bienvenue sur Narbo Nordik. Ton compte a ete cree.\nEmail : ${email}\nMot de passe : ${tempPassword}\n${window.location.origin}`;

  const capitalize = (s: string) => s.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(s.includes('-') ? '-' : ' ');

  const handleAddAthlete = async () => {
    if (!newFirstname || !newLastname || !newEmail) return;
    setAddingAthlete(true);
    setAddError('');
    const first = capitalize(newFirstname.trim());
    const last = capitalize(newLastname.trim());
    const name = `${first} ${last}`;
    const email = newEmail;
    const result = await addUser({
      firstname: first,
      lastname: last,
      email,
      role: 'athlete' as Role,
      vma: newVma ? parseFloat(newVma) : null,
      group_id: newGroup || null,
      phone: null,
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

  const handleCopyCode = async () => {
    if (!clubSettings?.invite_code) return;
    await navigator.clipboard.writeText(clubSettings.invite_code);
    toast.success('Code copié.');
  };

  const handleRegenerateCode = async () => {
    if (!clubSettings) return;
    setRegeneratingCode(true);
    const res = await updateClubSettings(clubSettings.race_paces, clubSettings.allure_zones, generateInviteCode());
    setRegeneratingCode(false);
    setConfirmRegenerateCode(false);
    if (res.error) {
      toast.error('Échec de la régénération du code.');
      return;
    }
    toast.success('Nouveau code généré.');
  };

  return (
    <div className="space-y-3">
      {/* Invite code */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-gray-700">
            <KeyRound size={16} className="text-primary" />
            <span className="text-sm font-bold">Code d'invitation</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={() => setConfirmRegenerateCode(true)}
          >
            Régénérer
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-gray-900 bg-gray-50 rounded-lg px-3 py-1.5">
            {clubSettings?.invite_code ?? '…'}
          </span>
          <button
            onClick={handleCopyCode}
            aria-label="Copier le code"
            className="p-2 text-gray-300 hover:text-primary transition-colors"
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Communique ce code aux nouveaux membres : il leur est demandé à l'inscription.
        </p>
      </Card>

      {/* Add button */}
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="sm"
          leftIcon={showAdd ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? 'Fermer' : 'Ajouter un athlète'}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="space-y-3">
          <h2 className="font-bold text-neutral-900 text-sm">Nouvel athlete</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" placeholder="Prenom" value={newFirstname}
              onChange={e => setNewFirstname(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="text" placeholder="Nom" value={newLastname}
              onChange={e => setNewLastname(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <input
            type="email" placeholder="Email" value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newGroup} onChange={e => setNewGroup(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Groupe...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input
              type="number" step="0.5" placeholder="VMA (km/h)" value={newVma}
              onChange={e => setNewVma(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {addError && <p className="text-danger text-sm">{addError}</p>}
          <Button
            variant="primary"
            fullWidth
            loading={addingAthlete}
            disabled={!newFirstname || !newLastname || !newEmail}
            onClick={handleAddAthlete}
          >
            {addingAthlete ? 'Création du compte…' : "Ajouter l'athlète"}
          </Button>
        </Card>
      )}

      {/* Share panel */}
      {shareInfo && (
        <div className="bg-success-50 border border-success-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-success-700">
              {shareInfo.name} ajoute !
            </p>
            <button onClick={() => setShareInfo(null)} className="p-1 text-success-600 hover:bg-success-100 rounded">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-success-700 bg-white rounded-lg p-3 whitespace-pre-line">
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
              className="flex items-center justify-center gap-2 px-4 py-2 border border-success-500 text-success-700 rounded-lg text-sm font-medium hover:bg-success-100 transition-colors"
            >
              <Copy size={16} />
              {copied ? 'Copie !' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      {/* New members */}
      {newMembers.length > 0 && (
        <div className="bg-warning-50 border border-warning-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-warning-600" />
            <span className="text-sm font-bold text-warning-700">
              {newMembers.length} nouveau{newMembers.length > 1 ? 'x' : ''} membre{newMembers.length > 1 ? 's' : ''}
            </span>
          </div>
          {newMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-warning-100">
              <Avatar user={m} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{m.firstname} {m.lastname}</p>
                <p className="text-xs text-neutral-400 truncate">{m.email}</p>
              </div>
              <select
                defaultValue=""
                onChange={e => { if (e.target.value) updateUserGroup(m.id, e.target.value); }}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="" disabled>Groupe...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <Link
                to={`/coach/athlete/${m.id}`}
                aria-label={`Ouvrir la fiche de ${m.firstname} ${m.lastname}`}
                className="p-1.5 text-neutral-400 hover:text-primary transition-colors"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Athletes list */}
      <div className="space-y-2">
        {athletes.map(athlete => {
          const group = groups.find(g => g.id === athlete.group_id);
          const attendance = attendanceById.get(athlete.id) ?? { done: 0, total: 0, rate: null };
          return (
            <div
              key={athlete.id}
              className="bg-white rounded-xl border border-neutral-100 p-4"
            >
              <div className="flex items-center gap-3">
                <Link
                  to={`/coach/athlete/${athlete.id}`}
                  aria-label={`Ouvrir la fiche de ${athlete.firstname} ${athlete.lastname}`}
                  className="flex items-center gap-3 flex-1 min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Avatar user={athlete} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                      {athlete.firstname} {athlete.lastname}
                      {athlete.role === 'coach' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Coach</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{athlete.email}</p>
                    {group && <p className="text-xs text-neutral-500">{group.name}</p>}
                    {(() => {
                      const prepId = userPreparations.find(up => up.user_id === athlete.id)?.preparation_id;
                      const prep = prepId ? preparations.find(p => p.id === prepId) : null;
                      return prep ? <p className="text-xs text-warning-600">{prep.name}</p> : null;
                    })()}
                  </div>
                  <ChevronRight size={18} className="text-neutral-300 shrink-0" aria-hidden="true" />
                </Link>
                <div className="flex items-center gap-1">
                  {isSuperAdmin && (
                    <button
                      onClick={async () => { await impersonate(athlete.id); navigate('/'); }}
                      className="p-2 text-neutral-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Voir en tant que"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {confirmDeleteId === athlete.id ? (
                    <div className="flex gap-1" role="group" aria-label="Confirmer la suppression">
                      <button onClick={() => handleDelete(athlete.id)} aria-label="Confirmer la suppression" className="p-2 text-danger hover:bg-danger-50 rounded-lg">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} aria-label="Annuler" className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(athlete.id)}
                      aria-label="Supprimer l'athlète"
                      className="p-2 text-neutral-300 hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-50">
                {/* Édition VMA inline : raccourci de terrain pour le coach. */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">VMA</span>
                  {editingVma === athlete.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" step="0.5" inputMode="decimal"
                        value={vmaValue}
                        onChange={e => setVmaValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleVmaEdit(athlete.id); }}
                        disabled={submittingVma}
                        className="w-16 px-2 py-1 border border-primary rounded-lg text-center text-sm focus:outline-none disabled:opacity-60"
                        autoFocus
                      />
                      <button onClick={() => handleVmaEdit(athlete.id)} disabled={submittingVma} className="p-1 text-success-600 hover:text-success-700 disabled:opacity-60"><Check size={14} /></button>
                      <button onClick={closeVmaEditor} disabled={submittingVma} className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-60"><X size={14} /></button>
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
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Régularité</span>
                  {attendance.rate === null ? (
                    <span className="text-xs font-medium text-neutral-500">-</span>
                  ) : (
                    <>
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className="h-full rounded-full bg-primary/30"
                          style={{ width: `${attendance.rate}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-neutral-500 tabular">{formatAttendance(attendance)}</span>
                    </>
                  )}
                </div>
              </div>
              {editingVma === athlete.id && (
                <div className="mt-2 pt-2 border-t border-neutral-50">
                  <input
                    type="text"
                    value={vmaReason}
                    onChange={e => setVmaReason(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVmaEdit(athlete.id)}
                    disabled={submittingVma}
                    placeholder="Raison (test piste, estimation...)"
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmRegenerateCode}
        title="Régénérer le code d'invitation ?"
        description="L'ancien code cessera de fonctionner immédiatement. Les personnes qui ne se sont pas encore inscrites devront utiliser le nouveau code."
        confirmLabel="Régénérer"
        loading={regeneratingCode}
        onConfirm={handleRegenerateCode}
        onCancel={() => setConfirmRegenerateCode(false)}
      />
    </div>
  );
}
