# Comprehensive Notification System Documentation

## Overview

The Biolab-Logistik-Planner now includes a fully-featured notification system that provides real-time updates through multiple channels:

1. **In-app Notifications** - Bell icon in header with notification center
2. **Toast Notifications** - Temporary on-screen alerts
3. **Desktop Push Notifications** - Browser-level notifications
4. **Sound Notifications** - Optional audio alerts

## Architecture

### Backend Components

#### 1. WebSocket Server (`/server/websocket.js`)

Enhanced to emit structured notification events:

```javascript
// Example notification event structure
{
  type: 'new_message',
  title: 'Neue Nachricht von John Doe',
  body: 'Hey, können wir uns heute treffen?',
  icon: '/favicon.ico',
  tag: 'message_123',
  timestamp: '2025-10-05T12:00:00.000Z',
  data: {
    messageId: 123,
    senderId: 5,
    senderName: 'John Doe',
    messagePreview: 'Hey, können wir uns heute treffen?',
    messageType: 'text',
    url: '/messages'
  }
}
```

#### 2. API Endpoints (`/server/routes/messages.js`)

New endpoints for notification management:

- `GET /api/messages/unread-count` - Get unread message count
- `GET /api/messages/unread` - Get all unread messages with sender info
- `POST /api/messages/:id/mark-read` - Mark specific message as read

### Frontend Components

#### 1. Notification Utility (`/client/src/utils/notifications.js`)

Provides browser notification functionality:

```javascript
import {
  showTypedNotification,
  NotificationTypes,
  requestNotificationPermission,
  getNotificationPermission
} from '../utils/notifications';

// Request permission
await requestNotificationPermission();

// Show notification
showTypedNotification(NotificationTypes.NEW_MESSAGE, {
  messageId: 123,
  senderId: 5,
  senderName: 'John Doe',
  messagePreview: 'Hello!'
});
```

**Available Notification Types:**

- `NEW_MESSAGE` - New message notifications
- `TASK_ASSIGNED` - Task assignment notifications
- `WASTE_DISPOSAL` - Waste disposal reminders
- `CALENDAR_EVENT` - Calendar event reminders
- `SYSTEM` - System notifications

#### 2. NotificationCenter Component (`/client/src/components/NotificationCenter.js`)

Bell icon dropdown with notification list:

**Features:**
- Real-time notification updates via WebSocket
- Unread count badge
- Last 10 notifications preview
- Mark as read functionality
- Click to navigate to related page
- Permission request UI
- Persists to localStorage

**Usage:**
```javascript
import NotificationCenter from './NotificationCenter';

<NotificationCenter socket={socket} userId={user.id} />
```

#### 3. ModernMessenger Updates

Enhanced with notification features:

- Toast notifications for new messages when not viewing conversation
- Desktop notifications with permission
- Optional sound notifications
- Real-time typing indicators via WebSocket
- Auto-mark as read when viewing conversation

## Notification Event Examples

### 1. New Message Notification

**Server-side (WebSocket emit):**
```javascript
io.to(receiverData.socketId).emit('notification', {
  type: 'new_message',
  title: `Neue Nachricht von ${senderName}`,
  body: messagePreview,
  icon: '/favicon.ico',
  tag: `message_${messageId}`,
  timestamp: new Date().toISOString(),
  data: {
    messageId: messageId,
    senderId: senderId,
    senderName: senderName,
    messagePreview: messagePreview,
    messageType: 'text',
    url: '/messages'
  }
});
```

**Client-side (Reception & Display):**
```javascript
// 1. WebSocket listener in NotificationCenter
socket.on('notification', (notification) => {
  addNotification(notification);

  // Show desktop notification if granted
  if (getNotificationPermission() === 'granted') {
    showTypedNotification(notification.type, notification.data);
  }
});

// 2. In ModernMessenger - Toast notification
socket.on('new_message', (message) => {
  showCustom(`Neue Nachricht von ${message.sender_name}`, {
    label: 'Anzeigen',
    onClick: () => {
      window.location.href = '/messages';
    }
  });
});
```

### 2. Task Assignment Notification

