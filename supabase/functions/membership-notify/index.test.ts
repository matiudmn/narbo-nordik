// Tests unitaires des fonctions pures de membership-notify (lib.ts).
// Volontairement séparés d'index.ts : ce dernier appelle serve() au chargement
// du module (comme toutes les fonctions Edge du dépôt), ce qui démarrerait un
// serveur HTTP si on l'importait ici.
//
// Lancer : deno test --no-check supabase/functions/membership-notify/index.test.ts
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  activityLabel,
  boardEmailSubject,
  buildBoardEmailHtml,
  buildMemberEmailHtml,
  CLUB_BANK,
  escapeHtml,
  formatDateFr,
  formatDateTimeFr,
  formatEuros,
  licenseLabel,
  type MemberRecord,
  type MembershipSeasonRecord,
  membershipTypeLabel,
  paymentMethodLabel,
  sectionLabel,
  sexLabel,
  sourceLabel,
  stripNewlines,
  transferReference,
} from './lib.ts';

// ---- formatEuros -----------------------------------------------------------

Deno.test('formatEuros: formate un montant rond', () => {
  assertEquals(formatEuros(18000), '180,00 €');
});

Deno.test('formatEuros: formate un montant avec centimes', () => {
  assertEquals(formatEuros(12550), '125,50 €');
});

Deno.test('formatEuros: gere zero', () => {
  assertEquals(formatEuros(0), '0,00 €');
});

Deno.test('formatEuros: separateur de milliers', () => {
  assertEquals(formatEuros(123456), '1 234,56 €');
});

Deno.test('formatEuros: valeur non finie retombe sur 0', () => {
  assertEquals(formatEuros(Number.NaN), '0,00 €');
});

// ---- libelles ---------------------------------------------------------------

Deno.test('sectionLabel: mappe les deux sections connues', () => {
  assertEquals(sectionLabel('marche_nordique'), 'Marche nordique');
  assertEquals(sectionLabel('running_trail'), 'Running / Trail');
});

Deno.test('licenseLabel: mappe sante/competition/running, null sinon', () => {
  assertEquals(licenseLabel('sante'), 'Santé');
  assertEquals(licenseLabel('competition'), 'Compétition');
  assertEquals(licenseLabel('running'), 'Athlé Running');
  assertEquals(licenseLabel(null), null);
  assertEquals(licenseLabel(undefined), null);
  assertEquals(licenseLabel('autre'), null);
});

Deno.test('paymentMethodLabel: mappe les 4 modes, defaut sinon', () => {
  assertEquals(paymentMethodLabel('virement'), 'Virement');
  assertEquals(paymentMethodLabel('cheque'), 'Chèque');
  assertEquals(paymentMethodLabel('especes'), 'Espèces');
  assertEquals(paymentMethodLabel('en_ligne'), 'En ligne');
  assertEquals(paymentMethodLabel(null), 'Non précisé');
});

Deno.test('membershipTypeLabel: mappe les 3 types', () => {
  assertEquals(membershipTypeLabel('nouveau'), 'Nouvelle adhésion');
  assertEquals(membershipTypeLabel('renouvellement'), 'Renouvellement');
  assertEquals(
    membershipTypeLabel('renouvellement_ffa_direct'),
    'Renouvellement licence FFA directe (cotisation club uniquement)'
  );
});

Deno.test('activityLabel et sourceLabel et sexLabel', () => {
  assertEquals(activityLabel('trail'), 'Trail');
  assertEquals(sourceLabel('web_form'), 'Formulaire du site');
  assertEquals(sexLabel('F'), 'Femme');
  assertEquals(sexLabel('M'), 'Homme');
});

// ---- dates -------------------------------------------------------------------

Deno.test('formatDateFr: formate une date ISO courte', () => {
  assertEquals(formatDateFr('1990-05-03'), '03 mai 1990');
});

Deno.test('formatDateFr: valeur absente', () => {
  assertEquals(formatDateFr(null), 'non renseignée');
  assertEquals(formatDateFr(''), 'non renseignée');
});

