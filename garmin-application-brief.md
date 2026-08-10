# Garmin Connect Developer Program — Application Brief

> **ABANDONNÉ le 10/08/2026 (décision Matthieu)** : candidature non déposée, document conservé pour archive.

> **Purpose** : ready-to-paste content for the Garmin Connect Developer Program application form.
> **Form URL** : https://www.garmin.com/en-US/forms/developercontactus/
> **Fallback email** : connect-support@developer.garmin.com
> **Expected timeline** : confirmation within 2 business days, technical integration 1-4 weeks after approval.

---

## ⚠️ Pre-flight checklist — TO DO before submission

> **À FAIRE avant d'envoyer le formulaire** :
>
> - [x] **Rédiger et publier la politique de confidentialité** à l'URL `https://app.narbo-nordik.fr/legal/privacy`. Garmin va explicitement la demander. Document : `legal/privacy-policy.md` (v1.0). Route publique en place (`/legal/privacy`, sans authentification) : l'URL répond dès le déploiement en production.
> - [ ] **Préparer 3-4 screenshots de l'app** (Home avec séances, SessionDetail, Profil avec section "Mes appareils" actuelle, fiche athlète avec données Strava). Format PNG, 1080×1920 ou similaire.
> - [ ] **Préparer un mockup** de l'intégration Garmin envisagée (carte "Garmin Connect" dans le panneau Mes appareils). Peut être fait dans Figma ou simple Canva — l'idée est de montrer la maquette UX.
> - [ ] **(Optionnel mais recommandé)** Lettre de soutien du président du club Régis Champrose, sur papier à en-tête de l'association, attestant que l'app est développée pour les besoins du club. Une page max.
> - [ ] **Vérifier auprès du club** que le partage du nom officiel "S/l Narbo Nordik Club" + code FFA 011032 est OK.

---

## Form fields — ready to paste

### 1. Contact information

| Field | Value |
|---|---|
| First name | Matthieu |
| Last name | Daumain |
| Email | matthieu@daumain.fr |
| Phone | _(à compléter si demandé)_ |
| Country | France |
| Job title | Lead developer & technical project owner |

### 2. Company / organization

| Field | Value |
|---|---|
| Company name | S/l Narbo Nordik Club |
| Type of organization | Sports club — non-profit association (French association loi 1901) |
| Industry | Sports & fitness — running club |
| Website (official club) | https://narbonordikclub.wixsite.com/narbo-nordik-club |
| Application website | https://app.narbo-nordik.fr |
| Country of operation | France |
| Headquarters | 21 Rue Paul Philoctete, 11100 Narbonne, France |
| Federation accreditation | Fédération Française d'Athlétisme (FFA) — official club code 011032 |
| Quality labels | "Club Running" Silver label (FFA), "Club Forme/Santé" Gold label (FFA) |
| Total licensed members | 144 athletes (65 men, 79 women) |
| Target user population for the app | ~50 licensed runners (running, trail, cross-country) |

### 3. Application name & summary

**Application name** :
> Narbo Nordik

**Short description (one-line, 140 char max)** :
> Training management platform for licensed runners of S/l Narbo Nordik Club: coach-programmed sessions, validation, performance tracking.

**Application type** :
> Progressive Web App (PWA), built with React 19 + TypeScript, hosted on Vercel, backend on Supabase. Mobile-first, installable on iOS and Android.

### 4. Project description (long form)

> Narbo Nordik is a private, club-internal training management application developed for S/l Narbo Nordik Club, a French Athletics Federation (FFA) accredited running club based in Narbonne, France. The club holds FFA quality labels "Club Running" (Silver) and "Club Forme/Santé" (Gold), and counts 144 licensed members across running, trail, cross-country, and Nordic walking disciplines.
>
> The application is restricted to licensed members of the club. It is operated by Matthieu Daumain, lead developer and technical project owner, in coordination with the club's federally-certified coaching staff. The app is **not** distributed to the general public or sold as a SaaS product — it is exclusively a club operational tool.
>
> **Core features today** :
> - Coach-side weekly session programming (workout structure with intervals, target paces, VMA percentages).
> - Athlete-side session consultation, validation with self-reported feedback (RPE, sensations, objective reached).
> - Personal records (palmares) tracking for race results.
> - VMA (Maximum Aerobic Velocity) historical tracking — a key metric in French running pedagogy.
> - Native Strava integration already in production: OAuth, activity sync, automatic session ↔ activity matching, heart rate zone retrieval.
>
> **Why Garmin Connect integration is needed** :
> Approximately half of the club's athletes use Garmin watches without synchronizing to Strava. For this population, no objective training data currently reaches the app, which prevents:
> 1. Automatic matching of completed workouts to coach-prescribed sessions.
> 2. Display of accurate metrics (distance, pace, heart rate, elevation, VO2max estimate, training load) to athletes and coach.
> 3. Generation of qualitative post-session feedback combining coach plan, watch data, and athlete self-report.
>
> Garmin Connect Developer Program access would allow us to offer the same level of service to Garmin users as to Strava users, ensuring an equitable experience for all licensed members regardless of their device choice.