**Example Usage:**
```javascript
// Server-side
const { sendNotificationToUser } = require('./websocket');

sendNotificationToUser(assigneeId, {
  type: 'task_assigned',
  title: 'Neue Aufgabe zugewiesen',
  body: `${taskTitle} wurde Ihnen zugewiesen`,
  data: {
    taskId: taskId,
    taskTitle: taskTitle,
    assignedBy: assignerName,
    dueDate: dueDate
  }
});

// Client-side
showTypedNotification(NotificationTypes.TASK_ASSIGNED, {
  taskId: 42,
  taskTitle: 'Wochenplanung abschließen',
  assignedBy: 'Admin',
  dueDate: '2025-10-12'
});
```

### 3. Waste Disposal Reminder

**Example Usage:**
```javascript
// Server-side
sendNotificationToUser(userId, {
  type: 'waste_disposal',
  title: 'Entsorgungserinnerung',
  body: `${wasteName}: Entsorgung erforderlich`,
  data: {
    wasteId: wasteId,
    wasteName: wasteName,
    scheduledDate: date,
    priority: 'high'
  }
});

// Client-side
showTypedNotification(NotificationTypes.WASTE_DISPOSAL, {
  wasteId: 15,
  wasteName: 'Lösungsmittel - Kanister 140603',
  scheduledDate: '2025-10-08',
  priority: 'high'
});
```

### 4. Calendar Event Reminder

**Example Usage:**
```javascript
// Server-side
sendNotificationToUser(userId, {
  type: 'calendar_event',
  title: 'Terminerinnerung',
  body: `${eventTitle} beginnt in ${minutesUntil} Minuten`,
  data: {
    eventId: eventId,
    eventTitle: eventTitle,
    minutesUntil: 15,
    startTime: startTime
  }
});

// Client-side
showTypedNotification(NotificationTypes.CALENDAR_EVENT, {
  eventId: 88,
  eventTitle: 'Team Meeting',
  minutesUntil: 15,
  startTime: '2025-10-05T14:00:00Z'
});
```

## User Preferences

Notification preferences are stored in localStorage:

```javascript
// Get current preferences
import { getNotificationPreferences } from '../utils/notifications';
const prefs = getNotificationPreferences();

// Structure:
{
  enabled: true,              // Master switch
  soundEnabled: true,         // Sound on/off
  volume: 0.5,               // 0.0 - 1.0
  types: {
    messages: true,          // Message notifications
    tasks: true,            // Task notifications
    waste: true,            // Waste disposal notifications
    events: true            // Calendar event notifications
  }
}

// Update preferences
import { updateNotificationPreferences } from '../utils/notifications';
updateNotificationPreferences({
  soundEnabled: true,
  volume: 0.7,
  types: {
    messages: true,
    tasks: false  // Disable task notifications
  }
});
```

## Sound Notifications

### Setup

1. Add notification sound file to `/client/public/sounds/notification.mp3`
2. Enable sound in localStorage: `localStorage.setItem('notification_sound', 'true')`
3. Set volume: `localStorage.setItem('notification_volume', '0.5')` (0.0 - 1.0)

### Programmatic Usage

```javascript
import { showNotificationWithSound } from '../utils/notifications';

showNotificationWithSound(
  'Neue Nachricht',
  'Sie haben eine neue Nachricht erhalten',
  {
    soundUrl: '/sounds/notification.mp3',
    autoCloseDelay: 5000,
    data: { url: '/messages' }
  }
);
```

## Browser Permission Flow

1. User opens application
2. NotificationCenter shows permission request button if not granted/denied
3. User clicks "Desktop-Benachrichtigungen aktivieren"
4. Browser prompts for permission
5. Permission status stored in localStorage
6. If granted, desktop notifications are shown for new events

## WebSocket Event Flow

```
User A sends message to User B
         ↓
Server receives message
         ↓
Save to database
         ↓
Emit 'new_message' to User B's socket
         ↓
Emit 'notification' event to User B's socket
         ↓
User B's client receives events
         ↓
- Update message list (if on Messages page)
- Show toast notification (if not viewing conversation)
- Show desktop notification (if permission granted)
- Play sound (if enabled)
- Add to NotificationCenter (stored in localStorage)
```

## Polling Fallback

If WebSocket is unavailable, the NotificationCenter polls the API every 30 seconds:

```javascript
// In NotificationCenter component
useEffect(() => {
  const fetchUnreadCount = async () => {
    const response = await fetch('/api/messages/unread-count', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setUnreadCount(data.unreadCount);
  };

  fetchUnreadCount();
  const interval = setInterval(fetchUnreadCount, 30000);
  return () => clearInterval(interval);
}, []);
```

