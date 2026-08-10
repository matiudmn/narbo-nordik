/**
 * Filtrage cote destinataire des notifications selon ses preferences
 * (colonne notification_preferences, JSONB). Meme semantique que les
 * triggers SQL (`IS NOT FALSE`) : l'absence de cle pour un type donne
 * vaut "active".
 */
import type { AppNotification, NotificationPreferences } from '../types';

type ChannelFlags = { in_app?: boolean; email?: boolean } | undefined;

/** Seule la valeur false explicite desactive un canal (absence de cle = active). */
export function isPrefChannelEnabled(pref: unknown, channel: 'in_app' | 'email'): boolean {
  return (pref as ChannelFlags)?.[channel] !== false;
}

export function filterVisibleNotifications(
  notifications: AppNotification[],
  preferences: NotificationPreferences | null | undefined,
): AppNotification[] {
  const byType = preferences as Record<string, ChannelFlags> | null | undefined;
  return notifications.filter(n => isPrefChannelEnabled(byType?.[n.type], 'in_app'));
}

export type NotifTypeRow = {
  key: keyof NotificationPreferences;
  label: string;
  hasInApp: boolean;
  hasEmail: boolean;
};

// Chaque rôle ne liste que les types qu'il peut réellement recevoir (cf. triggers notify_*
// et destinataires des fonctions weekly-digest / vma-missing-reminder).
export const NOTIF_TYPES_ATHLETE: NotifTypeRow[] = [
  { key: 'new_session', label: 'Nouvelle seance', hasInApp: true, hasEmail: true },
  { key: 'palmares', label: 'Palmarès', hasInApp: true, hasEmail: false },
  { key: 'vma_update', label: 'Mise a jour VMA', hasInApp: true, hasEmail: true },
  { key: 'reaction', label: 'Kudos reçus', hasInApp: true, hasEmail: false },
  { key: 'weekly_digest', label: 'Digest hebdo', hasInApp: false, hasEmail: true },
];
export const NOTIF_TYPES_COACH: NotifTypeRow[] = [
  { key: 'new_athlete', label: 'Nouvel athlète inscrit', hasInApp: true, hasEmail: true },
  { key: 'vma_missing', label: 'Rappel VMA manquantes', hasInApp: true, hasEmail: false },
  { key: 'palmares', label: 'Palmarès', hasInApp: true, hasEmail: false },
];
