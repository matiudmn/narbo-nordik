import { describe, it, expect } from 'vitest';
import type { Member, MembershipSeason } from '../types';
import {
  buildSummary,
  canClearPayment,
  canValidate,
  centsToInput,
  derivePaymentStatus,
  inputToCents,
  joinDossiers,
  matchesDossier,
  onlinePaymentState,
  overpaidCents,
  paymentBadge,
  remainingCents,
  seasonsOf,
  tshirtOrders,
} from './membership';

let nextId = 0;

function makeMember(overrides: Partial<Member> = {}): Member {
  nextId += 1;
  return {
    id: `member-${nextId}`,
    user_id: null,
    firstname: 'Jean',
    lastname: 'Dupont',
    birth_date: '1980-01-01',
    sex: 'M',
    nationality: 'Française',
    address_street: null,
    address_postal_code: null,
    address_city: null,
    email: 'jean.dupont@example.org',
    phone: null,
    section: 'running_trail',
    family_group: null,
    notes: null,
    source: 'web_form',
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

function makeSeason(memberId: string, overrides: Partial<MembershipSeason> = {}): MembershipSeason {
  nextId += 1;
  return {
    id: `season-${nextId}`,
    member_id: memberId,
    season: '2026-2027',
    section: 'running_trail',
    license_type: 'running',
    activities: ['trail'],
    tshirt_model: 'homme',
    tshirt_size: 'M',
    tshirt_included: true,
    membership_type: 'nouveau',
    amount_due_cents: 16500,
    family_discount_cents: 0,
    amount_paid_cents: 0,
    payment_status: 'pending',
    payment_method: 'virement',
    paid_at: null,
    stripe_payment_intent_id: null,
    rules_accepted_at: '2026-08-20T10:00:00Z',
    gdpr_consent_at: '2026-08-20T10:00:00Z',
    ce_certificate_requested: false,
    status: 'submitted',
    validated_by: null,
    validated_at: null,
    welcome_email_sent_at: null,
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

describe('joinDossiers', () => {
  it('joint chaque saison à son adhérent et trie par nom puis prénom', () => {
    const zola = makeMember({ lastname: 'Zola', firstname: 'Anna' });
    const abadieB = makeMember({ lastname: 'Abadie', firstname: 'Brice' });
    const abadieA = makeMember({ lastname: 'Abadie', firstname: 'Alice' });
    const dossiers = joinDossiers(
      [zola, abadieB, abadieA],
      [makeSeason(zola.id), makeSeason(abadieB.id), makeSeason(abadieA.id)]
    );
    expect(dossiers.map(d => `${d.member.firstname} ${d.member.lastname}`)).toEqual([
      'Alice Abadie',
      'Brice Abadie',
      'Anna Zola',
    ]);
  });

  it('ignore une saison sans adhérent lisible au lieu de planter', () => {
    const member = makeMember();
    const dossiers = joinDossiers([member], [makeSeason(member.id), makeSeason('member-inconnu')]);
    expect(dossiers).toHaveLength(1);
  });
});

describe('seasonsOf', () => {
  it('déduplique et renvoie les saisons les plus récentes en premier', () => {
    const seasons = ['2025-2026', '2026-2027', '2025-2026'].map(season => ({ season }));
    expect(seasonsOf(seasons)).toEqual(['2026-2027', '2025-2026']);
  });
});

describe('matchesDossier', () => {
  const dossier = {
    member: makeMember({ firstname: 'Gérald', lastname: 'Peña', family_group: 'Foyer Peña' }),
    season: makeSeason('x'),
  };

  it('trouve sans accents et sans casse', () => {
    expect(matchesDossier(dossier, 'gerald pena')).toBe(true);
    expect(matchesDossier(dossier, 'PEÑA')).toBe(true);
  });

  it('cherche aussi dans le rattachement famille', () => {
    expect(matchesDossier(dossier, 'foyer')).toBe(true);
  });

  it('rejette ce qui ne correspond pas et accepte la requête vide', () => {
    expect(matchesDossier(dossier, 'martin')).toBe(false);
    expect(matchesDossier(dossier, '  ')).toBe(true);
  });
});

describe('règles de règlement', () => {
  it('canValidate suit la règle du club : payé ou partiel uniquement', () => {
    expect(canValidate('paid')).toBe(true);
    expect(canValidate('partial')).toBe(true);
    expect(canValidate('pending')).toBe(false);
    expect(canValidate('cancelled')).toBe(false);
  });

  it('derivePaymentStatus couvre pending, partial, paid et le trop-perçu', () => {
    expect(derivePaymentStatus(0, 16500)).toBe('pending');
    expect(derivePaymentStatus(5000, 16500)).toBe('partial');
    expect(derivePaymentStatus(16500, 16500)).toBe('paid');
    expect(derivePaymentStatus(18000, 16500)).toBe('paid');
  });

  it('un dossier à 0 € dû est réglé dès le pointage, sinon il serait invalidable', () => {
    expect(derivePaymentStatus(0, 0)).toBe('paid');
  });

  it('canClearPayment : encaissé présent et dossier non validé, sinon verrouillé', () => {
    expect(canClearPayment({ amount_paid_cents: 16500, status: 'submitted' })).toBe(true);
    expect(canClearPayment({ amount_paid_cents: 16500, status: 'rejected' })).toBe(true);
    expect(canClearPayment({ amount_paid_cents: 16500, status: 'validated' })).toBe(false);
    expect(canClearPayment({ amount_paid_cents: 0, status: 'submitted' })).toBe(false);
  });

  it('remainingCents et overpaidCents sont planchers à 0', () => {
    expect(remainingCents({ amount_due_cents: 16500, amount_paid_cents: 5000 })).toBe(11500);
    expect(remainingCents({ amount_due_cents: 16500, amount_paid_cents: 18000 })).toBe(0);
    expect(overpaidCents({ amount_due_cents: 16500, amount_paid_cents: 18000 })).toBe(1500);
    expect(overpaidCents({ amount_due_cents: 16500, amount_paid_cents: 5000 })).toBe(0);
  });
});

describe('paiement en ligne : annoncé vs réellement encaissé', () => {
  it('confirmed dès que Stripe a posé une référence de paiement', () => {
    expect(
      onlinePaymentState({ payment_method: 'en_ligne', stripe_payment_intent_id: 'pi_123' })
    ).toBe('confirmed');
  });

  it('awaiting quand le paiement en ligne est annoncé sans référence Stripe', () => {
    expect(
      onlinePaymentState({ payment_method: 'en_ligne', stripe_payment_intent_id: null })
    ).toBe('awaiting');
  });

  it('none pour un règlement classique', () => {
    for (const method of ['virement', 'cheque', 'especes', null] as const) {
      expect(onlinePaymentState({ payment_method: method, stripe_payment_intent_id: null })).toBe('none');
    }
  });

  it('un dossier repointé à la main par le bureau sort de l état « en ligne »', () => {
    expect(
      onlinePaymentState({ payment_method: 'cheque', stripe_payment_intent_id: null })
    ).toBe('none');
  });

  it('paymentBadge distingue un paiement en ligne jamais abouti d une attente de virement', () => {
    expect(
      paymentBadge({ payment_status: 'pending', payment_method: 'en_ligne', stripe_payment_intent_id: null })
    ).toEqual({ label: 'Paiement en ligne à finaliser', tone: 'danger' });
    expect(
      paymentBadge({ payment_status: 'pending', payment_method: 'virement', stripe_payment_intent_id: null })
    ).toEqual({ label: 'En attente', tone: 'warning' });
  });

  it('paymentBadge rend son libellé normal dès que le règlement est arrivé', () => {
    expect(
      paymentBadge({ payment_status: 'paid', payment_method: 'en_ligne', stripe_payment_intent_id: 'pi_1' })
    ).toEqual({ label: 'Réglé', tone: 'success' });
  });
});

describe('montants saisis', () => {
  it('inputToCents accepte virgule, point, espaces et symbole euro', () => {
    expect(inputToCents('165')).toBe(16500);
    expect(inputToCents('165,50')).toBe(16550);
    expect(inputToCents('165.5')).toBe(16550);
    expect(inputToCents(' 1 370 € ')).toBe(137000);
  });

  it('inputToCents refuse le vide, le négatif et le texte', () => {
    expect(inputToCents('')).toBeNull();
    expect(inputToCents('-5')).toBeNull();
    expect(inputToCents('abc')).toBeNull();
    expect(inputToCents('12,345')).toBeNull();
  });

  it('centsToInput fait l aller-retour avec inputToCents', () => {
    expect(centsToInput(16500)).toBe('165');
    expect(centsToInput(16550)).toBe('165,50');
    expect(inputToCents(centsToInput(16550))).toBe(16550);
  });
});

describe('buildSummary', () => {
  it('compte par statut et exclut les dossiers refusés des montants', () => {
    const m1 = makeMember();
    const m2 = makeMember({ section: 'marche_nordique' });
    const m3 = makeMember();
    const dossiers = joinDossiers(
      [m1, m2, m3],
      [
        makeSeason(m1.id, { amount_due_cents: 16500, amount_paid_cents: 16500, payment_status: 'paid', status: 'validated' }),
        makeSeason(m2.id, {
          section: 'marche_nordique',
          license_type: 'sante',
          amount_due_cents: 15000,
          family_discount_cents: 1000,
        }),
        makeSeason(m3.id, { amount_due_cents: 18000, status: 'rejected' }),
      ]
    );
    const summary = buildSummary(dossiers);
    expect(summary.total).toBe(3);
    expect(summary.submitted).toBe(1);
    expect(summary.validated).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.dueCents).toBe(31500);
    expect(summary.paidCents).toBe(16500);
    expect(summary.familyDiscountCount).toBe(1);
    expect(summary.onlineAwaiting).toBe(0);
    expect(summary.bySection.marche_nordique).toEqual({ count: 1, dueCents: 15000, paidCents: 0 });
    expect(summary.bySection.running_trail).toEqual({ count: 1, dueCents: 16500, paidCents: 16500 });
  });

  it('compte les paiements en ligne jamais aboutis, hors dossiers refusés', () => {
    const m1 = makeMember();
    const m2 = makeMember();
    const m3 = makeMember();
    const dossiers = joinDossiers(
      [m1, m2, m3],
      [
        makeSeason(m1.id, { payment_method: 'en_ligne' }),
        makeSeason(m2.id, { payment_method: 'en_ligne', status: 'rejected' }),
        makeSeason(m3.id, {
          payment_method: 'en_ligne',
          payment_status: 'paid',
          amount_paid_cents: 16500,
          stripe_payment_intent_id: 'pi_ok',
        }),
      ]
    );
    expect(buildSummary(dossiers).onlineAwaiting).toBe(1);
  });
});

describe('tshirtOrders', () => {
  it('agrège par modèle et taille, hors refusés et hors maillot non renseigné', () => {
    const members = [makeMember(), makeMember(), makeMember(), makeMember(), makeMember()];
    const seasons = [
      makeSeason(members[0].id, { tshirt_model: 'homme', tshirt_size: 'M' }),
      makeSeason(members[1].id, { tshirt_model: 'homme', tshirt_size: 'M' }),
      makeSeason(members[2].id, { tshirt_model: 'femme', tshirt_size: 'S' }),
      makeSeason(members[3].id, { tshirt_model: 'homme', tshirt_size: 'S', status: 'rejected' }),
      makeSeason(members[4].id, { tshirt_model: null, tshirt_size: null }),
    ];
    expect(tshirtOrders(joinDossiers(members, seasons))).toEqual([
      { model: 'femme', size: 'S', count: 1 },
      { model: 'homme', size: 'M', count: 2 },
    ]);
  });

  it('classe les tailles dans l ordre du catalogue, anciennes tailles numériques en dernier', () => {
    const members = [makeMember(), makeMember(), makeMember()];
    const seasons = [
      makeSeason(members[0].id, { tshirt_model: 'femme', tshirt_size: '38' }),
      makeSeason(members[1].id, { tshirt_model: 'femme', tshirt_size: 'XL' }),
      makeSeason(members[2].id, { tshirt_model: 'femme', tshirt_size: 'S' }),
    ];
    expect(tshirtOrders(joinDossiers(members, seasons)).map(l => l.size)).toEqual(['S', 'XL', '38']);
  });
});
