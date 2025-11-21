import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
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
import { useMobile, useScrollLock } from '../hooks/useMobile';
import { useNotifications } from '../hooks/useNotifications';

const FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'unread', label: 'Ungelesen' },
  { value: 'message', label: 'Nachrichten' },
  { value: 'mention', label: 'Erwähnungen' },
  { value: 'task_assigned', label: 'Aufgaben' }
];

const NotificationDropdown = () => {
  const { isMobile } = useMobile();
  const { lockScroll, unlockScroll } = useScrollLock();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const dropdownRef = useRef(null);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);

  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllReadNotifications,
    deleteNotification,
    takeNotificationAction
  } = useNotifications({ filter });

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    if (isMobile) {
      unlockScroll();
    }
  }, [isMobile, unlockScroll]);


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
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

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
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [markNotificationAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, [markAllNotificationsAsRead]);

  const handleClearAll = useCallback(async () => {
    try {
      await clearAllReadNotifications();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [clearAllReadNotifications]);

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
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [deleteNotification]);

  const handleNotificationActionButton = useCallback(async (event, notification, action) => {
    event.stopPropagation();
    const actionKey = `${notification.id}-${action.key}`;
    if (actionLoadingKey === actionKey) {
      return;
    }
    setActionLoadingKey(actionKey);
    try {
      await takeNotificationAction(notification, action);
    } catch (error) {
      console.error('Notification action error:', error);
    } finally {
      setActionLoadingKey(null);
    }
  }, [actionLoadingKey, takeNotificationAction]);

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

  const formatStatusBadge = useCallback((value) => {
    if (!value) return '';
    return value
      .toString()
      .split(/[_\s]+/)
      .map((segment) => {
        const formatted = segment.trim();
        return formatted ? `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}` : '';
      })
      .filter(Boolean)
      .join(' ');
  }, []);

  const getBroadcastStatusLabel = useCallback((notification) => {
    if (!notification) return 'Broadcast';
    const metadata = notification.metadata || {};
    if (metadata.status) return formatStatusBadge(metadata.status);
    if (metadata.delivery_status) return formatStatusBadge(metadata.delivery_status);
    if (metadata.delivered !== undefined) {
      return metadata.delivered ? 'Zugestellt' : 'Ausstehend';
    }
    if (metadata.recipients) {
      return `${metadata.recipients} Empfänger`;
    }
    return 'Broadcast';
  }, [formatStatusBadge]);

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
        {notifications.map((notification) => {
          const displayMessage = notification.content?.trim()
            ? notification.content
            : notification.title;
          return (
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
                  {displayMessage}
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
          );
        })}
      </ul>
    );
  }, [formatTimestamp, getNotificationIcon, handleNotificationClick, handleMarkAsRead, handleDelete, isMobile, loading, notifications]);

  const notificationStats = useMemo(() => {
    const stats = { pending: 0, tasks: 0, alerts: 0 };
    notifications.forEach((notification) => {
      if (notification.is_read) {
        return;
      }
      stats.pending += 1;
      if (notification.type === 'task_assigned') {
        stats.tasks += 1;
      }
      if (['calendar_event', 'system', 'warning', 'broadcast'].includes(notification.type)) {
        stats.alerts += 1;
      }
    });
    return stats;
  }, [notifications]);

  // unreadCount is managed by useNotifications hook, no need to sync manually

  const latestBroadcast = useMemo(() => {
    return notifications.find((notification) => notification.type === 'broadcast');
  }, [notifications]);

  const heroMessage = latestBroadcast?.content?.trim()
    ? latestBroadcast.content
    : latestBroadcast?.title || '';
  const recentBroadcasts = useMemo(
    () => notifications.filter((notification) => notification.type === 'broadcast'),
    [notifications]
  );
  const broadcastHighlights = recentBroadcasts.slice(0, 3);
  const getBroadcastRecipientsLabel = (notification) => {
    const recipients = notification.metadata?.recipients || notification.metadata?.recipientCount;
    if (!recipients) return null;
    return `${recipients} Empfänger`;
  };
  const renderBroadcastHighlights = (variant = 'mobile') => {
    if (!broadcastHighlights.length) return null;
    const title = variant === 'desktop' ? 'Zuletzt verschickte Broadcasts' : 'Massenmeldungen';
    return (
      <div className={`notification-panel-broadcasts ${variant === 'desktop' ? 'notification-panel-broadcasts--desktop' : ''}`}>
        <div className="notification-panel-broadcasts__heading">
          <p>{title}</p>
          <span>{broadcastHighlights.length} Einträge</span>
        </div>
        <div className="notification-panel-broadcasts__list">
          {broadcastHighlights.map((broadcast) => (
            <div
              key={broadcast.id || broadcast.notification_id || broadcast.created_at}
              className="notification-panel-broadcast"
            >
              <p className="notification-panel-broadcast__title">{broadcast.title}</p>
              <p className="notification-panel-broadcast__snippet">{broadcast.content || heroMessage}</p>
              <div className="notification-panel-broadcast__meta">
                <span>{formatTimestamp(broadcast.created_at)}</span>
                {getBroadcastRecipientsLabel(broadcast) && (
                  <span>{getBroadcastRecipientsLabel(broadcast)}</span>
                )}
                <span className="notification-panel-broadcast__status">
                  {getBroadcastStatusLabel(broadcast)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMobileNotificationList = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-600">Wird geladen...</p>
        </div>
      );
    }

    if (!notifications.length) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Keine Benachrichtigungen</h3>
          <p className="text-sm text-slate-500 text-center">
            Du bist auf dem neuesten Stand!
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {notifications.map((notification) => {
          const displayMessage = notification.content?.trim()
            ? notification.content
            : notification.title;
          return (
            <div
              key={notification.id}
              className={`px-4 py-4 ${notification.is_read ? 'bg-white' : 'bg-blue-50/50'}`}
            >
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notification.is_read ? 'bg-slate-100' : 'bg-blue-100'
                }`}>
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2">
                    {notification.title}
                  </p>
                  {displayMessage !== notification.title && (
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                      {displayMessage}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {formatTimestamp(notification.created_at)}
                  </p>

                  {/* Actions */}
                  {notification.metadata?.actions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {notification.metadata.actions.map((action) => {
                        const isLoading = actionLoadingKey === `${notification.id}-${action.key}`;
                        return (
                          <button
                            key={action.key}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleNotificationActionButton(event, notification, action);
                            }}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium active:bg-blue-700 disabled:opacity-50"
                          >
                            {isLoading ? 'Lädt...' : action.label || 'Aktion'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  {!notification.is_read && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 text-green-600 active:bg-green-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(notification.id);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 text-red-600 active:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
        {renderBroadcastHighlights('desktop')}
      </div>

      <div className="flex-1 overflow-y-auto">{notificationList}</div>
    </div>
  );

  const mobilePanel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md z-[10990]"
        onClick={closeDropdown}
      />

      {/* Panel */}
      <div className="fixed inset-0 bg-white z-[11000] flex flex-col min-h-screen">
        {/* Header - sticky */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Benachrichtigungen</h2>
              <p className="text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} neu` : 'Alles gelesen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDropdown}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters - sticky */}
        <div className="sticky top-[73px] z-10 bg-white border-b border-slate-200 px-4 py-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === item.value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-100 text-slate-700 active:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-gray-500">
            <div className="rounded-xl bg-blue-50 py-2">
              <p className="text-base font-bold text-gray-900">{notificationStats.pending}</p>
              <p>Ungelesen</p>
            </div>
            <div className="rounded-xl bg-emerald-50 py-2">
              <p className="text-base font-bold text-gray-900">{notificationStats.tasks}</p>
              <p>Aufgaben</p>
            </div>
            <div className="rounded-xl bg-amber-50 py-2">
              <p className="text-base font-bold text-gray-900">{notificationStats.alerts}</p>
              <p>Termine/System</p>
            </div>
          </div>
        </div>

        {/* Action bar */}
        {unreadCount > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium active:bg-blue-700"
            >
              <CheckCheck className="w-5 h-5" />
            Alle als gelesen markieren
            </button>
          </div>
        )}

        {renderBroadcastHighlights('mobile')}

        {/* List - scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderMobileNotificationList()}
        </div>

        {/* Bottom action */}
        {notifications.some(n => n.is_read) && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 shadow-lg">
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-medium active:bg-red-100"
            >
              <Trash2 className="w-5 h-5" />
              Gelesene löschen
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative ${isMobile ? 'notification-button' : 'p-2.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-slate-200 hover:border-blue-300'}`}
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

        {isOpen && !isMobile && dropdownPanel}
      </div>

      {/* Mobile panel rendered via Portal to escape parent positioning */}
      {isOpen && isMobile && typeof document !== 'undefined' && ReactDOM.createPortal(
        mobilePanel,
        document.body
      )}
    </>
  );
};

export default NotificationDropdown;
