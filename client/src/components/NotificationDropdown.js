import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MessageSquare,
  AtSign,
  ThumbsUp,
  Calendar,
  ClipboardList,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
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
import { useWebSocketContext } from '../context/WebSocketContext';
import { useMobile, useScrollLock } from '../hooks/useMobile';

const FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'unread', label: 'Ungelesen' },
  { value: 'message', label: 'Nachrichten' },
  { value: 'mention', label: 'Erwähnungen' },
  { value: 'task_assigned', label: 'Aufgaben' }
];

const NotificationDropdown = () => {
  const { isConnected, notifications: socketNotifications } = useWebSocketContext();
  const { isMobile } = useMobile();
  const { lockScroll, unlockScroll } = useScrollLock();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    if (isMobile) {
      unlockScroll();
    }
  }, [isMobile, unlockScroll]);


  const normalizeNotification = useCallback((notification) => {
    if (!notification) return null;
    return {
      ...notification,
      id: notification.id || notification.notification_id || `temp_${Date.now()}`,
      title: notification.title || 'Benachrichtigung',
      content: notification.content || notification.body || notification.message || '',
      created_at: notification.created_at || new Date().toISOString(),
      icon: notification.icon || '/logo192.png'
    };
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(parseInt(response.data.total, 10) || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params =
        filter === 'unread'
          ? { is_read: false }
          : filter !== 'all'
          ? { type: filter }
          : {};
      const response = await getNotifications(params);
      const list = Array.isArray(response.data.notifications)
        ? response.data.notifications
        : [];
      setNotifications(list.map(normalizeNotification));
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, normalizeNotification]);

  useEffect(() => {
    loadUnreadCount();
    loadNotifications();
  }, [loadUnreadCount, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  useEffect(() => {
    if (!socketNotifications || socketNotifications.length === 0) return;
    const latest = normalizeNotification(socketNotifications[socketNotifications.length - 1]);
    if (!latest) return;

    setNotifications((prev) => {
      const exists = prev.some((item) => item.id === latest.id);
      return exists ? prev : [latest, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  }, [socketNotifications, normalizeNotification]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [filter, isOpen, loadNotifications]);

  useEffect(() => {
    if (!isMobile) return undefined;
    if (isOpen) {
      lockScroll();
      return () => unlockScroll();
    }
    return undefined;
  }, [isMobile, isOpen, lockScroll, unlockScroll]);

  const handleMarkAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification
        )
      );
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [loadUnreadCount]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      await clearAllReadNotifications();
      setNotifications((prev) => prev.filter((notification) => !notification.is_read));
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, []);

  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    if (isMobile) {
      closeDropdown();
    }
  }, [closeDropdown, handleMarkAsRead, isMobile]);

  const handleDelete = useCallback(async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [loadUnreadCount]);

  const handleNotificationActionButton = useCallback(async (event, notification, action) => {
    event.stopPropagation();
    const actionKey = `${notification.id}-${action.key}`;
    if (actionLoadingKey === actionKey) {
      return;
    }
    setActionLoadingKey(actionKey);
    try {
      await takeNotificationAction(notification.id, action.key, {
        scheduleId: notification.metadata?.scheduleId
      });
      if (action.entAction && notification.metadata?.scheduleId) {
        await respondToDisposalAction(notification.metadata.scheduleId, action.entAction);
      }
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Notification action error:', error);
    } finally {
      setActionLoadingKey(null);
    }
  }, [actionLoadingKey, loadNotifications, loadUnreadCount]);

  const getNotificationIcon = useCallback((type) => {
    const icons = {
      message: <MessageSquare className="w-4 h-4 text-blue-500" />,
      mention: <AtSign className="w-4 h-4 text-purple-500" />,
      reaction: <ThumbsUp className="w-4 h-4 text-pink-500" />,
      task_assigned: <ClipboardList className="w-4 h-4 text-green-500" />,
      calendar_event: <Calendar className="w-4 h-4 text-orange-500" />
    };
    return icons[type] || <Bell className="w-4 h-4 text-gray-500" />;
  }, []);

  const getNotificationLabel = useCallback((type) => {
    const labels = {
      message: 'Nachricht',
      mention: 'Erwähnung',
      reaction: 'Reaktion',
      task_assigned: 'Aufgabe',
      calendar_event: 'Kalender',
      system: 'System',
      broadcast: 'Broadcast'
    };
    return labels[type] || 'Info';
  }, []);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: de
    });
  }, []);

  const onFilterChange = (value) => {
    setFilter(value);
  };

  const notificationList = useMemo(() => {
    if (loading) {
      return (
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Lade Benachrichtigungen...</p>
        </div>
      );
    }

    if (!notifications.length) {
      return (
        <div className="p-10 text-center text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3" />
          <p className="font-medium">Keine Benachrichtigungen</p>
          <p className="text-sm mt-1">Du bist auf dem neuesten Stand</p>
        </div>
      );
    }

    return (
      <ul className="divide-y divide-gray-100">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`flex items-start gap-3 p-4 transition ${
              notification.is_read ? 'bg-white' : 'bg-blue-50'
            } ${isMobile ? 'active:bg-blue-100' : 'hover:bg-gray-50 cursor-pointer'}`}
          >
            <div className="flex-shrink-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  notification.is_read ? 'bg-gray-100' : 'bg-blue-100'
                }`}
              >
                {getNotificationIcon(notification.type)}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
                <span>{getNotificationLabel(notification.type)}</span>
                {!notification.is_read && <span className="text-blue-600 font-semibold">Neu</span>}
              </div>
              <p
                className={`text-sm font-semibold ${
                  notification.is_read ? 'text-gray-700' : 'text-gray-900'
                }`}
              >
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 mt-1 break-words">
                {notification.content}
              </p>
              {notification.metadata?.actions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {notification.metadata.actions.map((action) => {
                    const isLoading = actionLoadingKey === `${notification.id}-${action.key}`;
                    const variant =
                      action.variant === 'primary'
                        ? 'bg-blue-600 text-white border-transparent hover:bg-blue-700'
                        : action.variant === 'danger'
                        ? 'bg-red-600 text-white border-transparent hover:bg-red-700'
                        : 'bg-white text-slate-700 border border-gray-200 hover:bg-gray-50';
                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={(event) => handleNotificationActionButton(event, notification, action)}
                        disabled={isLoading}
                        className={`text-xs px-3 py-1 rounded-full font-semibold transition ${variant} disabled:opacity-60`}
                      >
                        {isLoading ? 'Wird gesendet…' : action.label || 'Aktion'}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <span>{formatTimestamp(notification.created_at)}</span>
                {!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {!notification.is_read && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMarkAsRead(notification.id);
                  }}
                  className="p-1 text-blue-600 hover:text-blue-700 transition"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete(notification.id);
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }, [formatTimestamp, getNotificationIcon, handleNotificationClick, handleMarkAsRead, handleDelete, isMobile, loading, notifications]);

  const notificationStats = useMemo(() => {
    const base = { pending: unreadCount, tasks: 0, alerts: 0 };
    notifications.forEach((notification) => {
      if (notification.type === 'task_assigned') {
        base.tasks += 1;
      }
      if (['calendar_event', 'system', 'warning', 'broadcast'].includes(notification.type)) {
        base.alerts += 1;
      }
    });
    return base;
  }, [notifications, unreadCount]);

  const dropdownPanel = (
    <div className="absolute right-0 mt-2 w-screen max-w-md sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[80vh] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Benachrichtigungen</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-blue-600 hover:text-blue-700 transition"
                title="Alle markieren"
              >
                <CheckCheck className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="text-gray-600 hover:text-gray-700 transition"
              title="Gelesene löschen"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => onFilterChange(item.value)}
              className={`px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap transition ${
                filter === item.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs text-gray-500">
          <div className="rounded-lg bg-blue-50 py-2">
            <p className="text-base font-semibold text-gray-900">{notificationStats.pending}</p>
            <p>Ungelesen</p>
          </div>
          <div className="rounded-lg bg-emerald-50 py-2">
            <p className="text-base font-semibold text-gray-900">{notificationStats.tasks}</p>
            <p>Aufgaben</p>
          </div>
          <div className="rounded-lg bg-amber-50 py-2">
            <p className="text-base font-semibold text-gray-900">{notificationStats.alerts}</p>
            <p>Termine/System</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{notificationList}</div>
    </div>
  );

  const mobilePanel = (
    <>
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[95]"
        onClick={closeDropdown}
      />
      <div className="fixed inset-x-0 bottom-0 top-16 bg-white rounded-t-3xl shadow-2xl z-[100] flex flex-col overflow-hidden">
        <div className="h-1.5 w-12 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Benachrichtigungen</h3>
            <button
              onClick={closeDropdown}
              className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300 transition"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => onFilterChange(item.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filter === item.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs text-gray-500">
            <div className="rounded-lg bg-blue-50 py-2">
              <p className="text-base font-semibold text-gray-900">{notificationStats.pending}</p>
              <p>Ungelesen</p>
            </div>
            <div className="rounded-lg bg-emerald-50 py-2">
              <p className="text-base font-semibold text-gray-900">{notificationStats.tasks}</p>
              <p>Aufgaben</p>
            </div>
            <div className="rounded-lg bg-amber-50 py-2">
              <p className="text-base font-semibold text-gray-900">{notificationStats.alerts}</p>
              <p>Termine/System</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold active:bg-blue-100 transition"
            >
              <CheckCheck className="w-4 h-4" />
              Alle gelesen
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold active:bg-gray-200 transition"
          >
            <Trash2 className="w-4 h-4" />
            Aufräumen
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{notificationList}</div>
      </div>
    </>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          console.log('[NotificationDropdown] Button clicked, current isOpen:', isOpen);
          setIsOpen((prev) => {
            console.log('[NotificationDropdown] Setting isOpen to:', !prev);
            return !prev;
          });
        }}
        className="relative p-2.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-slate-200 hover:border-blue-300"
        title={
          isConnected
            ? 'Benachrichtigungen'
            : 'Verbindung getrennt – zeige gespeicherte Benachrichtigungen'
        }
      >
        <Bell className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {!isConnected && unreadCount === 0 && (
          <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            !
          </span>
        )}
      </button>

      {isOpen && (isMobile ? mobilePanel : dropdownPanel)}
    </div>
  );
};

export default NotificationDropdown;
