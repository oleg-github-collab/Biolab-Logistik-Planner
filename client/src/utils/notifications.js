/**
 * Browser Notification Utility
 * Handles desktop push notifications with permission management
 */

// Helper: get current user ID for scoping localStorage keys
const getCurrentUserId = () => localStorage.getItem('current_user_id') || 'anonymous';
const userKey = (key) => `${key}_user_${getCurrentUserId()}`;

// Check if browser supports notifications
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Request notification permission from user
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Notification permission granted');
      localStorage.setItem(userKey('notification_permission'), 'granted');
      return true;
    } else if (permission === 'denied') {
      console.warn('Notification permission denied');
      localStorage.setItem(userKey('notification_permission'), 'denied');
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

// Check current permission status
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

// Show desktop notification
export const showDesktopNotification = (title, body, options = {}) => {
  if (!isNotificationSupported()) {
    console.warn('Desktop notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const defaultOptions = {
      body: body,
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag || 'biolab-notification',
      renotify: options.renotify !== undefined ? options.renotify : true,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      vibrate: options.vibrate || [200, 100, 200],
      data: options.data || {},
      dir: options.dir || 'auto',
      lang: options.lang || 'de',
      timestamp: Date.now(),
      ...options
    };

    const notification = new Notification(title, defaultOptions);

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();

      // Navigate to URL if provided
      if (options.data?.url) {
        window.location.href = options.data.url;
      }

      // Call custom click handler if provided
      if (options.onClick) {
        options.onClick(event);
      }

      notification.close();
    };

    // Handle notification close
    notification.onclose = (event) => {
      if (options.onClose) {
        options.onClose(event);
      }
    };

    // Handle notification error
    notification.onerror = (event) => {
      console.error('Notification error:', event);
      if (options.onError) {
        options.onError(event);
      }
    };

    // Auto-close notification after specified duration
    const autoCloseDelay = options.autoCloseDelay || 7000;
    if (autoCloseDelay && !options.requireInteraction) {
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

// Show notification with sound (optional)
export const showNotificationWithSound = (title, body, options = {}) => {
  const soundEnabled = localStorage.getItem(userKey('notification_sound')) === 'true';

  if (soundEnabled && options.soundUrl) {
    try {
      const audio = new Audio(options.soundUrl);
      audio.volume = parseFloat(localStorage.getItem(userKey('notification_volume')) || '0.5');
      audio.play().catch(err => console.warn('Could not play notification sound:', err));
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  return showDesktopNotification(title, body, options);
};

// Notification presets for common use cases
export const NotificationTypes = {
  NEW_MESSAGE: 'new_message',
  TASK_ASSIGNED: 'task_assigned',
  WASTE_DISPOSAL: 'waste_disposal',
  CALENDAR_EVENT: 'calendar_event',
  SYSTEM: 'system'
};

// Show typed notification with preset configuration
export const showTypedNotification = (type, data) => {
  const soundUrl = '/sounds/notification.mp3';

  switch (type) {
    case NotificationTypes.NEW_MESSAGE:
      return showNotificationWithSound(
        `Neue Nachricht von ${data.senderName}`,
        data.messagePreview,
        {
          tag: `message_${data.messageId}`,
          icon: '/favicon.ico',
          soundUrl,
          data: {
            url: '/messages',
            messageId: data.messageId,
            senderId: data.senderId
          },
          autoCloseDelay: 5000
        }
      );

    case NotificationTypes.TASK_ASSIGNED:
      return showNotificationWithSound(
        'Neue Aufgabe zugewiesen',
        `${data.taskTitle} wurde Ihnen zugewiesen`,
        {
          tag: `task_${data.taskId}`,
          icon: '/favicon.ico',
          soundUrl,
          data: {
            url: '/dashboard',
            taskId: data.taskId
          },
          autoCloseDelay: 7000
        }
      );

    case NotificationTypes.WASTE_DISPOSAL:
      return showNotificationWithSound(
        'Entsorgungserinnerung',
        `${data.wasteName}: Entsorgung erforderlich`,
        {
          tag: `waste_${data.wasteId}`,
          icon: '/favicon.ico',
          soundUrl,
          data: {
            url: '/waste',
            wasteId: data.wasteId
          },
          requireInteraction: true,
          autoCloseDelay: 10000
        }
      );

    case NotificationTypes.CALENDAR_EVENT:
      return showNotificationWithSound(
        'Terminerinnerung',
        `${data.eventTitle} beginnt in ${data.minutesUntil} Minuten`,
        {
          tag: `event_${data.eventId}`,
          icon: '/favicon.ico',
          soundUrl,
          data: {
            url: '/dashboard',
            eventId: data.eventId
          },
          requireInteraction: true,
          autoCloseDelay: 8000
        }
      );

    case NotificationTypes.SYSTEM:
      return showDesktopNotification(
        data.title || 'System-Benachrichtigung',
        data.message,
        {
          tag: 'system_notification',
          icon: '/favicon.ico',
          autoCloseDelay: 5000,
          ...data.options
        }
      );

    default:
      return showDesktopNotification(data.title, data.message, data.options);
  }
};

// Get user notification preferences
export const getNotificationPreferences = () => {
  return {
    enabled: localStorage.getItem(userKey('notifications_enabled')) !== 'false',
    soundEnabled: localStorage.getItem(userKey('notification_sound')) === 'true',
    volume: parseFloat(localStorage.getItem(userKey('notification_volume')) || '0.5'),
    types: {
      messages: localStorage.getItem(userKey('notify_messages')) !== 'false',
      tasks: localStorage.getItem(userKey('notify_tasks')) !== 'false',
      waste: localStorage.getItem(userKey('notify_waste')) !== 'false',
      events: localStorage.getItem(userKey('notify_events')) !== 'false'
    }
  };
};

// Update notification preferences
export const updateNotificationPreferences = (preferences) => {
  if (preferences.enabled !== undefined) {
    localStorage.setItem(userKey('notifications_enabled'), preferences.enabled);
  }
  if (preferences.soundEnabled !== undefined) {
    localStorage.setItem(userKey('notification_sound'), preferences.soundEnabled);
  }
  if (preferences.volume !== undefined) {
    localStorage.setItem(userKey('notification_volume'), preferences.volume);
  }
  if (preferences.types) {
    Object.keys(preferences.types).forEach(type => {
      localStorage.setItem(userKey(`notify_${type}`), preferences.types[type]);
    });
  }
};

export default {
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  showDesktopNotification,
  showNotificationWithSound,
  showTypedNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationTypes
};
