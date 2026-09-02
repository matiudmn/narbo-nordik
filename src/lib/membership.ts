/**
 * Domaine « adhésions » de l'espace bureau (/bureau) : libellés, jointure
 * members + membership_seasons, règles de gestion (validation conditionnée au
 * règlement, verrou aussi posé en base par la migration 20260831180000) et
 * agrégats de synthèse. Logique pure, sans DOM ni Supabase, testée dans
 * membership.test.ts (vitest, environnement node).
 */
import type {
  Member,
  MembershipSeason,
  MemberSection,
  MemberSource,
  LicenseType,
  MembershipType,
  PaymentStatus,
  PaymentMethod,
  MembershipStatus,
  TshirtModel,
} from '../types';
import { normalize } from './search';

// Sous-ensemble des tonalités de Badge/MetricTile (littéraux identiques) :
// permet aux pages de passer ces valeurs aux primitives UI sans que ce module
// importe quoi que ce soit de src/components.
type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const SECTION_LABELS: Record<MemberSection, string> = {
  marche_nordique: 'Marche nordique',
  running_trail: 'Running / Trail',
};

export const LICENSE_LABELS: Record<LicenseType, string> = {
  sante: 'Santé',
  competition: 'Compétition',
  running: 'Athlé Running',
};

export const MEMBERSHIP_TYPE_LABELS: Record<MembershipType, string> = {
  nouveau: 'Nouvelle adhésion',
  renouvellement: 'Renouvellement',
  renouvellement_ffa_direct: 'Renouvellement FFA direct',
};

export const SOURCE_LABELS: Record<MemberSource, string> = {
  web_form: 'Formulaire du site',
  paper: 'Dossier papier',
  app: 'Application',
  import: 'Reprise de données',
};

export const DOSSIER_STATUS_LABELS: Record<MembershipStatus, string> = {
  submitted: 'Déposé',
  validated: 'Validé',
  rejected: 'Refusé',
};

export const DOSSIER_STATUS_TONES: Record<MembershipStatus, Tone> = {
  submitted: 'info',
  validated: 'success',
  rejected: 'danger',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente',
  partial: 'Partiel',
  paid: 'Réglé',
  cancelled: 'Annulé',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
  pending: 'warning',
  partial: 'info',
  paid: 'success',
  cancelled: 'neutral',
};

// Modes proposés au pointage manuel du bureau. 'en_ligne' existe en base mais
// est réservé au futur encaissement Stripe : il ne se pointe pas à la main.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  en_ligne: 'En ligne',
};
export const MANUAL_PAYMENT_METHODS: PaymentMethod[] = ['virement', 'cheque', 'especes'];

// Licences proposées par section (miroir de SECTION_LICENSE_TYPES côté site).
export const SECTION_LICENSE_TYPES: Record<MemberSection, LicenseType[]> = {
  marche_nordique: ['sante', 'competition'],
  running_trail: ['running', 'competition'],
};

// Tailles proposées à l'édition (décision du club du 2026-08-18 : femme en
// lettres). La base accepte encore les anciennes tailles numériques ERIMA
// (34-48) sur les dossiers existants : l'UI doit préfixer la valeur courante
// si elle n'est pas dans cette liste, sans jamais la proposer pour une
// nouvelle saisie.
export const TSHIRT_SIZES: Record<TshirtModel, string[]> = {
  homme: ['S', 'M', 'L', 'XL', 'XXL'],
  femme: ['S', 'M', 'L', 'XL'],
};

export const TSHIRT_MODEL_LABELS: Record<TshirtModel, string> = {
  homme: 'Homme',
  femme: 'Femme',
};

// --- Montants (centimes) -----------------------------------------------------

export function formatEuros(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/** Valeur de champ de saisie pour un montant en centimes ("165" ou "165,50"). */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',');
}