### 5. Requested APIs

| API | Required | Use case |
|---|---|---|
| **Health API** | Yes | Read VO2max estimate, resting heart rate (optional), training load, recovery time per athlete user. |
| **Activity API** | Yes | Read running/trail activity summaries and details (distance, duration, pace, heart rate, elevation, splits/laps) post-workout. |
| **Push Service** (webhook) | Yes | Receive activity push notifications in near-real-time after watch sync, enabling immediate validation prompts to athletes. |
| Wellness API | No | Not in scope. |
| Women's Health | No | Not in scope. |
| Training API | No | Not in V1 scope. May be requested later for sending coach-programmed workouts back to athlete devices. |
| Courses API | No | Not in scope. |

### 6. Expected volume

| Metric | Estimate |
|---|---|
| Authorized users (athletes) | ~25-30 in year 1 (subset of 50 running members likely to opt-in) |
| Growth rate | +5 to +10 athletes per year |
| Activities synced per month | ~600 (30 athletes × 4-5 sessions/week × 4 weeks) |
| Peak activity periods | Tuesdays and Thursdays evening (club sessions), Saturday morning (long runs) |
| API calls estimate per month | ~3,000 (OAuth refresh + activity sync + activity detail fetches + webhook callbacks) |

### 7. Authentication & user consent

