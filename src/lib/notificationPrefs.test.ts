import { describe, it, expect } from 'vitest';
import {
  filterVisibleNotifications,
  isPrefChannelEnabled,
  NOTIF_TYPES_ATHLETE,
  NOTIF_TYPES_COACH,
} from './notificationPrefs';
import type { NotifTypeRow } from './notificationPrefs';
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

describe('isPrefChannelEnabled', () => {
  it('active les deux canaux quand la préférence du type est absente', () => {
    expect(isPrefChannelEnabled(undefined, 'in_app')).toBe(true);
    expect(isPrefChannelEnabled(undefined, 'email')).toBe(true);
  });

  it("active un canal quand l'objet existe mais que la clé du canal est absente", () => {
    expect(isPrefChannelEnabled({}, 'in_app')).toBe(true);
    expect(isPrefChannelEnabled({ in_app: false }, 'email')).toBe(true);
  });

  it('ne désactive un canal que sur false explicite', () => {
    expect(isPrefChannelEnabled({ in_app: false }, 'in_app')).toBe(false);
    expect(isPrefChannelEnabled({ email: false }, 'email')).toBe(false);
    expect(isPrefChannelEnabled({ in_app: true, email: true }, 'in_app')).toBe(true);
    expect(isPrefChannelEnabled({ in_app: true, email: true }, 'email')).toBe(true);
  });
});

// Réglages affichés par rôle dans le bloc Préférences du profil (PR #88).
function channelsByKey(rows: NotifTypeRow[]) {
  return Object.fromEntries(rows.map(({ key, hasInApp, hasEmail }) => [key, { hasInApp, hasEmail }]));
}

describe('NOTIF_TYPES par rôle', () => {
  it('athlète : new_session, palmares, vma_update, reaction, weekly_digest avec leurs canaux', () => {
    expect(NOTIF_TYPES_ATHLETE).toHaveLength(5);
    expect(channelsByKey(NOTIF_TYPES_ATHLETE)).toEqual({
      new_session: { hasInApp: true, hasEmail: true },
      palmares: { hasInApp: true, hasEmail: false },
      vma_update: { hasInApp: true, hasEmail: true },
      reaction: { hasInApp: true, hasEmail: false },
      weekly_digest: { hasInApp: false, hasEmail: true },
    });
  });

  it('coach : new_athlete (in-app + email), vma_missing et palmares (in-app seul)', () => {
    expect(NOTIF_TYPES_COACH).toHaveLength(3);
    expect(channelsByKey(NOTIF_TYPES_COACH)).toEqual({
      new_athlete: { hasInApp: true, hasEmail: true },
      vma_missing: { hasInApp: true, hasEmail: false },
      palmares: { hasInApp: true, hasEmail: false },
    });
  });

  // Copie de la skip-list du trigger notify_email_on_insert
  // (supabase/migrations/20260810140000_notify_coaches_new_athlete.sql) : ces types
  // ne déclenchent pas l'e-mail transactionnel à l'insertion d'une notification.
  const EMAIL_SKIP_LIST = ['weekly_digest', 'palmares', 'new_session', 'reaction', 'vma_missing'];
  // Types de la skip-list couverts par un envoi dédié qui relit la préférence e-mail
  // (fonctions daily-session-digest et weekly-digest).
  const DIGEST_EMAIL_TYPES = ['new_session', 'weekly_digest'];

  it('hasEmail correspond exactement aux types ayant un envoi e-mail effectif', () => {
    for (const { key, hasEmail } of [...NOTIF_TYPES_ATHLETE, ...NOTIF_TYPES_COACH]) {
      const hasSender = !EMAIL_SKIP_LIST.includes(key) || DIGEST_EMAIL_TYPES.includes(key);
      expect(hasEmail, `canal e-mail du type ${key}`).toBe(hasSender);
    }
  });
});
