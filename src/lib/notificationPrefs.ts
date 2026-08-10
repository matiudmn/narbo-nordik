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
