/**
 * Enhanced Desktop Notifications with Quick Actions
 * Supports action buttons and rich interactions
 */

import { showError } from './toast';
import { takeNotificationAction, dismissNotification, snoozeNotification } from './apiEnhanced';

// Check if browser supports notifications and actions
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

export const supportsActions = () => {
  return isNotificationSupported() && 'actions' in Notification.prototype;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Notification permission granted');
      localStorage.setItem('notification_permission', 'granted');
      return true;
    } else if (permission === 'denied') {
      console.warn('Notification permission denied');
      localStorage.setItem('notification_permission', 'denied');
      return false;
    } else {
      console.log('Notification permission dismissed');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Get current permission status
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Show desktop notification with action buttons
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.icon - Icon URL
 * @param {Array} options.actions - Action buttons
 * @param {Object} options.data - Custom data
 * @param {Function} options.onAction - Action handler
 * @param {Function} options.onClick - Click handler
 * @param {Function} options.onClose - Close handler
 * @returns {Notification} notification instance
 */
export const showDesktopNotificationWithActions = (options = {}) => {
  if (!isNotificationSupported()) {
    console.warn('Desktop notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const {
    title = 'Benachrichtigung',
    body = '',
    icon = '/favicon.ico',
    badge = '/favicon.ico',
    tag = 'biolab-notification',
    actions = [],
    data = {},
    requireInteraction = false,
    silent = false,
    vibrate = [200, 100, 200],
    renotify = true,
    timestamp = Date.now(),
    onAction,
    onClick,
    onClose,
    onError,
    autoCloseDelay = 10000
  } = options;

  try {
    const notificationOptions = {
      body,
      icon,
      badge,
      tag,
      renotify,
      requireInteraction,
      silent,
      vibrate,
      timestamp,
      data: {
        ...data,
        timestamp: Date.now()
      },
      dir: 'auto',
      lang: 'de'
    };

    // Add actions if supported
    if (supportsActions() && actions.length > 0) {
      notificationOptions.actions = actions.slice(0, 2); // Most browsers support max 2 actions
    }

    const notification = new Notification(title, notificationOptions);

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();

      // Navigate to URL if provided
      if (data.url) {
        window.location.href = data.url;
      }

      // Call custom click handler
      if (onClick) {
        onClick(event, notification);
      }

      notification.close();
    };

    // Handle action button clicks (not all browsers support this)
    if (supportsActions()) {
      navigator.serviceWorker?.ready.then((registration) => {
        registration.active?.addEventListener('notificationclick', (event) => {
          event.preventDefault();

          if (event.action && onAction) {
            onAction(event.action, event, notification);
          }

          event.notification.close();
        });
      });
    }

    // Handle notification close
    notification.onclose = (event) => {
      if (onClose) {
        onClose(event, notification);
      }
    };

    // Handle notification error
    notification.onerror = (event) => {
      console.error('Notification error:', event);
      if (onError) {
        onError(event, notification);
      }
    };

    // Auto-close notification after delay (if not requiring interaction)
    if (autoCloseDelay && !requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, autoCloseDelay);
    }

    return notification;
  } catch (error) {
    console.error('Error showing desktop notification:', error);
    return null;
  }
};

/**
 * Predefined notification types with actions
 */
export const NotificationTypes = {
  MESSAGE: 'message',
  TASK: 'task',
  EVENT: 'event',
  WASTE: 'waste',
  SYSTEM: 'system'
};

/**
 * Show typed notification with preset actions
 * @param {string} type - Notification type
 * @param {Object} data - Notification data
 * @param {Object} customOptions - Additional options
 * @returns {Notification} notification instance
 */
