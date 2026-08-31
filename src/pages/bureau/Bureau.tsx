import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Landmark, Search, Shirt } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toMember, toMembershipSeason } from '../../contexts/data/rows';
import { Badge, Card, Disclosure, EmptyState, MetricTile } from '../../components/ui';
import { PageSkeleton } from '../../components/Skeleton';
import {
  buildSummary,
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_TONES,
  formatEuros,
  joinDossiers,
  LICENSE_LABELS,
  matchesDossier,
  MEMBERSHIP_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  SECTION_LABELS,
  seasonsOf,
  TSHIRT_MODEL_LABELS,
  tshirtOrders,
} from '../../lib/membership';
import type { Member, MemberSection, MembershipSeason, MembershipStatus, PaymentStatus } from '../../types';

const inputClass =
  'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

const chipClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
  }`;

export default function Bureau() {
  const { isBoard } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [seasonRows, setSeasonRows] = useState<MembershipSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<'all' | MemberSection>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | MembershipStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [familyOnly, setFamilyOnly] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const [membersRes, seasonsRes] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('membership_seasons').select('*'),
    ]);
    if (membersRes.error || seasonsRes.error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setMembers(membersRes.data.map(toMember));
    setSeasonRows(seasonsRes.data.map(toMembershipSeason));
    setLoading(false);
  }, []);

  useEffect(() => {
    // Chargement initial des dossiers (fetch au montage, même motif assumé
    // que InAppNotificationContext).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const seasonList = useMemo(() => seasonsOf(seasonRows), [seasonRows]);
  const activeSeason = seasonFilter ?? seasonList[0] ?? null;

  const dossiers = useMemo(
    () => joinDossiers(members, seasonRows.filter(s => s.season === activeSeason)),
    [members, seasonRows, activeSeason]
  );
  const summary = useMemo(() => buildSummary(dossiers), [dossiers]);
  const orders = useMemo(() => tshirtOrders(dossiers), [dossiers]);
  const orderTotal = orders.reduce((sum, line) => sum + line.count, 0);

  const filtered = useMemo(
    () =>
      dossiers.filter(dossier => {
        const { season } = dossier;
        if (sectionFilter !== 'all' && season.section !== sectionFilter) return false;
        if (statusFilter !== 'all' && season.status !== statusFilter) return false;
        if (paymentFilter !== 'all' && season.payment_status !== paymentFilter) return false;
        if (familyOnly && season.family_discount_cents <= 0) return false;
        return matchesDossier(dossier, query);
      }),
    [dossiers, sectionFilter, statusFilter, paymentFilter, familyOnly, query]
  );

  if (!isBoard) {
    return <div className="py-8 text-center text-neutral-500">Cette page est réservée au conseil d'administration.</div>;
  }

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="py-4 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Espace bureau</p>
          <h1 className="text-h1 font-display font-bold text-neutral-900">Adhésions</h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
            Pointe les règlements, valide les dossiers et garde la vue d'ensemble. Les demandes déposées
            sur le site arrivent ici automatiquement.
          </p>
        </div>
        {seasonList.length > 1 ? (
          <label className="text-sm text-neutral-600">
            <span className="sr-only">Saison</span>
            <select
              className={inputClass}
              value={activeSeason ?? ''}
              onChange={e => setSeasonFilter(e.target.value)}
            >
              {seasonList.map(season => (
                <option key={season} value={season}>Saison {season}</option>
              ))}
            </select>
          </label>
        ) : (
          activeSeason && <Badge tone="neutral" size="md">Saison {activeSeason}</Badge>
        )}
      </header>

      {loadError ? (
        <Card>
          <EmptyState
            icon={<Landmark size={32} />}
            title="Les dossiers n'ont pas pu être chargés"
            description="Vérifie ta connexion, puis réessaie."
            actionLabel="Réessayer"
            onAction={() => {
              setLoading(true);
              setLoadError(false);
              void load();
            }}
          />
        </Card>
      ) : dossiers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark size={32} />}
            title="Aucun dossier pour l'instant"
            description="Les demandes d'adhésion déposées sur le site apparaîtront ici dès la première inscription."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile value={summary.total} label="Dossiers" tone="primary" />
            <MetricTile value={summary.submitted} label="À valider" tone={summary.submitted > 0 ? 'warning' : 'success'} />
            <MetricTile valueDisplay={formatEuros(summary.dueCents)} label="Attendu" tone="accent" />
            <MetricTile valueDisplay={formatEuros(summary.paidCents)} label="Encaissé" tone="success" />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
            {(Object.keys(summary.bySection) as MemberSection[]).map(section => (
              <span key={section}>
                {SECTION_LABELS[section]} : {summary.bySection[section].count}{' '}
                {summary.bySection[section].count > 1 ? 'dossiers' : 'dossier'} ·{' '}
                {formatEuros(summary.bySection[section].dueCents)}
              </span>
            ))}
            {summary.rejected > 0 && (
              <span>
                {summary.rejected} refusé{summary.rejected > 1 ? 's' : ''}, hors totaux
              </span>
            )}
          </div>

          <Card className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                className={`${inputClass} pl-9`}
                placeholder="Rechercher un adhérent, un e-mail, une famille..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Rechercher un dossier"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chipClass(sectionFilter === 'all')} onClick={() => setSectionFilter('all')}>
                Toutes sections
              </button>
              {(Object.keys(SECTION_LABELS) as MemberSection[]).map(section => (
                <button
                  key={section}
                  type="button"
                  className={chipClass(sectionFilter === section)}
                  onClick={() => setSectionFilter(section)}
                >
                  {SECTION_LABELS[section]}
                </button>
              ))}
              <button type="button" className={chipClass(familyOnly)} onClick={() => setFamilyOnly(v => !v)}>
                Réduction famille ({summary.familyDiscountCount})
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-neutral-500">
                Dossier
                <select
                  className={`${inputClass} mt-1`}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | MembershipStatus)}
                >
                  <option value="all">Tous</option>
                  {(Object.keys(DOSSIER_STATUS_LABELS) as MembershipStatus[]).map(status => (
                    <option key={status} value={status}>{DOSSIER_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-neutral-500">
                Règlement
                <select
                  className={`${inputClass} mt-1`}
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value as 'all' | PaymentStatus)}
                >
                  <option value="all">Tous</option>
                  {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(status => (
                    <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search size={32} />}
                title="Aucun dossier ne correspond"
                description="Élargis les filtres ou vérifie l'orthographe de la recherche."
              />
            </Card>
          ) : (
            <Card padding="none">
              <ul className="divide-y divide-neutral-100">
                {filtered.map(({ season, member }) => (
                  <li key={season.id}>
                    <Link
                      to={`/bureau/dossier/${season.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {member.firstname} {member.lastname}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {SECTION_LABELS[season.section]}
                          {season.license_type && ` · ${LICENSE_LABELS[season.license_type]}`}
                          {` · ${MEMBERSHIP_TYPE_LABELS[season.membership_type]}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular text-neutral-900">
                          {formatEuros(season.amount_due_cents)}
                        </p>
                        <div className="flex gap-1 justify-end mt-1">
                          <Badge tone={PAYMENT_STATUS_TONES[season.payment_status]}>
                            {PAYMENT_STATUS_LABELS[season.payment_status]}
                          </Badge>
                          <Badge tone={DOSSIER_STATUS_TONES[season.status]}>
                            {DOSSIER_STATUS_LABELS[season.status]}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-neutral-300 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Disclosure
            title={`Maillots à commander (${orderTotal})`}
            subtitle="Dossiers non refusés, modèle et taille renseignés"
            icon={<Shirt size={18} className="text-neutral-400" />}
          >
            {orders.length === 0 ? (
              <p className="text-sm text-neutral-500 py-2">Aucun maillot à commander pour l'instant.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="py-1.5 font-medium">Modèle</th>
                    <th className="py-1.5 font-medium">Taille</th>
                    <th className="py-1.5 font-medium text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {orders.map(line => (
                    <tr key={`${line.model}-${line.size}`}>
                      <td className="py-1.5">{TSHIRT_MODEL_LABELS[line.model]}</td>
                      <td className="py-1.5">{line.size}</td>
                      <td className="py-1.5 text-right tabular font-semibold">{line.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Disclosure>
        </>
      )}
    </div>
  );
}
