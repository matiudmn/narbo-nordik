/**
 * Frontiere de types : seul endroit du projet ou une ligne Supabase devient
 * un type applicatif (et inversement). Les colonnes texte avec contrainte
 * CHECK (role, session_type, status, race_type, ...) et les colonnes jsonb
 * (blocks, vma_history, notification_preferences, race_paces, allure_zones)
 * n'ont pas d'equivalent generable depuis `database.types.ts` : chaque mapper
 * de lecture commence par `...r` (spread) et n'enumere QUE les champs qui
 * divergent. Aucun mapper exhaustif (cf. risque 3 du lot data-layer-v2).
 */
import type {
  User, Role, VmaEntry, NotificationPreferences,
  Session, SessionType, TerrainOption, SessionBlock,
  SessionValidation, SessionStatus, ObjectiveReached, Sensations, MetricsSource,
  RaceResult, RaceType, RaceNordik, SessionNordik, ValidationReaction,
  SpecificPreparation, ClubSettings, RacePaceConfig, AllureZoneConfig,
  AppNotification, NotificationType,
} from '../../types';
import type { Tables, TablesInsert, TablesUpdate, Json } from '../../types/database.types';

export const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  new_session: { in_app: true, email: true },
  palmares: { in_app: true, email: true },
  vma_update: { in_app: true, email: false },
  weekly_digest: { email: true },
};

// Colonnes de `users` accordees a un athlete (role authenticated) depuis la
// migration 20260731120000 : email/phone/license_number/birth_date/
// notification_preferences n'en font plus partie (cf. ATHLETE_USER_COLUMNS).
// UserRowLike code cette meme frontiere cote types : les champs toujours
// presents (Pick) plus le reste de la table en optionnel (Partial), pour les
// deux autres sources qui renvoient la ligne complete (get_own_profile,
// get_users_for_coach).
export type UserRowLike =
  Pick<Tables<'users'>, 'id' | 'role' | 'firstname' | 'lastname' | 'vma' | 'vma_history' | 'group_id' | 'photo_url' | 'is_public' | 'created_at' | 'is_super_admin'>
  & Partial<Tables<'users'>>;

// --- Lecture : Row Supabase -> type applicatif ---

export function toUser(r: UserRowLike): User {
  return {
    ...r,
    role: r.role as Role,
    vma_history: (r.vma_history as unknown as VmaEntry[]) ?? [],
    is_public: r.is_public as boolean,
    created_at: r.created_at as string,
    notification_preferences: (r.notification_preferences as unknown as NotificationPreferences) ?? DEFAULT_NOTIF_PREFS,
  };
}

export function toSession(r: Tables<'sessions'>): Session {
  return {
    ...r,
    session_type: r.session_type as SessionType,
    terrain_options: r.terrain_options as unknown as TerrainOption[],
    blocks: (r.blocks || []) as unknown as SessionBlock[],
    is_personal: r.is_personal as boolean,
    created_at: r.created_at as string,
  };
}

export function toValidation(r: Tables<'session_validations'>): SessionValidation {
  return {
    ...r,
    status: r.status as SessionStatus,
    objective_reached: r.objective_reached as ObjectiveReached | null,
    sensations: r.sensations as Sensations | null,
    metrics_source: r.metrics_source as MetricsSource | null,
    created_at: r.created_at as string,
  };
}

export function toRaceResult(r: Tables<'race_results'>): RaceResult {
  return {
    ...r,
    race_type: r.race_type as RaceType,
    is_label: r.is_label as boolean,
    created_at: r.created_at as string,
  };
}

export function toRaceNordik(r: Tables<'race_nordiks'>): RaceNordik {
  return {
    ...r,
    created_at: r.created_at as string,
  };
}

export function toSessionNordik(r: Tables<'session_nordiks'>): SessionNordik {
  return {
    ...r,
    created_at: r.created_at as string,
  };
}

export function toValidationReaction(r: Tables<'validation_reactions'>): ValidationReaction {
  return {
    ...r,
    created_at: r.created_at as string,
  };
}

export function toPreparation(r: Tables<'specific_preparations'>): SpecificPreparation {
  return {
    ...r,
    // created_by est nullable et SANS DEFAULT en base (contrairement aux
    // autres colonnes de cette famille) : table vide en prod a ce jour et
    // addPreparation renseigne toujours authUser?.id. Assertion assumee, a
    // revisiter si un autre chemin d'ecriture remplit un jour la table
    // (cf. risque 6 du lot data-layer-v2).
    created_by: r.created_by as string,
    created_at: r.created_at as string,
  };
}

export function toClubSettings(r: Tables<'club_settings'>): ClubSettings {
  return {
    ...r,
    race_paces: r.race_paces as unknown as Record<string, RacePaceConfig>,
    allure_zones: r.allure_zones as unknown as Record<string, AllureZoneConfig>,
    updated_at: r.updated_at as string,
  };
}

export function toNotification(r: Tables<'notifications'>): AppNotification {
  return {
    ...r,
    type: r.type as NotificationType,
    read: r.read as boolean,
    created_at: r.created_at as string,
  };
}

// --- Ecriture : type applicatif -> payload Supabase ---
// Seuls les champs jsonb dont le type applicatif est une interface nommee (ou
// un tableau/Record d'interface nommee) ont besoin du pont `unknown` :
// TypeScript exige une signature d'index explicite pour assigner un type
// nomme a `Json`, ce que les unions de litteraux (session_type) n'ont pas
// besoin de franchir (elles restent assignables a `string` directement).

export function asSessionInsert(session: Omit<Session, 'id' | 'created_at'>): TablesInsert<'sessions'> {
  return {
    ...session,
    blocks: session.blocks as unknown as Json,
  };
}

export function asSessionUpdate(updates: Partial<Session>): TablesUpdate<'sessions'> {
  return {
    ...updates,
    blocks: updates.blocks as unknown as Json,
  };
}

export function asUserUpdate(updates: Partial<User>): TablesUpdate<'users'> {
  return {
    ...updates,
    vma_history: updates.vma_history as unknown as Json,
    notification_preferences: updates.notification_preferences as unknown as Json,
  };
}

export function asClubSettingsPayload(
  racePaces: Record<string, RacePaceConfig>,
  allureZones: Record<string, AllureZoneConfig>,
  updatedBy: string | undefined
): TablesInsert<'club_settings'> {
  return {
    race_paces: racePaces as unknown as Json,
    allure_zones: allureZones as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
}