Deno.test('formatDateTimeFr: formate un timestamp avec heure', () => {
  const result = formatDateTimeFr('2026-08-17T14:05:00.000Z');
  assertStringIncludes(result, '2026');
  assertStringIncludes(result, ' à ');
});

// ---- escapeHtml / stripNewlines ----------------------------------------------

Deno.test('escapeHtml: echappe les 5 caracteres sensibles', () => {
  assertEquals(escapeHtml(`<script>&"'</script>`), '&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;');
});

Deno.test('escapeHtml: gere null/undefined', () => {
  assertEquals(escapeHtml(null), '');
  assertEquals(escapeHtml(undefined), '');
});

Deno.test('stripNewlines: retire les retours a la ligne', () => {
  assertEquals(stripNewlines('Jean\nDupont\r\n'), 'Jean Dupont');
});

// ---- construction HTML : pas d'injection --------------------------------------

const baseMember: MemberRecord = {
  firstname: '<script>alert(1)</script>',
  lastname: "O'Brien",
  birth_date: '1990-05-03',
  sex: 'F',
  nationality: 'Française',
  address_street: '12 rue des Sports',
  address_postal_code: '11100',
  address_city: 'Narbonne',
  email: 'test@example.com',
  phone: '0600000000',
  section: 'running_trail',
  family_group: null,
  notes: '<img src=x onerror=alert(1)>',
  source: 'web_form',
};

const baseSeason: MembershipSeasonRecord = {
  season: '2026-2027',
  section: 'running_trail',
  license_type: null,
  activities: ['trail', 'renforcement_musculaire'],
  tshirt_model: 'femme',
  tshirt_size: '38',
  tshirt_included: true,
  membership_type: 'nouveau',
  amount_due_cents: 18000,
  family_discount_cents: 0,
  payment_method: 'virement',
  rules_accepted_at: '2026-08-17T10:00:00.000Z',
  gdpr_consent_at: '2026-08-17T10:00:00.000Z',
  ce_certificate_requested: false,
};

Deno.test('buildMemberEmailHtml: echappe le prenom et le contenu injecte', () => {
  const html = buildMemberEmailHtml(baseMember, baseSeason);
  assert(!html.includes('<script>alert(1)</script>'));
  assertStringIncludes(html, '&lt;script&gt;alert(1)&lt;/script&gt;');
  assertStringIncludes(html, '180,00 €');
  assertStringIncludes(html, 'Ta demande d\'adhésion est bien reçue');
});

Deno.test('buildMemberEmailHtml: pas de ligne reduction famille si 0', () => {
  const html = buildMemberEmailHtml(baseMember, baseSeason);
  assert(!html.includes('réduction famille'));
});

Deno.test('buildMemberEmailHtml: ligne reduction famille si > 0', () => {
  const season = { ...baseSeason, amount_due_cents: 17000, family_discount_cents: 1000 };
  const html = buildMemberEmailHtml(baseMember, season);
  assertStringIncludes(html, 'réduction famille');
  assertStringIncludes(html, '10,00 €');
});