export const showTypedNotificationWithActions = async (type, data, customOptions = {}) => {
  const soundUrl = '/sounds/notification.mp3';
  const soundEnabled = localStorage.getItem('notification_sound') === 'true';

  // Play sound if enabled
  if (soundEnabled && soundUrl) {
    try {
      const audio = new Audio(soundUrl);
      audio.volume = parseFloat(localStorage.getItem('notification_volume') || '0.5');
      audio.play().catch(err => console.warn('Could not play notification sound:', err));
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  let config = {};

  switch (type) {
    case NotificationTypes.MESSAGE:
      config = {
        title: `💬 ${data.senderName}`,
        body: data.messagePreview || 'Neue Nachricht',
        icon: data.senderAvatar || '/favicon.ico',
        tag: `message_${data.messageId}`,
        requireInteraction: false,
        actions: [
          { action: 'reply', title: '↩️ Antworten', icon: '/icons/reply.png' },
          { action: 'dismiss', title: '✕ Schließen', icon: '/icons/close.png' }
        ],
        data: {
          url: '/messages',
          messageId: data.messageId,
          senderId: data.senderId,
          notificationId: data.notificationId
        },
        onAction: async (action) => {
          if (action === 'reply' && data.notificationId) {
            await takeNotificationAction(data.notificationId, 'reply');
            window.location.href = '/messages';
          } else if (action === 'dismiss' && data.notificationId) {
            await dismissNotification(data.notificationId);
          }
        }
      };
      break;

    case NotificationTypes.TASK:
      config = {
        title: '✓ Neue Aufgabe zugewiesen',
        body: data.taskTitle || 'Aufgabe',
        icon: '/favicon.ico',
        tag: `task_${data.taskId}`,
        requireInteraction: true,
        actions: [
          { action: 'view', title: '👁 Ansehen', icon: '/icons/view.png' },
          { action: 'snooze', title: '⏰ 1h später', icon: '/icons/snooze.png' }
        ],
        data: {
          url: '/dashboard',
          taskId: data.taskId,
          notificationId: data.notificationId
        },
        onAction: async (action) => {
          if (action === 'view') {
            if (data.notificationId) {
              await takeNotificationAction(data.notificationId, 'view');
            }
            window.location.href = `/dashboard?task=${data.taskId}`;
          } else if (action === 'snooze' && data.notificationId) {
            await snoozeNotification(data.notificationId, 60);
          }
        }
      };
      break;

    case NotificationTypes.EVENT:
      config = {
        title: '📅 Terminerinnerung',
        body: `${data.eventTitle} beginnt in ${data.minutesUntil} Minuten`,
        icon: '/favicon.ico',
        tag: `event_${data.eventId}`,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        actions: [
          { action: 'view', title: '👁 Öffnen', icon: '/icons/view.png' },
          { action: 'snooze', title: '⏰ 15 Min', icon: '/icons/snooze.png' }
        ],
        data: {
          url: '/dashboard',
          eventId: data.eventId,
          notificationId: data.notificationId
        },
        onAction: async (action) => {
          if (action === 'view') {
            if (data.notificationId) {
              await takeNotificationAction(data.notificationId, 'view');
            }
            window.location.href = `/dashboard?event=${data.eventId}`;
          } else if (action === 'snooze' && data.notificationId) {
            await snoozeNotification(data.notificationId, 15);
          }
        }
      };
      break;

    case NotificationTypes.WASTE:
      config = {
        title: '♻️ Entsorgungserinnerung',
        body: `${data.wasteName}: Entsorgung erforderlich`,
        icon: '/favicon.ico',
        tag: `waste_${data.wasteId}`,
        requireInteraction: true,
        actions: [
          { action: 'schedule', title: '📆 Planen', icon: '/icons/calendar.png' },
          { action: 'dismiss', title: '✓ Erledigt', icon: '/icons/check.png' }
        ],
        data: {
          url: '/waste',
          wasteId: data.wasteId,
          notificationId: data.notificationId
        },
        onAction: async (action) => {
          if (action === 'schedule') {
            if (data.notificationId) {
              await takeNotificationAction(data.notificationId, 'schedule');
            }
            window.location.href = `/waste?schedule=${data.wasteId}`;
          } else if (action === 'dismiss' && data.notificationId) {
            await dismissNotification(data.notificationId);
          }
        }
      };
      break;

    case NotificationTypes.SYSTEM:
      config = {
        title: data.title || '⚙️ System-Benachrichtigung',
        body: data.message,
        icon: '/favicon.ico',
        tag: 'system_notification',
        requireInteraction: false,
        actions: [
          { action: 'view', title: '👁 Details', icon: '/icons/view.png' }
        ],
        data: {
          url: data.url || '/dashboard',
          notificationId: data.notificationId
        },
        onAction: async (action) => {
          if (action === 'view') {
            if (data.notificationId) {
              await takeNotificationAction(data.notificationId, 'view');
            }
            if (data.url) {
              window.location.href = data.url;
            }
          }
        }
      };
      break;

    default:
      config = {
        title: data.title || 'Benachrichtigung',
        body: data.message || '',
        icon: '/favicon.ico',
        tag: data.tag || 'notification',
        data: data
      };
  }

  // Merge with custom options
  const finalConfig = { ...config, ...customOptions };

  return showDesktopNotificationWithActions(finalConfig);
};

/**
 * Show notification for new smart notification received via WebSocket
 * @param {Object} notification - Notification object from backend
 */
export const showSmartNotification = async (notification) => {
  const type = notification.type;
  const data = {
    notificationId: notification.id,
    ...notification.metadata
  };

  // Determine notification type and data structure
  switch (type) {
    case 'message':
      data.senderName = notification.related_user_name || 'Unbekannt';
      data.messagePreview = notification.content;
      data.messageId = notification.message_id;
      data.senderId = notification.related_user_id;
      break;

    case 'task_assigned':
      data.taskTitle = notification.title;
      data.taskId = notification.task_id;
      break;

    case 'calendar_event':
      data.eventTitle = notification.title;
      data.eventId = notification.event_id;
      data.minutesUntil = Math.round((new Date(notification.metadata?.start_time) - new Date()) / 60000);
      break;

    case 'waste_disposal':
      data.wasteName = notification.title;
      data.wasteId = notification.metadata?.waste_id;
      break;

    default:
      data.title = notification.title;
      data.message = notification.content;
      data.url = notification.action_url;
  }

  return showTypedNotificationWithActions(type, data);
};

export default {
  isNotificationSupported,
  supportsActions,
  requestNotificationPermission,
  getNotificationPermission,
  showDesktopNotificationWithActions,
  showTypedNotificationWithActions,
  showSmartNotification,
  NotificationTypes
};