## Integration Examples

### Adding Custom Notification Type

1. **Add to NotificationTypes** (`/client/src/utils/notifications.js`):
```javascript
export const NotificationTypes = {
  NEW_MESSAGE: 'new_message',
  TASK_ASSIGNED: 'task_assigned',
  WASTE_DISPOSAL: 'waste_disposal',
  CALENDAR_EVENT: 'calendar_event',
  SYSTEM: 'system',
  CUSTOM_TYPE: 'custom_type'  // Add new type
};
```

2. **Add case to showTypedNotification**:
```javascript
case NotificationTypes.CUSTOM_TYPE:
  return showNotificationWithSound(
    data.title || 'Custom Notification',
    data.body,
    {
      tag: `custom_${data.id}`,
      icon: '/favicon.ico',
      soundUrl: '/sounds/notification.mp3',
      data: {
        url: data.url,
        ...data
      },
      autoCloseDelay: 7000
    }
  );
```

3. **Emit from server**:
```javascript
const { sendNotificationToUser } = require('./websocket');

sendNotificationToUser(userId, {
  type: 'custom_type',
  title: 'Custom Title',
  body: 'Custom message body',
  data: {
    id: 123,
    url: '/custom-page',
    customField: 'value'
  }
});
```

## Testing Notifications

### Test Desktop Notifications

```javascript
import { showDesktopNotification, requestNotificationPermission } from '../utils/notifications';

// 1. Request permission
await requestNotificationPermission();

// 2. Show test notification
showDesktopNotification(
  'Test Notification',
  'This is a test message',
  {
    tag: 'test',
    requireInteraction: false,
    autoCloseDelay: 5000
  }
);
```

### Test WebSocket Notifications

```javascript
// In browser console (after connecting to app)
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

socket.emit('send_message', {
  receiverId: 2,  // Replace with actual user ID
  message: 'Test notification message',
  messageType: 'text'
});
```

## Troubleshooting

### Desktop Notifications Not Showing

1. Check browser permission: `Notification.permission` should return `'granted'`
2. Check notification preferences: `localStorage.getItem('notifications_enabled')`
3. Verify WebSocket connection in console
4. Check if notifications are blocked by browser/OS settings

### Sound Not Playing

1. Check if sound file exists: `/client/public/sounds/notification.mp3`
2. Verify sound preference: `localStorage.getItem('notification_sound') === 'true'`
3. Check browser's autoplay policy (user interaction may be required first)
4. Verify volume setting: `localStorage.getItem('notification_volume')`

### WebSocket Not Connecting

1. Check server is running on correct port
2. Verify JWT token is valid: `localStorage.getItem('token')`
3. Check CORS settings in server
4. Review browser console for connection errors

## Security Considerations

1. **Token Authentication**: All WebSocket connections require valid JWT token
2. **User Verification**: Notifications only sent to intended recipients
3. **XSS Prevention**: All notification content should be sanitized
4. **Rate Limiting**: Consider implementing rate limits for notification emissions
5. **Permission Model**: Desktop notifications require explicit user consent

## Performance Optimization

1. **Notification Limit**: Only last 50 notifications stored in NotificationCenter
2. **Polling Interval**: 30 seconds for unread count (only when WebSocket unavailable)
3. **LocalStorage**: Notifications persisted per user to reduce API calls
4. **Event Batching**: Multiple notifications batched when possible
5. **Auto-cleanup**: Old notifications automatically removed after 50 items

## Future Enhancements

Potential improvements for the notification system:

1. **Email Notifications**: Send email for important notifications when user offline
2. **Notification Settings Page**: Dedicated UI for managing all preferences
3. **Notification History**: View all notifications with filtering/search
4. **Custom Sounds**: Allow users to upload custom notification sounds
5. **Do Not Disturb**: Schedule quiet hours for notifications
6. **Notification Groups**: Group related notifications together
7. **Rich Notifications**: Support for images, actions, and interactive elements
8. **Push Notifications**: Service worker for offline notification support

## Conclusion

The comprehensive notification system provides multiple channels for real-time user engagement. It's designed to be extensible, performant, and user-friendly while maintaining security and privacy standards.

For questions or issues, please refer to the source code or contact the development team.
