import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showInfo } from '../utils/toast';
import {
  showTypedNotification,
  NotificationTypes,
  getNotificationPermission,
  requestNotificationPermission
} from '../utils/notifications';

const NotificationCenter = ({ socket, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    }
  }, [userId]);

  // Save notifications to localStorage
  const saveNotifications = useCallback((notifs) => {
    try {
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifs));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }, [userId]);

  // Add new notification
  const addNotification = useCallback((notification) => {
    const newNotif = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50); // Keep only last 50
      saveNotifications(updated);
      return updated;
    });

    setUnreadCount(prev => prev + 1);

    // Show desktop notification if permission granted
    if (notificationPermission === 'granted') {
      const notifPreferences = JSON.parse(localStorage.getItem('notification_preferences') || '{}');

      // Check if this type of notification is enabled
      const typeEnabled = notifPreferences[notification.type] !== false;

      if (typeEnabled) {
        showTypedNotification(notification.type, notification.data);
      }
    }
  }, [notificationPermission, saveNotifications]);

  // Listen to WebSocket notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification) => {
      addNotification(notification);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, addNotification]);

  // Fetch unread count periodically
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const fetchUnreadCount = async () => {
      // Skip if offline
      if (!navigator.onLine) {
        return;
      }

      try {
        const response = await fetch('/api/messages/unread-count', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Update unread count from server
          const currentUnread = notifications.filter(n => !n.read && n.type === 'new_message').length;
          if (data.unreadCount !== currentUnread) {
            setUnreadCount(prev => prev + (data.unreadCount - currentUnread));
          }
          retryCount = 0; // Reset on success
        }
      } catch (error) {
        // Silently fail for network errors, don't spam console
        if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
          retryCount++;
          // Only log if we've failed multiple times
          if (retryCount >= MAX_RETRIES) {
            console.warn('Failed to fetch unread messages count after multiple retries');
            retryCount = 0; // Reset
          }
        } else {
          console.error('Failed to fetch unread messages count:', error);
        }
      }
    };

    // Fetch initially and then every 30 seconds
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [notifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [saveNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(0);
    showSuccess('Alle Benachrichtigungen als gelesen markiert');
  }, [saveNotifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    saveNotifications([]);
    showInfo('Alle Benachrichtigungen gelöscht');
  }, [saveNotifications]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification) => {
    markAsRead(notification.id);

    if (notification.data?.url) {
      navigate(notification.data.url);
      setIsOpen(false);
    }
  }, [markAsRead, navigate]);

  // Request notification permission
  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(getNotificationPermission());

    if (granted) {
      showSuccess('Benachrichtigungen aktiviert');
    } else {
      showInfo('Benachrichtigungen wurden abgelehnt');
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);

    if (diffInMinutes < 1) return 'Gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Min.`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `vor ${diffInHours} Std.`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Gestern';
    if (diffInDays < 7) return `vor ${diffInDays} Tagen`;

    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Get notification icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_message':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case 'task_assigned':
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      case 'waste_disposal':
        return (
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        );
      case 'calendar_event':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Benachrichtigungen"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col animate-fadeIn">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Benachrichtigungen
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({unreadCount} neu)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      title="Alle als gelesen markieren"
                    >
                      Alle lesen
                    </button>
                    <button
                      onClick={clearAll}
                      className="text-xs text-gray-500 hover:text-gray-700"
                      title="Alle löschen"
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Permission Request */}
            {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
              <button
                onClick={handleRequestPermission}
                className="mt-3 w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Desktop-Benachrichtigungen aktivieren
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-gray-500 font-medium">Keine Benachrichtigungen</p>
                <p className="text-sm text-gray-400 mt-1">Sie sind auf dem neuesten Stand</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium text-gray-900 ${!notification.read ? 'font-semibold' : ''}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.body}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  navigate('/messages');
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Alle anzeigen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