| Topic | Implementation |
|---|---|
| OAuth flow | OAuth 1.0a as per Garmin specification, implemented in Supabase Edge Functions (Deno runtime). |
| Token storage | Access token + access token secret stored encrypted at rest in Postgres (Supabase Vault column-level encryption). |
| User authentication | Supabase Auth with email/password + OTP recovery. |
| Consent flow | Athletes explicitly opt-in from their profile page by clicking "Connect Garmin Connect" → standard Garmin OAuth authorization screen → return to app. They can revoke access at any time from the same profile page (which calls Garmin's revoke endpoint). |
| Scope | Read-only. No write operations to Garmin accounts. |

### 8. Data handling & privacy

| Topic | Implementation |
|---|---|
| Data scope | Running activities only (sport types: Run, Trail Run, Treadmill Run). No sleep, no stress, no body battery, no menstrual cycle, no body composition. |
| Personal data stored | Activity summaries (date, distance, duration, pace, heart rate avg/max, elevation, VO2max estimate, training load), encrypted OAuth tokens, athlete identifier mapping. |
| Retention | While the athlete is a licensed club member + 12 months after license expiry. |
| Right to erasure | Account deletion in the app triggers full purge of OAuth tokens, cached activities, and user profile (cascade delete in Postgres). |
| Privacy policy URL | https://app.narbo-nordik.fr/legal/privacy _(public route, no authentication required)_ |
| Regulatory compliance | RGPD (EU General Data Protection Regulation). CNIL declaration in progress. |
| Data residency | Supabase EU region (Frankfurt, Germany). |

### 9. Existing integrations & technical maturity

> The app is already in production with a fully working Strava integration: OAuth 2.0 flow, encrypted token storage, scheduled and webhook-driven activity sync, server-side matching of activities to coach-programmed sessions, RLS-secured Postgres tables (`strava_connections`, `strava_activities`). This proves our ability to handle device API integrations responsibly.
>
> Architecture is being refactored to a multi-provider abstraction (`device_connections` / `device_activities` generic tables with a `ProviderAdapter` interface in Edge Functions) so that adding Garmin alongside Strava is a clean integration rather than a new ad-hoc pipeline.

### 10. Timeline

| Milestone | Target date |
|---|---|
| Application submitted | 2026-05-23 (or shortly after) |
| Expected confirmation from Garmin | 2026-05-27 (within 2 business days) |
| Approval received | Targeting Q3 2026 |
| OAuth keys provisioning | + 1 week after approval |
| Production rollout | + 2 weeks after key reception |
| Public availability to club athletes | September 2026 (start of club sports season, ideal timing) |

### 11. Why this matters to athletes (impact statement)

> French running clubs operate under a coach-athlete pedagogical model rooted in VMA-based training. Each weekly session is programmed by the coach with specific target paces (% of VMA), interval structures, and physiological intent (aerobic, lactate threshold, VO2max work). Without watch data, the loop "did the athlete actually train as prescribed?" cannot be closed — neither the coach nor the athlete can assess execution quality, and progress tracking degrades to subjective self-report.
>
> For our Strava-connected athletes, this loop is already closed. For our Garmin-using athletes (a substantial portion of the club, given Garmin's strong presence in the French trail running community), it is not. Garmin Connect Developer Program access would close this gap, allowing the club to deliver an equitable, data-informed training experience to all its licensed members — directly aligned with the FFA quality labels we hold.

---

## Optional: cover letter / accompanying email

If you prefer to email `connect-support@developer.garmin.com` instead of (or in addition to) the form, here is a short cover email:

---

**Subject** : Garmin Connect Developer Program application — S/l Narbo Nordik Club (FFA club 011032)

Dear Garmin Developer Program Team,

I am writing on behalf of S/l Narbo Nordik Club, a French Athletics Federation (FFA) accredited running club based in Narbonne, France (FFA club code 011032), holding the FFA "Club Running" Silver label and "Club Forme/Santé" Gold label.

The club has commissioned the development of an internal training management application, used exclusively by its licensed members (currently 144 athletes, of which approximately 50 are runners). The application is a Progressive Web App with existing Strava integration in production.

Approximately half of our running athletes use Garmin watches without synchronizing to Strava. For these athletes, no objective training data currently reaches the club's coaching tools. We would like to integrate Garmin Connect natively to close this gap.

We are requesting access to:
- Health API (VO2max, training load, recovery)
- Activity API (running activity summaries and details)
- Push Service (real-time activity webhooks)

I have prepared a detailed application brief covering technical architecture, data handling, RGPD compliance, expected volumes, and timeline. I will be submitting this via the developer contact form at https://www.garmin.com/en-US/forms/developercontactus/ but am also available to share the document directly should you prefer.

Looking forward to your response.

Best regards,

Matthieu Daumain
Lead developer & technical project owner
Narbo Nordik
matthieu@daumain.fr
On behalf of S/l Narbo Nordik Club (FFA 011032)
https://app.narbo-nordik.fr

---

## Submission process recommended

1. **Complete the pre-flight checklist above** (especially the privacy policy — Garmin will ask).
2. **Visit the form** : https://www.garmin.com/en-US/forms/developercontactus/
3. **Paste sections 1-11 above** into the corresponding form fields. The form may not have separate fields for every section — combine sections 4, 5, 6, 11 into the "project description" / "use case" field if needed.
4. **Attach screenshots + mockup + (optional) letter of support** if file upload fields are available.
5. **If the form does not allow attachments**, send the cover email above to `connect-support@developer.garmin.com` immediately after form submission, with the attachments attached.
6. **Follow up after 3 business days** if no acknowledgement received.

## After submission

- Expect confirmation of receipt within 2 business days.
- Approval timeline is typically 4-8 weeks for non-large-enterprise applicants.
- Once approved, Garmin will provide:
  - Consumer Key (OAuth 1.0a)
  - Consumer Secret (OAuth 1.0a)
  - Push Service callback URL configuration
  - Sandbox environment access for testing
- These secrets will then need to be added to Supabase as `GARMIN_CONSUMER_KEY` and `GARMIN_CONSUMER_SECRET`.

## Decision log

| Date | Decision |
|---|---|
| 2026-05-23 | Positioned as FFA-accredited structured sports club (not as SaaS or agency-led project), to maximize fit with Garmin's "enterprise use" criterion |
| 2026-05-23 | Requested APIs: Health + Activity + Push (no Training API in V1, may be added later) |
| 2026-05-23 | Privacy policy identified as a missing artifact — to be drafted and published before OAuth key activation |
