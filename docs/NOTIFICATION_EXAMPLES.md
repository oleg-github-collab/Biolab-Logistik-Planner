# Notification System - Quick Examples

## Підтвердження з прикладами notification events

### ✅ Система успішно впроваджена!

Всі компоненти системи сповіщень створені та інтегровані:

## 1. Backend Notifications (WebSocket)

### Нові повідомлення
```javascript
// Server: /server/websocket.js (lines 140-158)
io.to(receiverData.socketId).emit('notification', {
  type: 'new_message',
  title: `Neue Nachricht von ${userInfo.name}`,
  body: messagePreview,
  icon: '/favicon.ico',
  tag: `message_${messageId}`,
  timestamp: new Date().toISOString(),
  data: {
    messageId: this.lastID,
    senderId: userId,
    senderName: userInfo.name,
    messagePreview: messagePreview,
    messageType: messageType,
    url: '/messages'
  }
});
```

### API Endpoints
```bash
# Отримати кількість непрочитаних
GET /api/messages/unread-count
Response: { unreadCount: 5 }

# Отримати всі непрочитані повідомлення
GET /api/messages/unread
Response: [
  {
    id: 123,
    sender_id: 5,
    sender_name: "John Doe",
    message: "Hey, how are you?",
    created_at: "2025-10-05T12:00:00Z"
  }
]

# Позначити повідомлення як прочитане
POST /api/messages/123/mark-read
Response: { success: true, message: "Message marked as read" }
```

## 2. Frontend Components

### NotificationCenter Component
```jsx
import NotificationCenter from './NotificationCenter';

// В Header.js:
<NotificationCenter socket={socket} userId={user.id} />
```

**Функції:**
- 🔔 Bell icon з badge (unread count)
- 📱 Dropdown з останніми 10 сповіщеннями
- ✅ Mark as read / Mark all as read
- 🗑️ Clear all notifications
- 🔐 Request desktop notification permission
- 💾 Persist to localStorage
- 🔄 Real-time WebSocket updates
- 📊 Polling fallback (30 sec)

### Notification Types

```javascript
import { NotificationTypes, showTypedNotification } from '../utils/notifications';

// 💬 New Message
showTypedNotification(NotificationTypes.NEW_MESSAGE, {
  messageId: 123,
  senderId: 5,
  senderName: 'John Doe',
  messagePreview: 'Hey, können wir uns heute treffen?'
});

// 📋 Task Assigned
showTypedNotification(NotificationTypes.TASK_ASSIGNED, {
  taskId: 42,
  taskTitle: 'Wochenplanung abschließen'
});

// 🗑️ Waste Disposal Reminder
showTypedNotification(NotificationTypes.WASTE_DISPOSAL, {
  wasteId: 15,
  wasteName: 'Lösungsmittel - Kanister 140603'
});

// 📅 Calendar Event
showTypedNotification(NotificationTypes.CALENDAR_EVENT, {
  eventId: 88,
  eventTitle: 'Team Meeting',
  minutesUntil: 15
});
```

## 3. In-App Toast Notifications

### ModernMessenger Integration
```javascript
// Коли приходить нове повідомлення (не на поточній розмові):
socket.on('new_message', (message) => {
  showCustom(`Neue Nachricht von ${message.sender_name}`, {
    label: 'Anzeigen',
    onClick: () => {
      window.location.href = '/messages';
    }
  });

  // Play sound if enabled
  if (soundEnabled) {
    audioRef.current.play();
  }

  // Show desktop notification
  if (getNotificationPermission() === 'granted') {
    showTypedNotification(NotificationTypes.NEW_MESSAGE, data);
  }
});
```

## 4. Desktop Push Notifications

### Request Permission
```javascript
import {
  requestNotificationPermission,
  getNotificationPermission
} from '../utils/notifications';

// Check current permission
const permission = getNotificationPermission();
// Returns: 'granted' | 'denied' | 'default' | 'unsupported'

// Request permission
const granted = await requestNotificationPermission();
if (granted) {
  console.log('Desktop notifications enabled!');
}
```

### Show Desktop Notification
```javascript
import { showDesktopNotification } from '../utils/notifications';

showDesktopNotification(
  'Neue Nachricht',
  'Sie haben eine neue Nachricht erhalten',
  {
    icon: '/favicon.ico',
    tag: 'message_123',
    requireInteraction: false,
    autoCloseDelay: 7000,
    data: {
      url: '/messages'
    },
    onClick: (event) => {
      window.focus();
      window.location.href = '/messages';
    }
  }
);
```

## 5. Sound Notifications

### Setup
```javascript
// Enable sound
localStorage.setItem('notification_sound', 'true');

// Set volume (0.0 - 1.0)
localStorage.setItem('notification_volume', '0.7');
```

### Sound File Location
```
/client/public/sounds/notification.mp3
```

**Завантажити безкоштовні звуки:**
- https://notificationsounds.com/
- https://freesound.org/
- https://soundbible.com/

## 6. User Preferences

### Get Preferences
```javascript
import { getNotificationPreferences } from '../utils/notifications';

const prefs = getNotificationPreferences();
console.log(prefs);
/* Output:
{
  enabled: true,
  soundEnabled: true,
  volume: 0.5,
  types: {
    messages: true,
    tasks: true,
    waste: true,
    events: true
  }
}
*/
```

### Update Preferences
```javascript
import { updateNotificationPreferences } from '../utils/notifications';

updateNotificationPreferences({
  soundEnabled: true,
  volume: 0.8,
  types: {
    messages: true,
    tasks: false  // Disable task notifications
  }
});
```

## 7. Complete Notification Flow Example

### Scenario: User A sends message to User B

