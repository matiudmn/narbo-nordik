export type Role = 'athlete' | 'coach';
export type SessionStatus = 'pending' | 'done' | 'missed';
export type RaceType = 'route' | 'trail' | 'piste';
export type AllureZone = 'aer' | 'ef' | 'sv1' | 'sv2' | 'as42' | 'as21' | 'as10' | 'as5' | 'vma' | 'pma';
export type BlockType = 'echauffement' | 'travail' | 'retour_au_calme' | 'recuperation';
export type SessionType = 'entrainement' | 'sortie_longue' | 'recuperation' | 'velo' | 'marche' | 'renfo' | 'course';
export type TerrainOption = 'cotes' | 'piste';

export type ObjectiveReached = 'oui' | 'non' | 'partiel';
export type Sensations = 'excellentes' | 'bonnes' | 'mauvaises';

export interface SessionBlock {
  id: string;
  type: BlockType;
  allure: AllureZone;
  duration_seconds: number;
  distance_meters: number | null;
  repetitions: number;
  rest_seconds: number;
  rest_distance_meters: number | null;
  // Cible d'effort, uniquement pour les zones a l'effort (PMA). Editable par le
  // coach (varie selon la periode de saison). Absent -> valeurs par defaut.
  rpe_min?: number | null;
  rpe_max?: number | null;
  fcmax_min?: number | null;
  fcmax_max?: number | null;
}

export interface VmaEntry {
  vma: number;
  date: string;
  reason?: string;
}

export interface User {
  id: string;
  role: Role;
  firstname: string;
  lastname: string;
  // PII (email, phone, birth_date, license_number, notification_preferences) :
  // optionnelles depuis la migration 20260731120000. Le GRANT colonne de
  // `authenticated` sur `public.users` ne les accorde plus qu'a soi-meme
  // (via get_own_profile) et aux coachs/super-admin (via get_users_for_coach).
  // Un athlete qui recoit la liste club (DataContext.fetchAll) ne les recoit
  // JAMAIS pour les autres, meme pas pour sa propre ligne dans cette liste
  // (le grant est par colonne, pas par ligne) : sa propre valeur reste
  // disponible via useAuth().user, jamais via useData().users.
  email?: string;
  vma: number | null;
  vma_history: VmaEntry[];
  group_id: string | null;
  phone?: string | null;
  birth_date?: string | null;
  license_number?: string | null;
  photo_url: string | null;
  is_public: boolean;
  // Optionnel : la colonne n'existe qu'apres la migration 20260731081000 ;
  // le front doit tolerer son absence (undefined => pas super-admin).
  is_super_admin?: boolean;
  // Membre du conseil d'administration (espace bureau /bureau). Optionnel :
  // la colonne n'existe qu'apres la migration 20260831180000, meme tolerance
  // que is_super_admin (undefined => pas membre du CA).
  is_board?: boolean;
  notification_preferences?: NotificationPreferences;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  date: string;
  title: string;
  session_type: SessionType;
  terrain_options: TerrainOption[];
  location: string | null;
  location_url: string | null;
  description: string | null;
  group_id: string | null;
  preparation_id: string | null;
  target_distance: number | null;
  vma_percent_min: number | null;
  vma_percent_max: number | null;
  blocks: SessionBlock[];
  is_personal: boolean;
  // RPE de seance (optionnel) : difficulte globale attendue, posee par le coach,
  // sensible au volume. Distincte de l'effort de zone (PMA) et du RPE ressenti.
  session_rpe?: number | null;
  created_by: string;
  created_at: string;
}

export interface SpecificPreparation {
  id: string;
  name: string;
  event_date: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export type TemplateCategory = 'vma' | 'seuil' | 'endurance' | 'sortie_longue' | 'recup' | 'autre';

export interface SessionTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  session_type: SessionType;
  terrain_options: TerrainOption[];
  blocks: SessionBlock[];
  is_seed: boolean;
  created_by: string | null;
  usage_count: number;
  created_at: string;
}

export interface UserPreparation {
  id: string;
  user_id: string;
  preparation_id: string;
}

export type MetricsSource = 'manual' | 'ocr' | 'watch';

export interface SessionValidation {
  id: string;
  session_id: string;
  user_id: string;
  status: SessionStatus;
  feedback: string | null;
  attachment_path: string | null;
  attachment_type: string | null;
  objective_reached: ObjectiveReached | null;
  sensations: Sensations | null;
  distance_m: number | null;
  duration_s: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null;
  metrics_source: MetricsSource | null;
  rpe: number | null;
  created_at: string;
}

