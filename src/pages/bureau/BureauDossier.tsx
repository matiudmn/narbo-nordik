import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, BadgeCheck, FileQuestion, RotateCcw, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toMember, toMembershipSeason } from '../../contexts/data/rows';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  useToast,
} from '../../components/ui';
import { PageSkeleton } from '../../components/Skeleton';
import {
  canClearPayment,
  canValidate,
  centsToInput,
  derivePaymentStatus,
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_TONES,
  formatEuros,
  inputToCents,
  LICENSE_LABELS,
  MANUAL_PAYMENT_METHODS,
  MEMBERSHIP_TYPE_LABELS,
  onlinePaymentState,
  overpaidCents,
  paymentBadge,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  remainingCents,
  SECTION_LABELS,
  SECTION_LICENSE_TYPES,
  SOURCE_LABELS,
  TSHIRT_MODEL_LABELS,
  TSHIRT_SIZES,
} from '../../lib/membership';
import type { LicenseType, Member, MembershipSeason, MembershipType, PaymentMethod, TshirtModel } from '../../types';
import type { TablesUpdate } from '../../types/database.types';

const inputClass =
  'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

const fieldLabelClass = 'block text-xs font-medium text-neutral-500';

function formatDay(value: string): string {
  return format(new Date(value), 'd MMMM yyyy', { locale: fr });
}

/**
 * Page dossier : le parent charge la paire saison + adhérent, l'éditeur est
 * remonté via `key` à chaque changement de dossier, ce qui initialise tous les
 * formulaires par useState sans effet de synchronisation.
 */
