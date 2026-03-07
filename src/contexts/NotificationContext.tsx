import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface NotificationContextType {
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<boolean>;
  sendNotification: (title: string, options?: NotificationOptions) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const NOTIF_PREF_KEY = 'narbo_notif_enabled';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported'
  );
  const [notificationsEnabled, setNotificationsEnabledState] = useState(() => {
    return localStorage.getItem(NOTIF_PREF_KEY) !== 'false';
  });

  useEffect(() => {
    localStorage.setItem(NOTIF_PREF_KEY, String(notificationsEnabled));
  }, [notificationsEnabled]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, [supported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!supported || permission !== 'granted' || !notificationsEnabled) return;
    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } catch {
      // SW notification fallback
      navigator.serviceWorker?.ready.then(reg => {
        reg.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          ...options,
        });
      });
    }
  }, [supported, permission, notificationsEnabled]);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setNotificationsEnabledState(enabled);
  }, []);

  return (
    <NotificationContext.Provider value={{
      permission,
      requestPermission,
      sendNotification,
      notificationsEnabled,
      setNotificationsEnabled,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