/** Saisie utilisateur ("165", "165,50", "165.50", espaces, €) vers centimes. null si invalide. */
export function inputToCents(input: string): number | null {
  const cleaned = input.replace(/[\s€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

// --- Jointure et recherche ---------------------------------------------------

export interface Dossier {
  season: MembershipSeason;
  member: Member;
}

/**
 * Joint les adhésions à leur adhérent, triées par nom puis prénom. Une saison
 * dont le membre n'est pas lisible (ne devrait pas arriver sous les policies
 * bureau, les deux tables s'ouvrant ensemble) est ignorée plutôt qu'affichée
 * à moitié vide.
 */
export function joinDossiers(members: Member[], seasons: MembershipSeason[]): Dossier[] {
  const byId = new Map(members.map(m => [m.id, m]));
  return seasons
    .flatMap(season => {
      const member = byId.get(season.member_id);
      return member ? [{ season, member }] : [];
    })
    .sort(
      (a, b) =>
        a.member.lastname.localeCompare(b.member.lastname, 'fr') ||
        a.member.firstname.localeCompare(b.member.firstname, 'fr')
    );
}

/** Saisons présentes, les plus récentes d'abord (format AAAA-AAAA : le tri lexical suffit). */
export function seasonsOf(seasons: Pick<MembershipSeason, 'season'>[]): string[] {
  return [...new Set(seasons.map(s => s.season))].sort().reverse();
}

// Une seule d\u00e9finition de \u00ab sans accents, minuscules \u00bb pour toute l'app : la
// recherche du bureau se comporte comme la recherche globale (revue 02/09).
export const normalizeText = normalize;

/** Recherche insensible aux accents sur nom, prénom, e-mail et rattachement famille. */
export function matchesDossier(dossier: Dossier, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  const haystack = normalizeText(
    [
      dossier.member.firstname,
      dossier.member.lastname,
      dossier.member.email,
      dossier.member.family_group ?? '',
    ].join(' ')
  );
  return q.split(/\s+/).every(part => haystack.includes(part));
}

// --- Règles de gestion -------------------------------------------------------

/**
 * Règle du club (2026-08-28) : un dossier ne se valide qu'après réception d'un
 * règlement, même partiel. Même règle que le trigger enforce_validation_payment
 * en base : ici pour désactiver le bouton, là-bas pour tous les canaux.
 */
export function canValidate(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === 'paid' || paymentStatus === 'partial';
}

/**
 * Statut de règlement déduit d'un pointage. Un dossier à 0 € dû (cas limite :
 * cotisation entièrement couverte ailleurs) est considéré réglé dès qu'on le
 * pointe, sinon il serait invalidable à jamais.
 */
export function derivePaymentStatus(paidCents: number, dueCents: number): PaymentStatus {
  if (dueCents <= 0) return 'paid';
  if (paidCents <= 0) return 'pending';
  return paidCents >= dueCents ? 'paid' : 'partial';
}

/**
 * Un règlement pointé se remet à zéro seulement s'il y a quelque chose à
 * effacer et que le dossier n'est pas validé : le verrou en base (trigger
 * enforce_validation_payment) refuse un retour en « en attente » sur un
 * dossier validé, il faut d'abord le repasser en « déposé ». Règle partagée
 * entre le bouton « Remettre à zéro » et la garde de pointage de l'écran.
 */
export function canClearPayment(
  season: Pick<MembershipSeason, 'amount_paid_cents' | 'status'>
): boolean {
  return season.amount_paid_cents > 0 && season.status !== 'validated';
}

/** Reste dû, plancher à 0 (le trop-perçu se lit à part). */
export function remainingCents(
  season: Pick<MembershipSeason, 'amount_due_cents' | 'amount_paid_cents'>
): number {
  return Math.max(0, season.amount_due_cents - season.amount_paid_cents);
}

/** Trop-perçu (encaissé au-delà du dû), 0 sinon. */
export function overpaidCents(
  season: Pick<MembershipSeason, 'amount_due_cents' | 'amount_paid_cents'>
): number {
  return Math.max(0, season.amount_paid_cents - season.amount_due_cents);
}

// --- Agrégats de synthèse ----------------------------------------------------

export interface SectionSummary {
  count: number;
  dueCents: number;
  paidCents: number;
}

export interface BureauSummary {
  total: number;
  submitted: number;
  validated: number;
  rejected: number;
  /** Montants hors dossiers refusés : un doublon refusé ne gonfle pas l'attendu. */
  dueCents: number;
  paidCents: number;
  familyDiscountCount: number;
  bySection: Record<MemberSection, SectionSummary>;
}

export function buildSummary(dossiers: Dossier[]): BureauSummary {
  const summary: BureauSummary = {
    total: dossiers.length,
    submitted: 0,
    validated: 0,
    rejected: 0,
    dueCents: 0,
    paidCents: 0,
    familyDiscountCount: 0,
    bySection: {
      marche_nordique: { count: 0, dueCents: 0, paidCents: 0 },
      running_trail: { count: 0, dueCents: 0, paidCents: 0 },
    },
  };
  for (const { season } of dossiers) {
    summary[season.status] += 1;
    if (season.status === 'rejected') continue;
    summary.dueCents += season.amount_due_cents;
    summary.paidCents += season.amount_paid_cents;
    if (season.family_discount_cents > 0) summary.familyDiscountCount += 1;
    const section = summary.bySection[season.section];
    section.count += 1;
    section.dueCents += season.amount_due_cents;
    section.paidCents += season.amount_paid_cents;
  }
  return summary;
}

export interface TshirtOrderLine {
  model: TshirtModel;
  size: string;
  count: number;
}

/**
 * Maillots à commander : comptes par modèle et taille, hors dossiers refusés
 * et hors dossiers sans modèle ou sans taille. Tri : homme puis femme, tailles
 * dans l'ordre du catalogue (les tailles hors catalogue, anciennes numériques,
 * ferment la marche).
 */
export function tshirtOrders(dossiers: Dossier[]): TshirtOrderLine[] {
  const counts = new Map<string, TshirtOrderLine>();
  for (const { season } of dossiers) {
    if (season.status === 'rejected' || !season.tshirt_model || !season.tshirt_size) continue;
    const key = `${season.tshirt_model}:${season.tshirt_size}`;
    const line = counts.get(key);
    if (line) line.count += 1;
    else counts.set(key, { model: season.tshirt_model, size: season.tshirt_size, count: 1 });
  }
  const sizeRank = (line: TshirtOrderLine) => {
    const index = TSHIRT_SIZES[line.model].indexOf(line.size);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...counts.values()].sort(
    (a, b) =>
      a.model.localeCompare(b.model) ||
      sizeRank(a) - sizeRank(b) ||
      a.size.localeCompare(b.size, 'fr')
  );
}