export default function BureauDossier() {
  const { id } = useParams<{ id: string }>();
  const { isBoard } = useAuth();

  const [dossier, setDossier] = useState<{ season: MembershipSeason; member: Member } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const seasonRes = await supabase.from('membership_seasons').select('*').eq('id', id).maybeSingle();
    if (seasonRes.error || !seasonRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const season = toMembershipSeason(seasonRes.data);
    const memberRes = await supabase.from('members').select('*').eq('id', season.member_id).maybeSingle();
    if (memberRes.error || !memberRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setDossier({ season, member: toMember(memberRes.data) });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // Chargement initial du dossier (fetch au montage, même motif assumé que
    // InAppNotificationContext).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!isBoard) {
    return <div className="py-8 text-center text-neutral-500">Cette page est réservée au conseil d'administration.</div>;
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (notFound || !dossier) {
    return (
      <div className="py-4 space-y-4">
        <Link
          to="/bureau"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Adhésions
        </Link>
        <Card>
          <EmptyState
            icon={<FileQuestion size={32} />}
            title="Dossier introuvable"
            description="Il a peut-être été supprimé, ou le lien est erroné."
          />
        </Card>
      </div>
    );
  }

  return <DossierEditor key={dossier.season.id} initialSeason={dossier.season} initialMember={dossier.member} />;
}

function DossierEditor({ initialSeason, initialMember }: { initialSeason: MembershipSeason; initialMember: Member }) {
  const { user } = useAuth();
  const toast = useToast();

  const [season, setSeason] = useState(initialSeason);
  const [member, setMember] = useState(initialMember);

  // Pointage du règlement. Le montant reste VIDE tant que rien n'est encaissé :
  // prérempli avec le montant dû, un Entrée réflexe dans le formulaire
  // enregistrait un règlement complet fantôme (revue du 02/09).
  const [amountInput, setAmountInput] = useState(() =>
    initialSeason.amount_paid_cents > 0 ? centsToInput(initialSeason.amount_paid_cents) : ''
  );
  // 'en_ligne' n'est pas pointable à la main mais reste sélectionné quand le
  // dossier a été réglé par Stripe : un pointage complémentaire ne doit pas
  // réécrire silencieusement le mode réel en « Virement » (revue du 02/09).
  const [method, setMethod] = useState<PaymentMethod>(() => {
    const stored = initialSeason.payment_method;
    // 'en_ligne' n'est conservé que si Stripe a CONFIRMÉ un encaissement. Sur
    // un dossier qui a seulement annoncé un paiement en ligne sans aller au
    // bout, le pointage doit corriger le mode, comme le promet le bandeau
    // rouge (« le mode de règlement sera corrigé en même temps »).
    if (stored === 'en_ligne') {
      return onlinePaymentState(initialSeason) === 'confirmed' ? 'en_ligne' : 'virement';
    }
    return stored && MANUAL_PAYMENT_METHODS.includes(stored) ? stored : 'virement';
  });
  const [paidDate, setPaidDate] = useState(() =>
    format(initialSeason.paid_at ? new Date(initialSeason.paid_at) : new Date(), 'yyyy-MM-dd')
  );
  const [savingPayment, setSavingPayment] = useState(false);

  // Dossier d'adhésion
  const [licenseType, setLicenseType] = useState<'' | LicenseType>(initialSeason.license_type ?? '');
  const [membershipType, setMembershipType] = useState<MembershipType>(initialSeason.membership_type);
  const [dueInput, setDueInput] = useState(() => centsToInput(initialSeason.amount_due_cents));
  const [discountInput, setDiscountInput] = useState(() => centsToInput(initialSeason.family_discount_cents));
  const [tshirtModel, setTshirtModel] = useState<'' | TshirtModel>(initialSeason.tshirt_model ?? '');
  const [tshirtSize, setTshirtSize] = useState(initialSeason.tshirt_size ?? '');
  const [savingAdhesion, setSavingAdhesion] = useState(false);

  // Fiche adhérent
  const [memberForm, setMemberForm] = useState(() => ({
    firstname: initialMember.firstname,
    lastname: initialMember.lastname,
    birth_date: initialMember.birth_date,
    sex: initialMember.sex,
    email: initialMember.email,
    phone: initialMember.phone ?? '',
    address_street: initialMember.address_street ?? '',
    address_postal_code: initialMember.address_postal_code ?? '',
    address_city: initialMember.address_city ?? '',
    family_group: initialMember.family_group ?? '',
    notes: initialMember.notes ?? '',
  }));
  const [savingMember, setSavingMember] = useState(false);

  const [confirm, setConfirm] = useState<'validate' | 'reject' | 'reopen' | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const saveSeason = useCallback(
    async (patch: TablesUpdate<'membership_seasons'>, success: string): Promise<MembershipSeason | null> => {
      const { data, error } = await supabase
        .from('membership_seasons')
        .update(patch)
        .eq('id', season.id)
        .select()
        .single();
      if (error) {
        // Le verrou de validation en base porte un message rédigé pour
        // l'écran : repéré par son code SQLSTATE (23514), plus par une
        // sous-chaîne française fragile (revue du 02/09).
        toast.error(error.code === '23514' ? error.message : 'Enregistrement impossible, réessaie.');
        return null;
      }
      const fresh = toMembershipSeason(data);
      setSeason(fresh);
      toast.success(success);
      return fresh;
    },
    [season.id, toast]
  );

  const pointPayment = useCallback(
    async (cents: number) => {
      const nextStatus = derivePaymentStatus(cents, season.amount_due_cents);
      if (season.status === 'validated' && nextStatus === 'pending') {
        toast.error('Dossier validé : repasse-le en « déposé » avant d’annuler son règlement.');
        return;
      }
      // Champ date vidé à la main : new Date('T12:00:00') lèverait et
      // laisserait le bouton en chargement pour toujours (revue du 02/09).
      if (nextStatus !== 'pending' && !paidDate) {
        toast.error('Choisis une date de règlement.');
        return;
      }
      setSavingPayment(true);
      await saveSeason(
        {
          amount_paid_cents: cents,
          payment_status: nextStatus,
          payment_method: nextStatus === 'pending' ? season.payment_method : method,
          paid_at: nextStatus === 'pending' ? null : new Date(`${paidDate}T12:00:00`).toISOString(),
        },
        nextStatus === 'pending' ? 'Règlement remis à zéro.' : 'Règlement enregistré.'
      );
      setSavingPayment(false);
    },
    [season, method, paidDate, saveSeason, toast]
  );

  function handleSubmitPayment(e: FormEvent) {
    e.preventDefault();
    const cents = inputToCents(amountInput);
    if (cents === null) {
      toast.error('Montant invalide.');
      return;
    }
    void pointPayment(cents);
  }

  async function handleStatusChange(action: 'validate' | 'reject' | 'reopen') {
    if (!user) return;
    setConfirmLoading(true);
    const patch: TablesUpdate<'membership_seasons'> =
      action === 'reopen'
        ? { status: 'submitted', validated_by: null, validated_at: null }
        : {
            status: action === 'validate' ? 'validated' : 'rejected',
            validated_by: user.id,
            validated_at: new Date().toISOString(),
          };
    const ok = await saveSeason(
      patch,
      action === 'validate' ? 'Dossier validé.' : action === 'reject' ? 'Dossier refusé.' : 'Dossier repassé en « déposé ».'
    );
    setConfirmLoading(false);
    if (ok) setConfirm(null);
  }

  async function handleSaveAdhesion(e: FormEvent) {
    e.preventDefault();
    const due = inputToCents(dueInput);
    const discount = inputToCents(discountInput);
    if (due === null || discount === null) {
      toast.error('Montant invalide.');
      return;
    }
    if (tshirtModel && !tshirtSize) {
      toast.error('Choisis une taille de maillot.');
      return;
    }
    const patch: TablesUpdate<'membership_seasons'> = {
      license_type: licenseType || null,
      membership_type: membershipType,
      amount_due_cents: due,
      family_discount_cents: discount,
      tshirt_model: tshirtModel || null,
      tshirt_size: tshirtModel ? tshirtSize : null,
    };
    setSavingAdhesion(true);
    // Un règlement déjà pointé se relit contre le nouveau montant dû (un dû
    // corrigé à la hausse repasse « réglé » en « partiel », et inversement).
    // Le recalcul se fait sur la ligne FRAÎCHE renvoyée par l'écriture, pas
    // sur l'état local : un autre membre du CA a pu pointer entre-temps
    // (revue du 02/09). Jamais sur un dossier validé : le verrou en base
    // refuserait tout retour en « en attente ».
    const fresh = await saveSeason(patch, 'Dossier mis à jour.');
    if (fresh && (fresh.payment_status === 'paid' || fresh.payment_status === 'partial')) {
      const expected = derivePaymentStatus(fresh.amount_paid_cents, fresh.amount_due_cents);
      if (expected !== fresh.payment_status) {
        if (fresh.status === 'validated' && expected === 'pending') {
          toast.info('Dossier validé : le statut du règlement est conservé. Repasse-le en « déposé » pour le recalculer.');
        } else {
          await saveSeason({ payment_status: expected }, 'Statut du règlement recalé sur le nouveau montant.');
        }
      }
    }
    setSavingAdhesion(false);
  }

  async function handleSaveMember(e: FormEvent) {
    e.preventDefault();
    if (!memberForm.firstname.trim() || !memberForm.lastname.trim() || !memberForm.email.trim() || !memberForm.birth_date) {
      toast.error('Prénom, nom, e-mail et date de naissance sont obligatoires.');
      return;
    }
    const trimOrNull = (value: string) => {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    };
    setSavingMember(true);
    const { data, error } = await supabase
      .from('members')
      .update({
        firstname: memberForm.firstname.trim(),
        lastname: memberForm.lastname.trim(),
        birth_date: memberForm.birth_date,
        sex: memberForm.sex,
        email: memberForm.email.trim(),
        phone: trimOrNull(memberForm.phone),
        address_street: trimOrNull(memberForm.address_street),
        address_postal_code: trimOrNull(memberForm.address_postal_code),
        address_city: trimOrNull(memberForm.address_city),
        family_group: trimOrNull(memberForm.family_group),
        notes: trimOrNull(memberForm.notes),
      })
      .eq('id', member.id)
      .select()
      .single();
    setSavingMember(false);
    if (error) {
      toast.error(
        error.code === '23505'
          ? 'Un autre dossier porte déjà ce nom et cet e-mail.'
          : 'Enregistrement impossible, réessaie.'
      );
      return;
    }
    setMember(toMember(data));
    toast.success('Fiche adhérent mise à jour.');
  }

  const licenseOptions = SECTION_LICENSE_TYPES[season.section];
  const allLicenseOptions =
    licenseType && !licenseOptions.includes(licenseType) ? [licenseType, ...licenseOptions] : licenseOptions;
  const catalogSizes = tshirtModel ? TSHIRT_SIZES[tshirtModel] : [];
  const sizeOptions =
    tshirtSize && tshirtModel && !catalogSizes.includes(tshirtSize) ? [tshirtSize, ...catalogSizes] : catalogSizes;
  const previewCents = inputToCents(amountInput);
  const previewStatus = previewCents === null ? null : derivePaymentStatus(previewCents, season.amount_due_cents);
  const overpaid = overpaidCents(season);
  const onlineState = onlinePaymentState(season);

  return (
    <div className="py-4 space-y-4">
      <Link
        to="/bureau"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Adhésions
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
          Espace bureau · Saison {season.season}
        </p>
        <h1 className="text-h1 font-display font-bold text-neutral-900">
          {member.firstname} {member.lastname}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge tone="neutral">{SECTION_LABELS[season.section]}</Badge>
          {season.license_type && <Badge tone="neutral">{LICENSE_LABELS[season.license_type]}</Badge>}
          <Badge tone={DOSSIER_STATUS_TONES[season.status]}>{DOSSIER_STATUS_LABELS[season.status]}</Badge>
          <Badge tone={paymentBadge(season).tone}>{paymentBadge(season).label}</Badge>
          {member.user_id ? (
            <Badge tone="success" icon={<UserRound size={12} aria-hidden="true" />}>Compte app rattaché</Badge>
          ) : (
            <Badge tone="neutral">Sans compte app</Badge>
          )}
        </div>
        <p className="text-sm text-neutral-500 mt-2">
          Déposé le {formatDay(season.created_at)} · {SOURCE_LABELS[member.source]} ·{' '}
          {MEMBERSHIP_TYPE_LABELS[season.membership_type]}
        </p>
        <p className="text-sm text-neutral-500 mt-0.5">
          <a href={`mailto:${member.email}`} className="text-accent-dark hover:underline">{member.email}</a>
          {member.phone && (
            <>
              {' · '}
              <a href={`tel:${member.phone}`} className="text-accent-dark hover:underline">{member.phone}</a>
            </>
          )}
          {member.address_city && ` · ${member.address_city}`}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* RÈGLEMENT */}
        <Card>
          <CardHeader
            title="Règlement"
            subtitle="Le rapprochement bancaire reste ton geste : ici, tu pointes ce qui est arrivé."
          />
          {onlineState === 'awaiting' && (
            <p className="text-sm text-danger-700 bg-danger-50 rounded-lg p-3 mb-3">
              <strong>Paiement en ligne annoncé, jamais abouti.</strong> L&apos;adhérent a choisi de payer
              par carte au moment de sa demande, mais Stripe n&apos;a confirmé aucun paiement : le club n&apos;a
              rien encaissé. Relance-le, ou pointe ci-dessous s&apos;il règle autrement (le mode de règlement
              sera corrigé en même temps).
            </p>
          )}
          {onlineState === 'confirmed' && (
            <p className="text-sm text-success-700 bg-success-50 rounded-lg p-3 mb-3">
              <strong>Paiement confirmé par Stripe.</strong> Le montant a été enregistré automatiquement,
              tu n&apos;as rien à pointer. Référence pour le rapprochement bancaire :{' '}
              <span className="tabular break-all">{season.stripe_payment_intent_id}</span>
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-50 rounded-lg p-2">
              <p className="text-xs text-neutral-500">Dû</p>
              <p className="text-sm font-semibold tabular text-neutral-900">{formatEuros(season.amount_due_cents)}</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-2">
              <p className="text-xs text-neutral-500">Encaissé</p>
              <p className="text-sm font-semibold tabular text-neutral-900">{formatEuros(season.amount_paid_cents)}</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-2">
              <p className="text-xs text-neutral-500">{overpaid > 0 ? 'Trop-perçu' : 'Reste'}</p>
              <p className={`text-sm font-semibold tabular ${overpaid > 0 ? 'text-warning-700' : 'text-neutral-900'}`}>
                {formatEuros(overpaid > 0 ? overpaid : remainingCents(season))}
              </p>
            </div>
          </div>
          {season.paid_at && (
            <p className="text-xs text-neutral-500 mt-2">
              Dernier pointage le {formatDay(season.paid_at)}
              {season.payment_method && ` · ${PAYMENT_METHOD_LABELS[season.payment_method]}`}
            </p>
          )}
          <form onSubmit={handleSubmitPayment} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className={fieldLabelClass}>
                Montant encaissé (€)
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                />
              </label>
              <label className={fieldLabelClass}>
                Date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                />
              </label>
            </div>
            <label className={fieldLabelClass}>
              Mode de règlement
              <select
                className={`${inputClass} mt-1`}
                value={method}
                onChange={e => setMethod(e.target.value as PaymentMethod)}
              >
                {onlineState === 'confirmed' && (
                  <option value="en_ligne">{PAYMENT_METHOD_LABELS.en_ligne}</option>
                )}
                {MANUAL_PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </label>
            {previewStatus && (
              <p className="text-xs text-neutral-500">
                Statut résultant : {PAYMENT_STATUS_LABELS[previewStatus].toLowerCase()}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={savingPayment}>
                Enregistrer le règlement
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={savingPayment}
                onClick={() => {
                  setAmountInput(centsToInput(season.amount_due_cents));
                  void pointPayment(season.amount_due_cents);
                }}
              >
                Tout est réglé
              </Button>
              {canClearPayment(season) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={savingPayment}
                  onClick={() => {
                    setAmountInput('0');
                    void pointPayment(0);
                  }}
                >
                  Remettre à zéro
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* STATUT */}
        <Card>
          <CardHeader
            title="Statut du dossier"
            subtitle={
              season.validated_at
                ? `Décision enregistrée le ${formatDay(season.validated_at)}`
                : 'Règle du club : un règlement, même partiel, avant toute validation.'
            }
          />
          {season.status === 'submitted' && !canValidate(season.payment_status) && (
            <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3 mb-3">
              Pointe d'abord un règlement, même partiel : la validation est verrouillée tant que rien
              n'est encaissé (le verrou est aussi appliqué en base).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {season.status === 'submitted' ? (
              <>
                <Button
                  size="sm"
                  variant="accent"
                  leftIcon={<BadgeCheck size={16} aria-hidden="true" />}
                  disabled={!canValidate(season.payment_status)}
                  onClick={() => setConfirm('validate')}
                >
                  Valider le dossier
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirm('reject')}>
                  Refuser
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => setConfirm('reopen')}
              >
                Repasser en « déposé »
              </Button>
            )}
          </div>
          <div className="text-xs text-neutral-500 space-y-0.5 mt-4">
            <p>
              Règlement intérieur accepté le {formatDay(season.rules_accepted_at)} · consentement RGPD le{' '}
              {formatDay(season.gdpr_consent_at)}
            </p>
            {season.ce_certificate_requested && <p>Attestation de cotisation demandée (comité d'entreprise).</p>}
          </div>
        </Card>
      </div>

      {/* ADHÉSION */}
      <Card>
        <CardHeader
          title="Adhésion"
          subtitle={`Licence, montant dû et maillot${season.tshirt_included ? ' (maillot du club offert cette saison)' : ''}`}
        />
        <form onSubmit={handleSaveAdhesion} className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <label className={fieldLabelClass}>
              Licence
              <select
                className={`${inputClass} mt-1`}
                value={licenseType}
                onChange={e => setLicenseType(e.target.value as '' | LicenseType)}
              >
                <option value="">Non renseignée</option>
                {allLicenseOptions.map(license => (
                  <option key={license} value={license}>{LICENSE_LABELS[license]}</option>
                ))}
              </select>
            </label>
            <label className={fieldLabelClass}>
              Type d'adhésion
              <select
                className={`${inputClass} mt-1`}
                value={membershipType}
                onChange={e => setMembershipType(e.target.value as MembershipType)}
              >
                {(Object.keys(MEMBERSHIP_TYPE_LABELS) as MembershipType[]).map(type => (
                  <option key={type} value={type}>{MEMBERSHIP_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className={fieldLabelClass}>
              Montant dû (€)
              <input
                type="text"
                inputMode="decimal"
                className={`${inputClass} mt-1`}
                value={dueInput}
                onChange={e => setDueInput(e.target.value)}
              />
            </label>
            <label className={fieldLabelClass}>
              Réduction famille (€)
              <input
                type="text"
                inputMode="decimal"
                className={`${inputClass} mt-1`}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:max-w-md">
            <label className={fieldLabelClass}>
              Maillot
              <select
                className={`${inputClass} mt-1`}
                value={tshirtModel}
                onChange={e => {
                  setTshirtModel(e.target.value as '' | TshirtModel);
                  setTshirtSize('');
                }}
              >
                <option value="">Non renseigné</option>
                {(Object.keys(TSHIRT_MODEL_LABELS) as TshirtModel[]).map(model => (
                  <option key={model} value={model}>{TSHIRT_MODEL_LABELS[model]}</option>
                ))}
              </select>
            </label>
            <label className={fieldLabelClass}>
              Taille
              <select
                className={`${inputClass} mt-1`}
                value={tshirtSize}
                onChange={e => setTshirtSize(e.target.value)}
                disabled={!tshirtModel}
              >
                <option value="">Choisir</option>
                {sizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            La réduction famille est déjà déduite du montant dû : pour la retirer, remets-la à 0 et
            corrige le montant dû en face.
          </p>
          <Button type="submit" size="sm" loading={savingAdhesion}>
            Enregistrer le dossier
          </Button>
        </form>
      </Card>

      {/* FICHE ADHÉRENT */}
      <Disclosure
        title="Fiche adhérent"
        subtitle="Identité, coordonnées, rattachement famille et notes du bureau"
        icon={<UserRound size={18} className="text-neutral-400" />}
      >
        <form onSubmit={handleSaveMember} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <label className={fieldLabelClass}>
              Prénom
              <input className={`${inputClass} mt-1`} value={memberForm.firstname}
                onChange={e => setMemberForm(f => ({ ...f, firstname: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Nom
              <input className={`${inputClass} mt-1`} value={memberForm.lastname}
                onChange={e => setMemberForm(f => ({ ...f, lastname: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Date de naissance
              <input type="date" className={`${inputClass} mt-1`} value={memberForm.birth_date}
                onChange={e => setMemberForm(f => ({ ...f, birth_date: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Sexe (licence FFA)
              <select className={`${inputClass} mt-1`} value={memberForm.sex}
                onChange={e => setMemberForm(f => ({ ...f, sex: e.target.value as Member['sex'] }))}>
                <option value="F">F</option>
                <option value="M">M</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <label className={fieldLabelClass}>
              E-mail
              <input type="email" className={`${inputClass} mt-1`} value={memberForm.email}
                onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Téléphone
              <input type="tel" className={`${inputClass} mt-1`} value={memberForm.phone}
                onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <label className={fieldLabelClass}>
              Adresse
              <input className={`${inputClass} mt-1`} value={memberForm.address_street}
                onChange={e => setMemberForm(f => ({ ...f, address_street: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Code postal
              <input className={`${inputClass} mt-1`} value={memberForm.address_postal_code}
                onChange={e => setMemberForm(f => ({ ...f, address_postal_code: e.target.value }))} />
            </label>
            <label className={fieldLabelClass}>
              Ville
              <input className={`${inputClass} mt-1`} value={memberForm.address_city}
                onChange={e => setMemberForm(f => ({ ...f, address_city: e.target.value }))} />
            </label>
          </div>
          <label className={fieldLabelClass}>
            Rattachement famille (réduction de 10 €)
            <input className={`${inputClass} mt-1`} value={memberForm.family_group}
              placeholder="Nom du foyer ou du membre principal"
              onChange={e => setMemberForm(f => ({ ...f, family_group: e.target.value }))} />
          </label>
          <label className={fieldLabelClass}>
            Notes du bureau (jamais visibles de l'adhérent)
            <textarea rows={3} className={`${inputClass} mt-1`} value={memberForm.notes}
              onChange={e => setMemberForm(f => ({ ...f, notes: e.target.value }))} />
          </label>
          <Button type="submit" size="sm" loading={savingMember}>
            Enregistrer la fiche
          </Button>
        </form>
      </Disclosure>

      <ConfirmDialog
        open={confirm === 'validate'}
        title="Valider ce dossier ?"
        description={`${member.firstname} ${member.lastname} · ${formatEuros(season.amount_due_cents)} · règlement ${PAYMENT_STATUS_LABELS[season.payment_status].toLowerCase()}.`}
        confirmLabel="Valider"
        loading={confirmLoading}
        onConfirm={() => void handleStatusChange('validate')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reject'}
        destructive
        title="Refuser ce dossier ?"
        description="Le dossier reste consultable et peut être repassé en « déposé » plus tard. Rien n'est supprimé."
        confirmLabel="Refuser"
        loading={confirmLoading}
        onConfirm={() => void handleStatusChange('reject')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title="Repasser ce dossier en « déposé » ?"
        description="La décision précédente est effacée, le dossier redevient à traiter."
        confirmLabel="Repasser en déposé"
        loading={confirmLoading}
        onConfirm={() => void handleStatusChange('reopen')}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
