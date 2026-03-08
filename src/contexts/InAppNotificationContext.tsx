import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../types';

interface InAppNotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const InAppNotificationContext = createContext<InAppNotificationContextType | null>(null);

const POLL_INTERVAL = 60_000;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const prevCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current > 0) {
      if ('Notification' in window && Notification.permission === 'granted') {
        const newest = notifications.find(n => !n.read);
        if (newest) {
          new Notification(newest.title, { body: newest.body || undefined });
        }
      }
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, notifications]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [user, notifications]);

  return (
    <InAppNotificationContext.Provider value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }}>
      {children}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications() {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) throw new Error('useInAppNotifications must be used within InAppNotificationProvider');
  return ctx;
}
