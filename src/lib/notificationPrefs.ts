/**
 * Filtrage cote destinataire des notifications selon ses preferences
 * (colonne notification_preferences, JSONB). Meme semantique que les
 * triggers SQL (`IS NOT FALSE`) : l'absence de cle pour un type donne
 * vaut "active".
 */
import type { AppNotification, NotificationPreferences } from '../types';

export function filterVisibleNotifications(
  notifications: AppNotification[],
  preferences: NotificationPreferences | null | undefined,
): AppNotification[] {
  const byType = preferences as Record<string, { in_app?: boolean } | undefined> | null | undefined;
  return notifications.filter(n => byType?.[n.type]?.in_app !== false);
}
