import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllReadNotifications,
  takeNotificationAction,
  respondToDisposalAction
} from '../utils/apiEnhanced';

const CACHE_KEY = 'biolab.notifications.v2';
const CACHE_LIMIT = 120;

const normalizeNotification = (payload = {}) => {
  if (!payload) return null;
  const baseContent = payload.content ?? payload.body ?? payload.message ?? payload.description ?? '';
  return {
    ...payload,
    id: payload.id || payload.notification_id || `notif-${Date.now()}-${Math.random()}`,
    type: payload.type || 'system',
    title: payload.title || payload.subject || 'Benachrichtigung',
    content: baseContent,
    created_at: payload.created_at || new Date().toISOString(),
    metadata: payload.metadata || {},
    icon: payload.icon || '/logo192.png',
    is_read: payload.is_read ?? payload.read ?? false
  };
};

const persistNotifications = (items = []) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to persist notifications cache:', error);
  }
};

export const useNotifications = ({ filter = 'all' } = {}) => {
  const { notifications: socketNotifications, isConnected } = useWebSocketContext();
  const [notifications, setNotifications] = useState([]);
  const [remoteUnreadCount, setRemoteUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastNotificationIdRef = useRef(null);

  const updateNotificationsState = useCallback((updater) => {
    setNotifications((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const limited = Array.isArray(next) ? next.slice(0, CACHE_LIMIT) : [];
      persistNotifications(limited);
      return limited;
    });
  }, []);

  const computedUnreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const unreadCount = Math.max(remoteUnreadCount, computedUnreadCount);

  const hydrateCache = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.length) return;

      const normalized = parsed
        .map((item) => normalizeNotification(item))
        .filter(Boolean);
      const limited = normalized.slice(0, CACHE_LIMIT);

      setNotifications(limited);
      setRemoteUnreadCount((prev) =>
        Math.max(prev, limited.filter((item) => !item.is_read).length)
      );
      if (limited.length) {
        lastNotificationIdRef.current = limited[0].id;
      }
    } catch (error) {
      console.error('Error hydrating notifications cache:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        filter === 'all'
          ? {}
          : filter === 'unread'
          ? { is_read: false }
          : { type: filter };

      const response = await getNotifications(params);
      const rawList = Array.isArray(response?.data?.notifications)
        ? response.data.notifications
        : [];
      const normalized = rawList
        .map((item) => normalizeNotification(item))
        .filter(Boolean);

      if (normalized.length) {
        lastNotificationIdRef.current = normalized[0].id;
      }

      updateNotificationsState((prev) => {
        const filtered = prev.filter((notification) => !normalized.some((item) => item.id === notification.id));
        return [...normalized, ...filtered];
      });
      return normalized;
    } catch (error) {
      console.error('Error loading notifications:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [filter, updateNotificationsState]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      const count = parseInt(response.data?.total, 10) || 0;
      setRemoteUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread notification count:', error);
    }
  }, []);

  useEffect(() => {
    hydrateCache();
  }, [hydrateCache]);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  useEffect(() => {
    if (!socketNotifications?.length) return;
    const seenId = lastNotificationIdRef.current;
    const incoming = [];
    for (const notification of socketNotifications) {
      if (seenId && notification.id === seenId) {
        break;
      }
      incoming.push(notification);
    }
    if (!incoming.length) {
      return;
    }

    lastNotificationIdRef.current = socketNotifications[0].id;

    const normalized = incoming
      .map((item) => normalizeNotification(item))
      .filter(Boolean);

    if (!normalized.length) {
      return;
    }

    updateNotificationsState((prev) => {
      const merged = [...normalized];
      const seen = new Set(normalized.map((item) => item.id));
      prev.forEach((existing) => {
        if (!seen.has(existing.id)) {
          merged.push(existing);
        }
      });
      return merged;
    });

  }, [socketNotifications, updateNotificationsState]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      updateNotificationsState((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification
        )
      );
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [updateNotificationsState, loadUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      updateNotificationsState((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [updateNotificationsState, loadUnreadCount]);

  const clearRead = useCallback(async () => {
    try {
      await clearAllReadNotifications();
      updateNotificationsState((prev) => prev.filter((notification) => !notification.is_read));
      await loadUnreadCount();
    } catch (error) {
      console.error('Error clearing read notifications:', error);
    }
  }, [updateNotificationsState, loadUnreadCount]);

  const removeNotification = useCallback(async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      updateNotificationsState((prev) => prev.filter((notification) => notification.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [updateNotificationsState, loadUnreadCount]);

  const handleNotificationAction = useCallback(
    async (notification, action) => {
      try {
        await takeNotificationAction(notification.id, action.key, {
          scheduleId: notification.metadata?.scheduleId
        });
        if (notification.metadata?.scheduleId && action.entAction) {
          await respondToDisposalAction(notification.metadata.scheduleId, action.entAction);
        }
        await loadNotifications();
        await loadUnreadCount();
      } catch (error) {
        console.error('Notification action error:', error);
        throw error;
      }
    },
    [loadNotifications, loadUnreadCount]
  );

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    refreshNotifications: loadNotifications,
    markNotificationAsRead: markAsRead,
    markAllNotificationsAsRead: markAllAsRead,
    clearAllReadNotifications: clearRead,
    deleteNotification: removeNotification,
    takeNotificationAction: handleNotificationAction
  };
};

export default useNotifications;
