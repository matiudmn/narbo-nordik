export type Role = 'athlete' | 'coach';
export type SessionStatus = 'pending' | 'done' | 'missed';
export type RaceType = 'route' | 'trail' | 'piste';
export type AllureZone = 'ef' | 'endurance' | 'as42' | 'as21' | 'vma';
export type BlockType = 'echauffement' | 'travail' | 'retour_au_calme';
export type SessionType = 'entrainement' | 'sortie_longue' | 'recuperation';
export type TerrainOption = 'cotes' | 'piste';

export interface SessionBlock {
  id: string;
  type: BlockType;
  allure: AllureZone;
  duration_seconds: number;
  distance_meters: number | null;
  repetitions: number;
  rest_seconds: number;
}

export interface VmaEntry {
  vma: number;
  date: string;
}

export interface User {
  id: string;
  role: Role;
  firstname: string;
  lastname: string;
  email: string;
  vma: number | null;
  vma_history: VmaEntry[];
  group_id: string | null;
  phone: string | null;
  strava_id: string | null;
  birth_date: string | null;
  license_number: string | null;
  photo_url: string | null;
  is_public: boolean;
  notification_preferences: NotificationPreferences;
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

export interface UserPreparation {
  id: string;
  user_id: string;
  preparation_id: string;
}

export interface SessionValidation {
  id: string;
  session_id: string;
  user_id: string;
  status: SessionStatus;
  feedback: string | null;
  created_at: string;
}

export interface RaceResult {
  id: string;
  user_id: string;
  race_name: string;
  race_type: RaceType;
  distance_km: number;
  date: string;
  time_duration: string;
  created_at: string;
}

export interface RaceNordik {
  id: string;
  race_id: string;
  user_id: string;
  created_at: string;
}

export interface SessionWithValidation extends Session {
  validation?: SessionValidation;
  group?: Group;
}

export type NotificationType = 'new_session' | 'palmares' | 'vma_update' | 'weekly_digest' | 'system';

export interface NotificationPreferences {
  new_session: { in_app: boolean; email: boolean };
  palmares: { in_app: boolean; email: boolean };
  vma_update: { in_app: boolean; email: boolean };
  weekly_digest: { email: boolean };
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