export interface SessionMetricsInput {
  distance_m?: number | null;
  duration_s?: number | null;
  elevation_m?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  avg_cadence?: number | null;
  metrics_source?: MetricsSource | null;
  rpe?: number | null;
}

export interface RaceResult {
  id: string;
  user_id: string;
  race_name: string;
  race_type: RaceType;
  distance_km: number;
  date: string;
  time_duration: string;
  is_label: boolean;
  comment: string | null;
  created_at: string;
}

export interface RaceNordik {
  id: string;
  race_id: string;
  user_id: string;
  created_at: string;
}

export interface ValidationReaction {
  id: string;
  validation_id: string;
  author_id: string;
  emoji: string;
  created_at: string;
}

export interface SessionNordik {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
}

export interface SessionWithValidation extends Session {
  validation?: SessionValidation;
  group?: Group;
}

export type NotificationType = 'new_session' | 'palmares' | 'vma_update' | 'weekly_digest' | 'system' | 'reaction' | 'new_athlete' | 'vma_missing';

export interface NotificationPreferences {
  new_session: { in_app: boolean; email: boolean };
  palmares: { in_app: boolean; email: boolean };
  vma_update: { in_app: boolean; email: boolean };
  weekly_digest: { email: boolean };
  // Jamais d'e-mail pour les kudos (cf. skip list du trigger notify_email_on_insert).
  reaction?: { in_app: boolean };
  // Types coach (20260810140000) : clé absente = activé, les lignes existantes ne sont pas migrées.
  new_athlete?: { in_app?: boolean; email?: boolean };
  // Jamais d'e-mail pour le rappel VMA (même skip list que reaction).
  vma_missing?: { in_app?: boolean };
  // Préférence d'affichage, rangée ici faute de colonne de préférences générales ; undefined = pas encore demandé.
  attendance_tracking?: boolean;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface PaceCalculation {
  speedMin: number;
  speedMax: number;
  paceMin: string;
  paceMax: string;
  timeMinSeconds: number;
  timeMaxSeconds: number;
  timeMinDisplay: string;
  timeMaxDisplay: string;
}

export interface RacePaceConfig {
  label: string;
  pctByLevel: number[];
  color: string;
  description: string;
}

export interface AllureZoneConfig {
  label: string;
  pctMinByLevel: number[];
  pctMaxByLevel: number[];
  color: string;
}

export interface ClubSettings {
  id: string;
  race_paces: Record<string, RacePaceConfig>;
  allure_zones: Record<string, AllureZoneConfig>;
  featured_validation_id: string | null;
  featured_at: string | null;
  invite_code: string;
  updated_at: string;
  updated_by: string | null;
}

// --- Adhésions (espace bureau) ------------------------------------------------
// Miroir des tables members / membership_seasons (migrations 20260817120000 et
// 20260831180000). Un adhérent (Member) existe indépendamment d'un compte app
// (user_id nullable) : marche nordique, dossier papier, adhésion sans compte.

export type MemberSection = 'marche_nordique' | 'running_trail';
export type MemberSource = 'web_form' | 'paper' | 'app' | 'import';
export type LicenseType = 'sante' | 'competition' | 'running';
export type MembershipType = 'nouveau' | 'renouvellement' | 'renouvellement_ffa_direct';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'cancelled';
export type PaymentMethod = 'virement' | 'cheque' | 'especes' | 'en_ligne';
export type MembershipStatus = 'submitted' | 'validated' | 'rejected';
export type TshirtModel = 'homme' | 'femme';

export interface Member {
  id: string;
  user_id: string | null;
  firstname: string;
  lastname: string;
  birth_date: string;
  sex: 'M' | 'F';
  nationality: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  email: string;
  phone: string | null;
  section: MemberSection;
  family_group: string | null;
  notes: string | null;
  source: MemberSource;
  created_at: string;
  updated_at: string;
}

export interface MembershipSeason {
  id: string;
  member_id: string;
  season: string;
  section: MemberSection;
  license_type: LicenseType | null;
  activities: string[];
  tshirt_model: TshirtModel | null;
  tshirt_size: string | null;
  tshirt_included: boolean;
  membership_type: MembershipType;
  amount_due_cents: number;
  family_discount_cents: number;
  // Encaissé cumulé constaté par le bureau (peut dépasser le dû : trop-perçu réel).
  amount_paid_cents: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  rules_accepted_at: string;
  gdpr_consent_at: string;
  ce_certificate_requested: boolean;
  status: MembershipStatus;
  validated_by: string | null;
  validated_at: string | null;
  // Invitation à créer un compte sur l'app, envoyée à la validation d'un
  // dossier running/trail. NULL = jamais envoyée (migration 20260904070000).
  welcome_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}
