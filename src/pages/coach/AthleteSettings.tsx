import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, Gauge, History, IdCard, Phone, Trash2, UsersRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';
import { PageSkeleton } from '../../components/Skeleton';
import { Badge, Button, Card, ConfirmDialog, Disclosure, EmptyState, useToast } from '../../components/ui';
import { getFFACategory } from '../../lib/ffa';
import { VMA_LEVELS, getVmaLevelIndex } from '../../lib/calculations';
import { motion, VARIANTS } from '../../lib/motion';
import type { User } from '../../types';

const ATHLETES_TAB = '/coach/settings?tab=athletes';

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.section variants={VARIANTS.staggerItem}>
      <Card className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <span aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {children}
      </Card>
    </motion.section>
  );
}

interface SavableFieldProps {
  label: string;
  value: string;
  type?: 'text' | 'date' | 'tel';
  inputMode?: 'text' | 'tel';
  placeholder?: string;
  /** Aide contextuelle recalculée à chaque frappe (ex. catégorie FFA). */
  renderHint?: (draft: string) => ReactNode;
  /** Forme canonique de la saisie : sert à comparer et à enregistrer. */
  normalize?: (value: string) => string;
  /** Interdit l'enregistrement d'une valeur vide. */
  required?: boolean;
  onSave: (value: string) => Promise<{ error: string | null }>;
}

/** Champ autonome : une valeur, un bouton, un enregistrement. */
function SavableField({ label, value, type = 'text', inputMode, placeholder, renderHint, normalize, required, onSave }: SavableFieldProps) {
  const toast = useToast();
  const fieldId = useId();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const canonical = normalize ? normalize(draft) : draft;
  const dirty = canonical !== value;
  const empty = required && draft.trim() === '';

  const save = async () => {
    if (!dirty || saving || empty) return;
    setSaving(true);
    const res = await onSave(canonical);
    setSaving(false);
    if (res.error) toast.error("Échec de l'enregistrement.");
    else toast.success('Modification enregistrée.');
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-medium text-neutral-500">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={fieldId}
          type={type}
          inputMode={inputMode}
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          className="flex-1 min-w-0 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={save}
          disabled={!dirty || empty}
          loading={saving}
          leftIcon={<Check size={14} aria-hidden="true" />}
        >
          Enregistrer
        </Button>
      </div>
      {renderHint?.(draft)}
    </div>
  );
}