Deno.test('buildBoardEmailHtml: echappe le nom et ne contient jamais le contenu brut des notes', () => {
  const html = buildBoardEmailHtml(baseMember, baseSeason);
  assert(!html.includes('<img src=x onerror=alert(1)>'));
  assert(!html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assertStringIncludes(html, '&#39;Brien');
  assertStringIncludes(html, 'À faire : valider le dossier et confirmer le règlement.');
});

Deno.test('buildBoardEmailHtml: notes non vides -> ligne de renvoi sans le texte des notes', () => {
  const member = { ...baseMember, notes: 'Allergie sévère aux arachides, ne pas divulguer' };
  const html = buildBoardEmailHtml(member, baseSeason);
  assert(!html.includes('Allergie sévère aux arachides'));
  assertStringIncludes(html, 'Notes');
  assertStringIncludes(html, "Consultables dans l'espace bureau");
});

Deno.test('buildBoardEmailHtml: notes vides -> aucune ligne Notes', () => {
  const member = { ...baseMember, notes: null };
  const html = buildBoardEmailHtml(member, baseSeason);
  assert(!html.includes("Consultables dans l'espace bureau"));
});

Deno.test('buildBoardEmailHtml: licence non applicable quand license_type est null', () => {
  const html = buildBoardEmailHtml(baseMember, baseSeason);
  assertStringIncludes(html, 'Non applicable');
});

// Depuis la saison 2026/2027, la section running/trail a aussi un choix de
// licence : la ligne Licence n'est plus réservée à la marche nordique.
Deno.test('buildMemberEmailHtml: licence running affichee pour la section running/trail', () => {
  const html = buildMemberEmailHtml(baseMember, { ...baseSeason, license_type: 'running' });
  assertStringIncludes(html, '>Licence<');
  assertStringIncludes(html, 'Athlé Running');
});

Deno.test('buildMemberEmailHtml: aucune ligne Licence quand license_type est null', () => {
  const html = buildMemberEmailHtml(baseMember, baseSeason);
  assert(!html.includes('>Licence<'));
});

Deno.test('buildBoardEmailHtml: licence running libellee', () => {
  const html = buildBoardEmailHtml(baseMember, { ...baseSeason, license_type: 'running' });
  assertStringIncludes(html, 'Athlé Running');
});

Deno.test('buildBoardEmailHtml: licence inconnue rendue brute, jamais Non applicable', () => {
  const html = buildBoardEmailHtml(baseMember, { ...baseSeason, license_type: 'inconnue' });
  assertStringIncludes(html, 'inconnue');
  assert(!html.includes('Non applicable'));
});

Deno.test('boardEmailSubject: compose prenom + NOM en majuscules + section, sans saut de ligne', () => {
  const member = { ...baseMember, firstname: 'Jean\n', lastname: 'dupont\r\n' };
  const subject = boardEmailSubject(member, baseSeason);
  assertEquals(subject, "Nouvelle demande d'adhésion : Jean DUPONT (Running / Trail)");
});

// ---- Bloc RIB (virement uniquement) ------------------------------------------

Deno.test('buildMemberEmailHtml: virement => bloc RIB avec IBAN, BIC, montant et libelle', () => {
  const html = buildMemberEmailHtml(baseMember, { ...baseSeason, payment_method: 'virement' });
  assertStringIncludes(html, CLUB_BANK.iban);
  assertStringIncludes(html, CLUB_BANK.bic);
  assertStringIncludes(html, CLUB_BANK.holder);
  assertStringIncludes(html, formatEuros(baseSeason.amount_due_cents));
  assertStringIncludes(html, escapeHtml(transferReference(baseMember, baseSeason)));
  assertStringIncludes(html, 'valide ton dossier dès réception de ton virement');
});

Deno.test('buildMemberEmailHtml: cheque ou especes => aucun RIB', () => {
  for (const method of ['cheque', 'especes', null] as const) {
    const html = buildMemberEmailHtml(baseMember, { ...baseSeason, payment_method: method });
    assert(!html.includes(CLUB_BANK.iban), `IBAN ne doit pas apparaitre pour ${method}`);
    assert(!html.includes(CLUB_BANK.bic));
    assertStringIncludes(html, 'remise du chèque ou des espèces');
  }
});

Deno.test('buildBoardEmailHtml: jamais de RIB dans le mail bureau', () => {
  const html = buildBoardEmailHtml(baseMember, { ...baseSeason, payment_method: 'virement' });
  assert(!html.includes(CLUB_BANK.iban));
});

Deno.test('transferReference: majuscules, saison, nom et prenom, contenu echappe dans le HTML', () => {
  const ref = transferReference({ ...baseMember, firstname: 'Léa', lastname: 'Dupont' }, baseSeason);
  assertEquals(ref, `ADHESION ${baseSeason.season} DUPONT LÉA`);
  const html = buildMemberEmailHtml(baseMember, { ...baseSeason, payment_method: 'virement' });
  assert(!html.includes('<script>'), 'le libelle avec prenom piege doit etre echappe');
});
