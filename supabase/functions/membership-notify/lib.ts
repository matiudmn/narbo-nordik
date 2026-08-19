// Fonctions pures de membership-notify (formatage, libellés, construction des
// e-mails HTML) : séparées d'index.ts pour être testables sans démarrer de
// serveur HTTP (index.ts appelle serve() au chargement du module, comme les
// autres fonctions Edge du dépôt). Aucun appel réseau ni accès Deno.env ici.

export interface MemberRecord {
  firstname: string;
  lastname: string;
  birth_date: string;
  sex: string;
  nationality: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  email: string;
  phone: string | null;
  section: string;
  family_group: string | null;
  notes: string | null;
  source: string;
}

export interface MembershipSeasonRecord {
  season: string;
  section: string;
  license_type: string | null;
  activities: string[];
  tshirt_model: string | null;
  tshirt_size: string | null;
  tshirt_included: boolean;
  membership_type: string;
  amount_due_cents: number;
  family_discount_cents: number;
  payment_method: string | null;
  rules_accepted_at: string;
  gdpr_consent_at: string;
  ce_certificate_requested: boolean;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

// Coupe toute nouvelle ligne d'un champ libre (prénom, nom) avant de
// l'utiliser dans un objet d'e-mail : ce sont des données saisies via le
// formulaire public, sans contrainte de format en base.
export function stripNewlines(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

// Montant en centimes -> "125,00 €" (pas d'Intl : évite une dépendance aux
// données ICU du runtime, comme formatDate dans les autres fonctions Edge).
export function formatEuros(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safeCents < 0 ? '-' : '';
  const abs = Math.abs(safeCents);
  const euros = Math.floor(abs / 100);
  const centimes = String(abs % 100).padStart(2, '0');
  const euroStr = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${euroStr},${centimes} €`;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function formatDateFr(value: string | null | undefined): string {
  if (!value) return 'non renseignée';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (isNaN(d.getTime())) return 'non renseignée';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTimeFr(value: string | null | undefined): string {
  if (!value) return 'non renseigné';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'non renseigné';
  const date = `${String(d.getDate()).padStart(2, '0')} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} à ${time}`;
}

export function sectionLabel(section: string): string {
  if (section === 'marche_nordique') return 'Marche nordique';
  if (section === 'running_trail') return 'Running / Trail';
  return section;
}

export function licenseLabel(licenseType: string | null | undefined): string | null {
  if (licenseType === 'sante') return 'Santé';
  if (licenseType === 'competition') return 'Compétition';
  if (licenseType === 'running') return 'Athlé Running';
  return null;
}

export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case 'virement': return 'Virement';
    case 'cheque': return 'Chèque';
    case 'especes': return 'Espèces';
    case 'en_ligne': return 'En ligne';
    default: return 'Non précisé';
  }
}

export function membershipTypeLabel(type: string): string {
  switch (type) {
    case 'nouveau': return 'Nouvelle adhésion';
    case 'renouvellement': return 'Renouvellement';
    case 'renouvellement_ffa_direct': return 'Renouvellement licence FFA directe (cotisation club uniquement)';
    default: return type;
  }
}

export function activityLabel(activity: string): string {
  switch (activity) {
    case 'marche_nordique': return 'Marche nordique';
    case 'trail': return 'Trail';
    case 'renforcement_musculaire': return 'Renforcement musculaire';
    default: return activity;
  }
}

export function sourceLabel(source: string): string {
  switch (source) {
    case 'web_form': return 'Formulaire du site';
    case 'paper': return 'Fiche papier';
    case 'app': return 'Application';
    case 'import': return 'Import';
    default: return source;
  }
}

export function sexLabel(sex: string): string {
  if (sex === 'F') return 'Femme';
  if (sex === 'M') return 'Homme';
  return sex;
}

export function tshirtModelLabel(model: string | null | undefined): string {
  return model === 'femme' ? 'Femme' : 'Homme';
}

const SITE_URL = 'https://www.narbo-nordik-club.com';

// Coordonnées bancaires du club (RIB officiel Crédit Agricole, transmis par
// Matiu le 2026-08-17). Affichées uniquement à l'adhérent qui a choisi le
// virement, jamais dans l'e-mail bureau.
export const CLUB_BANK = {
  holder: 'ASSOC. NARBO NORDIK CLUB',
  iban: 'FR76 1350 6100 0085 2084 5744 175',
  bic: 'AGRIFRPP835',
} as const;

// Libellé de virement attendu, pour que le bureau rapproche facilement.
export function transferReference(member: MemberRecord, season: MembershipSeasonRecord): string {
  return `ADHESION ${season.season} ${member.lastname} ${member.firstname}`.toUpperCase();
}

export function buildBankTransferBlock(member: MemberRecord, season: MembershipSeasonRecord): string {
  const cell = 'padding:6px 10px;font-size:14px;color:#111827;';
  return `
    <div style="margin:0 0 16px;padding:14px 16px;background:#f5f1ea;border-radius:12px;">
      <p style="margin:0 0 8px;color:#111827;font-size:14px;font-weight:600;">Coordonnées bancaires pour ton virement</p>
      <table style="border-collapse:collapse;">
        <tr><td style="${cell}color:#6b7280;">Titulaire</td><td style="${cell}">${escapeHtml(CLUB_BANK.holder)}</td></tr>
        <tr><td style="${cell}color:#6b7280;">IBAN</td><td style="${cell}font-family:monospace;">${escapeHtml(CLUB_BANK.iban)}</td></tr>
        <tr><td style="${cell}color:#6b7280;">BIC</td><td style="${cell}font-family:monospace;">${escapeHtml(CLUB_BANK.bic)}</td></tr>
        <tr><td style="${cell}color:#6b7280;">Montant</td><td style="${cell}"><strong>${formatEuros(season.amount_due_cents)}</strong></td></tr>
        <tr><td style="${cell}color:#6b7280;">Libellé</td><td style="${cell}font-family:monospace;">${escapeHtml(transferReference(member, season))}</td></tr>
      </table>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Indique bien ce libellé pour que le bureau retrouve ton virement.</p>
    </div>`;
}

export function memberEmailSubject(): string {
  return "Ta demande d'adhésion au Narbo Nordik Club est bien reçue";
}

export function boardEmailSubject(member: MemberRecord, season: MembershipSeasonRecord): string {
  const firstname = stripNewlines(member.firstname);
  const lastname = stripNewlines(member.lastname).toUpperCase();
  return `Nouvelle demande d'adhésion : ${firstname} ${lastname} (${sectionLabel(season.section)})`;
}

function htmlShell(headerSubtitle: string, maxWidth: number, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:${maxWidth}px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#1a1a2e;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#6CCBE6;font-size:20px;">Narbo Nordik</h1>
      ${headerSubtitle ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${headerSubtitle}</p>` : ''}
    </div>
    <div style="padding:24px;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Narbo Nordik Club — Narbonne</p>
    </div>
  </div>
</body>
</html>`;
}

function tableRow(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;">${valueHtml}</td>
    </tr>`;
}

// E-mail à l'adhérent : récapitulatif de son dossier, tutoiement (ton du
// site). member.firstname/notes etc. sont échappés : donnée saisie par le
// public via le formulaire du site.
export function buildMemberEmailHtml(member: MemberRecord, season: MembershipSeasonRecord): string {
  const rows: string[] = [];
  rows.push(tableRow('Section', escapeHtml(sectionLabel(season.section))));

  // Depuis la saison 2026/2027, les deux sections ont un choix de licence
  // (MN : Santé / Compétition ; Running/Trail : Athlé Running / Compétition).
  const license = licenseLabel(season.license_type);
  if (license) rows.push(tableRow('Licence', escapeHtml(license)));

  rows.push(tableRow('Saison', escapeHtml(season.season)));

  if (season.tshirt_model && season.tshirt_size) {
    rows.push(tableRow('Tee-shirt', `${escapeHtml(tshirtModelLabel(season.tshirt_model))}, taille ${escapeHtml(season.tshirt_size)}`));
  }

  rows.push(tableRow('Montant dû', `<strong>${formatEuros(season.amount_due_cents)}</strong>`));
  if (season.family_discount_cents > 0) {
    rows.push(tableRow('dont réduction famille (déjà déduite)', formatEuros(season.family_discount_cents)));
  }

  rows.push(tableRow('Mode de règlement déclaré', escapeHtml(paymentMethodLabel(season.payment_method))));

  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:15px;">Salut ${escapeHtml(member.firstname)},</p>
    <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Ta demande d'adhésion est bien reçue</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">Voici le récapitulatif de ton dossier :</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${rows.join('')}</table>
    ${season.payment_method === 'virement' ? buildBankTransferBlock(member, season) : ''}
    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">${season.payment_method === 'virement' ? 'Le bureau valide ton dossier dès réception de ton virement.' : 'Le bureau valide ton dossier et te communique les modalités de règlement (remise du chèque ou des espèces à l\'entraînement).'}</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">Ton adhésion sera définitive une fois le règlement reçu.</p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">L'équipe du Narbo Nordik Club</p>
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:#6CCBE6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">narbo-nordik-club.com</a>`;

  return htmlShell('', 480, body);
}

// E-mail au bureau : dossier complet en tableau, ton sobre et neutre.
export function buildBoardEmailHtml(member: MemberRecord, season: MembershipSeasonRecord): string {
  const addressParts = [member.address_street, member.address_postal_code, member.address_city]
    .filter((part): part is string => !!part && part.trim().length > 0);
  const address = addressParts.length > 0 ? escapeHtml(addressParts.join(', ')) : 'Non renseignée';

  const rows: string[] = [
    tableRow('Nom', `${escapeHtml(member.firstname)} ${escapeHtml(member.lastname)}`),
    tableRow('Date de naissance', escapeHtml(formatDateFr(member.birth_date))),
    tableRow('Sexe', escapeHtml(sexLabel(member.sex))),
    tableRow('Nationalité', member.nationality ? escapeHtml(member.nationality) : 'Non renseignée'),
    tableRow('E-mail', escapeHtml(member.email)),
    tableRow('Téléphone', member.phone ? escapeHtml(member.phone) : 'Non renseigné'),
    tableRow('Adresse', address),
    tableRow('Section principale', escapeHtml(sectionLabel(member.section))),
    tableRow('Section souscrite (saison)', escapeHtml(sectionLabel(season.section))),
    tableRow('Licence', season.license_type ? escapeHtml(licenseLabel(season.license_type) ?? season.license_type) : 'Non applicable'),
    tableRow('Activités', season.activities.length > 0 ? escapeHtml(season.activities.map(activityLabel).join(', ')) : 'Aucune'),
    tableRow('Tee-shirt', season.tshirt_model && season.tshirt_size
      ? `${escapeHtml(tshirtModelLabel(season.tshirt_model))} — taille ${escapeHtml(season.tshirt_size)}`
      : 'Non renseigné'),
    tableRow('Tee-shirt offert cette saison', season.tshirt_included ? 'Oui' : 'Non'),
    tableRow("Type d'adhésion", escapeHtml(membershipTypeLabel(season.membership_type))),
    tableRow('Rattachement famille', member.family_group ? escapeHtml(member.family_group) : 'Aucun'),
    tableRow('Montant dû', `<strong>${formatEuros(season.amount_due_cents)}</strong>`),
    tableRow('Réduction famille appliquée', formatEuros(season.family_discount_cents)),
    tableRow('Mode de règlement déclaré', escapeHtml(paymentMethodLabel(season.payment_method))),
    tableRow('Attestation CE demandée', season.ce_certificate_requested ? 'Oui' : 'Non'),
    tableRow('Règlement intérieur accepté le', escapeHtml(formatDateTimeFr(season.rules_accepted_at))),
    tableRow('Consentement RGPD le', escapeHtml(formatDateTimeFr(season.gdpr_consent_at))),
    tableRow('Source du dossier', escapeHtml(sourceLabel(member.source))),
  ];

  if (member.notes) {
    rows.push(tableRow('Notes', "Consultables dans l'espace bureau"));
  }

  const body = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${rows.join('')}</table>
    <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">À faire : valider le dossier et confirmer le règlement.</p>`;

  return htmlShell("Nouvelle demande d'adhésion", 560, body);
}
