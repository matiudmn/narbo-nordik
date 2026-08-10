import { describe, it, expect } from 'vitest';
import { filterVisibleNotifications } from './notificationPrefs';
import type { AppNotification, NotificationPreferences } from '../types';

function notification(over: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    user_id: 'u1',
    type: 'reaction',
    title: 'Reaction !',
    body: null,
    link: null,
    read: false,
    created_at: '2026-08-10T10:00:00Z',
    ...over,
  };
}

describe('filterVisibleNotifications', () => {
  it('garde une notification dont la preference est absente', () => {
    const result = filterVisibleNotifications([notification({})], undefined);
    expect(result).toHaveLength(1);
  });

  it('masque une notification dont in_app vaut explicitement false', () => {
    const prefs = { reaction: { in_app: false } } as NotificationPreferences;
    const result = filterVisibleNotifications([notification({})], prefs);
    expect(result).toHaveLength(0);
  });

  it("n'affecte pas les autres types de notification", () => {
    const prefs = { reaction: { in_app: false } } as NotificationPreferences;
    const other = notification({ id: 'n2', type: 'new_session' });
    const result = filterVisibleNotifications([other], prefs);
    expect(result).toHaveLength(1);
  });

  it('garde une notification reaction quand in_app est explicitement true', () => {
    const prefs = { reaction: { in_app: true } } as NotificationPreferences;
    const result = filterVisibleNotifications([notification({})], prefs);
    expect(result).toHaveLength(1);
  });
});