```
1. User A sends message
   ↓
2. Server receives via WebSocket
   socket.on('send_message', ...)
   ↓
3. Save to database
   db.run("INSERT INTO messages ...")
   ↓
4. Emit events to User B:

   a) new_message event:
   io.to(receiverSocket).emit('new_message', {
     id: 123,
     sender_id: 1,
     sender_name: "User A",
     message: "Hello!",
     created_at: "2025-10-05T12:00:00Z"
   });

   b) notification event:
   io.to(receiverSocket).emit('notification', {
     type: 'new_message',
     title: 'Neue Nachricht von User A',
     body: 'Hello!',
     data: {
       messageId: 123,
       senderId: 1,
       senderName: 'User A',
       url: '/messages'
     }
   });
   ↓
5. User B's client receives events:

   a) NotificationCenter adds to list:
   - Shows badge with unread count
   - Stores to localStorage

   b) ModernMessenger shows toast:
   - "Neue Nachricht von User A"
   - Click to view

   c) Desktop notification (if granted):
   - Browser notification with sound

   d) Sound plays (if enabled):
   - /sounds/notification.mp3
   ↓
6. User B clicks notification
   - Navigates to /messages
   - Opens conversation with User A
   - Message marked as read
   - Badge count updated
```

## 8. Testing Examples

### Test in Browser Console
```javascript
// 1. Check WebSocket connection
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => {
  console.log('Connected!');
});

// 2. Test notification
socket.on('notification', (data) => {
  console.log('Received notification:', data);
});

// 3. Send test message
socket.emit('send_message', {
  receiverId: 2,  // Another user ID
  message: 'Test notification',
  messageType: 'text'
});

// 4. Check notification permission
console.log('Permission:', Notification.permission);

// 5. Request permission
Notification.requestPermission().then(permission => {
  console.log('New permission:', permission);
});

// 6. Show test desktop notification
new Notification('Test', {
  body: 'This is a test notification',
  icon: '/favicon.ico'
});
```

## 9. Notification Examples by Type

### 💬 Message Notification
```javascript
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

### 📋 Task Notification
```javascript
{
  type: 'task_assigned',
  title: 'Neue Aufgabe zugewiesen',
  body: 'Wochenplanung abschließen wurde Ihnen zugewiesen',
  icon: '/favicon.ico',
  tag: 'task_42',
  data: {
    taskId: 42,
    taskTitle: 'Wochenplanung abschließen',
    priority: 'high',
    dueDate: '2025-10-12',
    url: '/dashboard'
  }
}
```

### 🗑️ Waste Disposal Notification
```javascript
{
  type: 'waste_disposal',
  title: 'Entsorgungserinnerung',
  body: 'Lösungsmittel - Kanister 140603: Entsorgung erforderlich',
  icon: '/favicon.ico',
  tag: 'waste_15',
  data: {
    wasteId: 15,
    wasteName: 'Lösungsmittel - Kanister 140603',
    scheduledDate: '2025-10-08',
    priority: 'critical',
    url: '/waste'
  }
}
```

### 📅 Calendar Event Notification
```javascript
{
  type: 'calendar_event',
  title: 'Terminerinnerung',
  body: 'Team Meeting beginnt in 15 Minuten',
  icon: '/favicon.ico',
  tag: 'event_88',
  data: {
    eventId: 88,
    eventTitle: 'Team Meeting',
    minutesUntil: 15,
    startTime: '2025-10-05T14:00:00Z',
    location: 'Konferenzraum A',
    url: '/dashboard'
  }
}
```

## 10. Feature Checklist

✅ **Backend:**
- [x] WebSocket emit `new_message` event
- [x] WebSocket emit `notification` event with full data
- [x] API endpoint GET `/api/messages/unread-count`
- [x] API endpoint GET `/api/messages/unread`
- [x] API endpoint POST `/api/messages/:id/mark-read`
- [x] Include sender info, message preview, timestamp

✅ **Frontend Components:**
- [x] NotificationCenter component
- [x] Bell icon with unread badge
- [x] Dropdown with last 10 notifications
- [x] Mark as read functionality
- [x] Mark all as read
- [x] Clear all notifications
- [x] Notification types (message, task, waste, event)
- [x] Click to navigate
- [x] Persist to localStorage

✅ **Notifications Utility:**
- [x] Browser Notification API wrapper
- [x] Request permission function
- [x] Show desktop notification
- [x] Notification types enum
- [x] Typed notifications (NEW_MESSAGE, TASK_ASSIGNED, etc.)
- [x] Preferences management

✅ **ModernMessenger Integration:**
- [x] Toast notification for new messages
- [x] Desktop notification support
- [x] Sound notification (optional)
- [x] WebSocket real-time updates
- [x] Only show when not on current conversation
- [x] Auto-mark as read when viewing

✅ **Header Integration:**
- [x] NotificationCenter in header
- [x] WebSocket connection
- [x] Real-time badge updates

✅ **User Preferences:**
- [x] Enable/disable notifications
- [x] Sound on/off
- [x] Volume control
- [x] Per-type preferences
- [x] LocalStorage persistence

✅ **Documentation:**
- [x] Comprehensive system documentation
- [x] Example notification events
- [x] API documentation
- [x] Usage examples
- [x] Testing guide

## Summary

Система сповіщень повністю впроваджена з усіма запитаними функціями:

1. ✅ Backend WebSocket notifications з повною інформацією
2. ✅ NotificationCenter компонент з bell icon і badge
3. ✅ Toast notifications в ModernMessenger
4. ✅ Desktop push notifications
5. ✅ Sound notifications (опціонально)
6. ✅ API endpoints для unread messages
7. ✅ Інтеграція в Header
8. ✅ LocalStorage persistence
9. ✅ Polling fallback
10. ✅ User preferences

Всі notification events включають детальну інформацію та підтримують навігацію до відповідних сторінок.