function AthleteSettingsForm({ member }: { member: User }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser, refreshUser } = useAuth();
  const {
    groups, preparations, userPreparations,
    updateUser, updateUserVma, updateUserLicense, updateUserBirthDate,
    updateUserGroup, updateUserPhone, updateUserPublic,
    addUserToPreparation, removeUserFromPreparation, deleteUser,
  } = useData();

  const [vmaValue, setVmaValue] = useState(member.vma?.toString() ?? '');
  const [vmaReason, setVmaReason] = useState('');
  const [savingVma, setSavingVma] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Le coach peut éditer sa propre ligne : useAuth().user doit alors être
  // rafraîchi, comme le fait Profile.tsx.
  const isSelf = currentUser?.id === member.id;
  const syncSelf = async () => { if (isSelf) await refreshUser(); };
  const deletable = member.role === 'athlete' && !member.is_super_admin && !isSelf;

  const memberPrepIds = useMemo(
    () => userPreparations.filter(up => up.user_id === member.id).map(up => up.preparation_id),
    [userPreparations, member.id]
  );

  const group = groups.find(g => g.id === member.group_id);
  const currentPrep = preparations.find(p => memberPrepIds.includes(p.id));
  const category = member.birth_date ? getFFACategory(member.birth_date) : null;
  const level = member.vma != null ? VMA_LEVELS[getVmaLevelIndex(member.vma)] : null;

  // updateUserVma ajoute une entrée d'historique à chaque appel : on ne rejoue
  // jamais une valeur identique.
  const handleVmaSave = async () => {
    if (savingVma) return;
    const parsed = parseFloat(vmaValue);
    if (!isFinite(parsed) || parsed < 5 || parsed > 30) {
      toast.error('Saisis une VMA entre 5 et 30 km/h.');
      return;
    }
    if (parsed === member.vma) {
      toast.info('VMA inchangée.');
      return;
    }
    setSavingVma(true);
    const res = await updateUserVma(member.id, parsed, vmaReason.trim() || undefined);
    setSavingVma(false);
    if (res.error) {
      toast.error('Échec de la mise à jour de la VMA.');
      return;
    }
    setVmaReason('');
    await syncSelf();
    toast.success('VMA enregistrée.');
  };

  const handleGroupChange = async (groupId: string) => {
    const res = await updateUserGroup(member.id, groupId || null);
    await syncSelf();
    if (res.error) toast.error('Échec du changement de groupe.');
    else toast.success('Groupe enregistré.');
  };

  const handlePrepToggle = async (prepId: string, registered: boolean) => {
    const res = registered
      ? await removeUserFromPreparation(member.id, prepId)
      : await addUserToPreparation(member.id, prepId);
    if (res.error) toast.error("Échec de la mise à jour de l'inscription.");
    else toast.success(registered ? 'Retiré de la préparation.' : 'Inscrit à la préparation.');
  };

  const handlePublicToggle = async () => {
    const res = await updateUserPublic(member.id, !member.is_public);
    await syncSelf();
    if (res.error) toast.error('Échec de la mise à jour de la visibilité.');
    else toast.success('Visibilité enregistrée.');
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteUser(member.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (res.error) {
      toast.error('Échec de la suppression.');
      return;
    }
    toast.success(`${member.firstname} a été supprimé.`);
    navigate(ATHLETES_TAB);
  };

  const saveName = async (field: 'firstname' | 'lastname', value: string) => {
    const res = await updateUser(member.id, { [field]: value });
    await syncSelf();
    return res;
  };

  return (
    <div className="py-4 space-y-3">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-600" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-neutral-900">Réglages de {member.firstname}</h1>
        <Link
          to={`/directory/${member.id}`}
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          <Eye size={12} aria-hidden="true" />
          Voir sa fiche
        </Link>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <Avatar user={member} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900">{member.firstname} {member.lastname}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {member.vma != null && <Badge tone="primary">VMA {member.vma} km/h</Badge>}
              <Badge tone="neutral">{group?.name ?? 'Aucun groupe'}</Badge>
              {category && <Badge tone="accent">{category.label} ({category.code})</Badge>}
              {currentPrep && <Badge tone="warning">{currentPrep.name}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <motion.div
        className="space-y-3"
        variants={VARIANTS.staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Entraînement */}
        <Section title="Entraînement" icon={<Gauge size={16} className="text-primary" />}>
          <div className="space-y-1.5">
            <label htmlFor="vma-input" className="block text-xs font-medium text-neutral-500">VMA (km/h)</label>
            <div className="flex items-center gap-2">
              <input
                id="vma-input"
                type="number"
                step="0.1"
                min="5"
                max="30"
                inputMode="decimal"
                value={vmaValue}
                onChange={e => setVmaValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleVmaSave(); }}
                disabled={savingVma}
                className="flex-1 min-w-0 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleVmaSave}
                loading={savingVma}
                leftIcon={<Check size={14} aria-hidden="true" />}
              >
                Enregistrer
              </Button>
            </div>
            <input
              type="text"
              value={vmaReason}
              onChange={e => setVmaReason(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleVmaSave(); }}
              disabled={savingVma}
              placeholder="Raison (test piste, estimation...)"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-xs font-medium text-neutral-500">Niveau</p>
              <p className="text-sm text-neutral-900">
                {level ? `${level.label} (${level.description})` : 'Renseigne la VMA pour le calculer'}
              </p>
            </div>
            {member.vma_history.length > 0 && (
              <Link
                to={`/vma-history?user=${member.id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                <History size={12} aria-hidden="true" />
                Historique VMA
              </Link>
            )}
          </div>
        </Section>

        {/* Identité et FFA */}
        <Section title="Identité et FFA" icon={<IdCard size={16} className="text-primary" />}>
          <SavableField
            label="Date de naissance"
            type="date"
            value={member.birth_date ?? ''}
            renderHint={draft => (
              <p className="text-xs text-neutral-500">
                Catégorie FFA :{' '}
                {draft
                  ? `${getFFACategory(draft).label} (${getFFACategory(draft).code})`
                  : 'à calculer une fois la date renseignée'}
              </p>
            )}
            onSave={async v => {
              const res = await updateUserBirthDate(member.id, v || null);
              await syncSelf();
              return res;
            }}
          />
          <SavableField
            label="Numéro de licence"
            value={member.license_number ?? ''}
            placeholder="Ex : 1234567"
            normalize={v => v.trim()}
            onSave={async v => {
              const res = await updateUserLicense(member.id, v || null);
              await syncSelf();
              return res;
            }}
          />
          <SavableField
            label="Prénom"
            value={member.firstname}
            normalize={v => v.trim()}
            required
            onSave={v => saveName('firstname', v)}
          />
          <SavableField
            label="Nom"
            value={member.lastname}
            normalize={v => v.trim()}
            required
            onSave={v => saveName('lastname', v)}
          />
        </Section>

        {/* Club */}
        <Section title="Club" icon={<UsersRound size={16} className="text-primary" />}>
          <div className="space-y-1.5">
            <label htmlFor="group-select" className="block text-xs font-medium text-neutral-500">Groupe</label>
            <select
              id="group-select"
              value={member.group_id ?? ''}
              onChange={e => handleGroupChange(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Aucun groupe</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-neutral-500">Préparations spécifiques</legend>
            {preparations.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucune préparation créée pour l'instant.</p>
            ) : (
              preparations.map(prep => {
                const registered = memberPrepIds.includes(prep.id);
                return (
                  <label key={prep.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registered}
                      onChange={() => handlePrepToggle(prep.id, registered)}
                      className="rounded border-neutral-300 text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm text-neutral-700">{prep.name}</span>
                  </label>
                );
              })
            )}
          </fieldset>
        </Section>

        {/* Contact et visibilité */}
        <Section title="Contact et visibilité" icon={<Phone size={16} className="text-primary" />}>
          <SavableField
            label="Téléphone (WhatsApp)"
            type="tel"
            inputMode="tel"
            value={member.phone ?? ''}
            placeholder="0612345678 ou +33612345678"
            normalize={v => v.replace(/[^0-9]/g, '').replace(/^0/, '33')}
            onSave={async v => {
              const res = await updateUserPhone(member.id, v || null);
              await syncSelf();
              return res;
            }}
          />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-500">Email</p>
            <p className="text-sm text-neutral-900 break-all">{member.email ?? 'Non communiqué'}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Profil public</p>
              <p className="text-xs text-neutral-500">Visible dans l'annuaire par les autres athlètes</p>
            </div>
            <button
              onClick={handlePublicToggle}
              role="switch"
              aria-checked={member.is_public}
              aria-label="Profil public"
              className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${member.is_public ? 'bg-primary' : 'bg-neutral-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${member.is_public ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>
        </Section>

        {/* Zone sensible : jamais sur soi-même, un coach ou un super-admin. */}
        {deletable && (
          <motion.div variants={VARIANTS.staggerItem}>
            <Disclosure title="Zone sensible" headingLevel={2} icon={<Trash2 size={16} className="text-danger" />}>
              <div className="space-y-2">
                <p className="text-sm text-neutral-600">
                  La suppression retire le profil, ses validations de séances et son palmarès. Aucun retour possible.
                </p>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 size={14} aria-hidden="true" />}>
                  Supprimer l'athlète
                </Button>
              </div>
            </Disclosure>
          </motion.div>
        )}
      </motion.div>

      {deletable && (
        <ConfirmDialog
          open={confirmDelete}
          destructive
          title={`Supprimer ${member.firstname} ${member.lastname} ?`}
          description="Le profil, ses validations et son palmarès seront supprimés définitivement."
          confirmLabel="Supprimer"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

export default function AthleteSettings() {
  const { id } = useParams<{ id: string }>();
  const { users, loading } = useData();
  const member = users.find(u => u.id === id);

  if (!member) {
    if (loading) return <PageSkeleton />;
    return (
      <div className="py-8">
        <EmptyState
          title="Athlète introuvable"
          description="Ce profil n'existe plus ou l'adresse est erronée."
        />
        <div className="text-center">
          <Link to={ATHLETES_TAB} className="text-sm text-primary hover:underline">
            Retour à la liste des athlètes
          </Link>
        </div>
      </div>
    );
  }

  // Clé sur l'id : les états locaux (VMA, brouillons de champs) sont réinitialisés
  // si le coach passe d'une fiche à une autre sans démonter la route.
  return <AthleteSettingsForm key={member.id} member={member} />;
}
