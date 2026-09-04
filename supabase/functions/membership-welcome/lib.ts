// Fonctions pures de membership-welcome (construction de l'e-mail) : séparées
// d'index.ts pour être testables sans démarrer de serveur HTTP, comme dans
// membership-notify. Aucun appel réseau ni accès Deno.env ici.
//
// Les quelques helpers d'échappement et de mise en page sont volontairement
// recopiés plutôt qu'importés de ../membership-notify/lib.ts : chaque fonction
// Edge se déploie séparément et à la main, un import croisé ferait qu'un
// correctif dans l'une exigerait de redéployer l'autre sans que rien ne le
// rappelle.

export interface WelcomeMemberRecord {
  firstname: string;
  email: string;
}

export interface WelcomeSeasonRecord {
  season: string;
  section: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export function welcomeEmailSubject(): string {
  return 'Ton adhésion est validée : rejoins l\'appli du club';
}

/**
 * E-mail envoyé à l'adhérent running/trail dont le dossier vient d'être validé
 * par le bureau. Un seul objectif : qu'il crée son compte dans l'app. Le code
 * d'invitation est passé en paramètre, jamais écrit en dur : il vit dans
 * `club_settings.invite_code` et change quand le club le décide.
 */
export function buildWelcomeEmailHtml(
  member: WelcomeMemberRecord,
  season: WelcomeSeasonRecord,
  inviteCode: string,
  appUrl: string,
): string {
  const firstname = escapeHtml(member.firstname);
  const code = escapeHtml(inviteCode);
  const url = escapeHtml(appUrl);
  const installUrl = `${appUrl.replace(/\/+$/, '')}/installer`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#1a1a2e;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#6CCBE6;font-size:20px;">Narbo Nordik</h1>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Adhésion ${escapeHtml(season.season)} validée</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Salut ${firstname},</p>
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Ton adhésion est validée, bienvenue !</h2>
      <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
        Le bureau a validé ton dossier : ton règlement est bien arrivé et ta licence suit son cours.
      </p>
      <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
        Il te reste une chose à faire : créer ton compte sur l'appli du club. C'est là que tu retrouves
        le programme des séances, que tu valides tes entraînements, et que tu suis tes progrès et le
        palmarès du club.
      </p>

      <div style="margin:0 0 20px;padding:16px;background:#f5f1ea;border-radius:12px;">
        <p style="margin:0 0 10px;color:#111827;font-size:14px;font-weight:600;">Ton code d'invitation</p>
        <p style="margin:0 0 12px;color:#111827;font-size:24px;font-weight:700;letter-spacing:2px;font-family:monospace;">${code}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
          Il t'est demandé une seule fois, à la création du compte. Utilise bien
          <strong>la même adresse e-mail que sur ta demande d'adhésion</strong> : c'est ce qui permet au
          club de relier ton compte à ton dossier.
        </p>
      </div>

      <p style="margin:0 0 20px;text-align:center;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;background:#6CCBE6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Créer mon compte</a>
      </p>

      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.5;">
        Tu as déjà un compte ? Rien à faire, tout est en ordre.
        Pour installer l'appli sur ton téléphone et la retrouver comme n'importe quelle autre,
        suis le guide : <a href="${escapeHtml(installUrl)}" style="color:#0d7490;">${escapeHtml(installUrl)}</a>
      </p>

      <p style="margin:0;color:#374151;font-size:14px;">À très vite sur les sentiers,<br>L'équipe du Narbo Nordik Club</p>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Narbo Nordik Club, Narbonne</p>
    </div>
  </div>
</body>
</html>`;
}
