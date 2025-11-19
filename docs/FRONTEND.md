# Frontend Documentation - Biolab Logistik Planner

## Table of Contents

1. [Application Architecture](#application-architecture)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [State Management](#state-management)
5. [Routing](#routing)
6. [Component Categories](#component-categories)
7. [Major Components](#major-components)
8. [Context Providers](#context-providers)
9. [Custom Hooks](#custom-hooks)
10. [Utilities](#utilities)
11. [API Integration](#api-integration)
12. [Real-time Features](#real-time-features)
13. [Styling Approach](#styling-approach)
14. [Performance Optimizations](#performance-optimizations)
15. [Best Practices](#best-practices)
16. [Mobile-First Design](#mobile-first-design)

---

## Application Architecture

The Biolab Logistik Planner frontend is a **React 18.2** single-page application (SPA) built with modern patterns and best practices. The architecture follows a component-based approach with clear separation of concerns.

### Component Hierarchy

```
App.js (Root)
├── LocaleProvider (Internationalization)
│   ├── AuthProvider (Authentication State)
│   │   └── WebSocketProvider (Real-time Communication)
│   │       └── Router
│   │           ├── ErrorBoundary
│   │           ├── Header (Navigation)
│   │           ├── Routes (Page Components)
│   │           ├── Footer
│   │           ├── MobileBottomNav
│   │           └── CookieConsent
```

### Key Architectural Patterns

1. **Context-Based State Management**: Uses React Context API for global state (Auth, WebSocket, Locale)
2. **Protected Routes**: Authentication and role-based access control
3. **Error Boundaries**: Global error handling and recovery
4. **Real-time Updates**: WebSocket integration for live data
5. **Mobile-First Responsive**: Adaptive UI for mobile and desktop
6. **Optimistic Updates**: Immediate UI feedback with server reconciliation

---

## Technology Stack

### Core Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.15.0",
  "axios": "^1.5.0",
  "socket.io-client": "^4.8.1",
  "date-fns": "^2.30.0",
  "react-hot-toast": "^2.6.0",
  "lucide-react": "^0.548.0"
}
```

### UI Libraries

- **Tailwind CSS**: Utility-first CSS framework
- **@hello-pangea/dnd**: Drag-and-drop functionality (Kanban board)
- **react-big-calendar**: Calendar component
- **react-markdown**: Markdown rendering
- **highlight.js**: Code syntax highlighting

### Development Tools

- **react-scripts**: Create React App build tooling
- **Node.js Proxy**: Development proxy to backend (http://localhost:5000)

---

## Project Structure

```
client/src/
├── components/          # Reusable UI components (80+ components)
│   ├── Calendar.js
│   ├── DirectMessenger.js
│   ├── ImprovedKanbanBoard.js
│   ├── KistenManager.js
│   ├── NotificationCenter.js
│   ├── Header.js
│   ├── Footer.js
│   ├── ErrorBoundary.js
│   └── ...
├── pages/              # Page-level components
│   ├── Dashboard.js
│   ├── Messages.js
│   ├── Kanban.js
│   ├── Schedule.js
│   ├── KistenManagement.js
│   ├── KnowledgeBase.js
│   ├── Admin.js
│   └── ...
├── context/            # React Context providers
│   ├── AuthContext.js
│   ├── WebSocketContext.js
│   └── LocaleContext.js
├── hooks/              # Custom React hooks
│   ├── useWebSocket.js
│   ├── useMobile.js
│   ├── usePermissions.js
│   └── ...
├── utils/              # Utility functions
│   ├── api.js
│   ├── apiEnhanced.js
│   ├── calendarApi.js
│   ├── kanbanApi.js
│   ├── soundEffects.js
│   ├── notifications.js
│   └── ...
├── styles/             # CSS files
│   ├── index.css
│   ├── calendar.css
│   ├── desktop-header.css
│   └── mobile/
│       ├── mobile-global.css
│       ├── mobile-bottom-nav.css
│       └── ...
├── App.js              # Root component
└── index.js            # Application entry point
```

---

## State Management

### Context Providers

The application uses three main context providers for global state management:

#### 1. AuthContext

**Location**: `/client/src/context/AuthContext.js`

Manages authentication state and user information.

```javascript
const AuthContext = createContext();

// State structure
{
  user: {
    id: number,
    name: string,
    email: string,
    role: 'user' | 'employee' | 'admin' | 'superadmin' | 'observer',
    employment_type: 'Vollzeit' | 'Teilzeit' | 'Minijob',
    profile_photo: string,
    first_login_completed: boolean
  },
  token: string,
  isAuthenticated: boolean,
  loading: boolean
}
```

**Methods**:
- `login(token, user)`: Authenticate user
- `logout()`: Clear authentication
- `hasRole(roles)`: Check user role
- `canAssignTasks()`: Check task assignment permission
- `canManageUsers()`: Check user management permission
- `isEmployee()`: Check employee status

**Usage**:
```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;

  return <div>Welcome {user.name}</div>;
}
```

#### 2. WebSocketContext

**Location**: `/client/src/context/WebSocketContext.js`

Provides WebSocket connection and real-time event handling.

```javascript
// WebSocket methods
{
  isConnected: boolean,
  messages: Array,
  onlineUsers: Array,
  notifications: Array,
  taskEvents: Array,
  adminEvents: Array,
  sendMessage: (receiverId, message, messageType) => void,
  markAsRead: (messageId) => void,
  startTyping: (receiverId) => void,
  stopTyping: (receiverId) => void,
  showNotification: (title, body, options) => void,
  onTaskEvent: (eventType, handler) => cleanup,
  onConversationEvent: (eventType, handler) => cleanup,
  onAdminEvent: (eventType, handler) => cleanup,
  joinConversationRoom: (conversationId) => void,
  leaveConversationRoom: (conversationId) => void
}
```

**Usage**:
```javascript
import { useWebSocketContext } from '../context/WebSocketContext';

function MyComponent() {
  const { isConnected, onTaskEvent } = useWebSocketContext();

  useEffect(() => {
    const cleanup = onTaskEvent('task:created', (task) => {
      console.log('New task created:', task);
    });
    return cleanup;
  }, [onTaskEvent]);
}
```

#### 3. LocaleContext

**Location**: `/client/src/context/LocaleContext.js`

Manages internationalization (i18n) state.

```javascript
{
  locale: 'de' | 'en',
  setLocale: (locale) => void,
  t: (key, variables) => string
}
```

**Usage**:
```javascript
import { useLocale } from '../context/LocaleContext';

function MyComponent() {
  const { t, locale, setLocale } = useLocale();

  return (
    <div>
      <h1>{t('navigation.dashboard')}</h1>
      <button onClick={() => setLocale('en')}>English</button>
    </div>
  );
}
```

### Local State Patterns

Components use `useState` and `useReducer` for local state management:

```javascript
// Simple state
const [loading, setLoading] = useState(false);

// Complex state with reducer
const [state, dispatch] = useReducer(reducer, initialState);
```

---

## Routing

### Route Configuration

**Location**: `/client/src/App.js`

```javascript
<Routes>
  {/* Public Routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/first-setup" element={<FirstSetup />} />

  {/* Protected Routes */}
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Header />
      <Dashboard />
    </ProtectedRoute>
  } />

  <Route path="/messages" element={
    <ProtectedRoute>
      <Header />
      <Messages />
    </ProtectedRoute>
  } />

  {/* Admin Routes */}
  <Route path="/admin" element={
    <AdminRoute>
      <Header />
      <Admin />
    </AdminRoute>
  } />

  {/* Default Redirect */}
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

### Route Guards

#### ProtectedRoute

Ensures user is authenticated and handles first-login flow.

```javascript
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [showFirstLogin, setShowFirstLogin] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.first_login_completed) {
    return (
      <>
        {children}
        <FirstLoginFlow onComplete={() => setShowFirstLogin(false)} />
      </>
    );
  }

  return children;
};
```

#### AdminRoute

Restricts access to admin and superadmin users.

```javascript
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!['admin', 'superadmin'].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
```

### Navigation Patterns

The application uses declarative navigation:

```javascript
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  // Programmatic navigation
  navigate('/dashboard');

  // Navigation with state
  navigate('/dashboard', {
    state: { focusEventId: 123 }
  });

  // Replace history
  navigate('/login', { replace: true });
}
```

---

## Component Categories

### Pages vs Components

**Pages** (`/pages`): Top-level route components that represent entire views
- Dashboard.js
- Messages.js
- Kanban.js
- Schedule.js
- Admin.js

**Components** (`/components`): Reusable UI components
- Header.js
- Footer.js
- Calendar.js
- DirectMessenger.js

### Smart vs Presentational Components

**Smart Components** (Container Components):
- Manage state and business logic
- Connect to context/hooks
- Handle data fetching
- Example: `DirectMessenger`, `ImprovedKanbanBoard`

**Presentational Components**:
- Receive data via props
- Focus on UI rendering
- Minimal logic
- Example: `LoadingSpinner`, `SkeletonLoader`

### Shared/Reusable Components

**Layout Components**:
- Header.js
- Footer.js
- MobileBottomNav.js
- ErrorBoundary.js

**UI Components**:
- LoadingSpinner.js
- SkeletonLoader.js
- Toast notifications
- Modal components

---

## Major Components

### Dashboard Component

**Location**: `/client/src/pages/Dashboard.js`

The main landing page with calendar view and event management.

**Features**:
- Calendar view (desktop) with multiple views (month/week/day)
- Mobile event calendar with simplified UI
- Event creation, editing, deletion
- Event filtering by type and priority
- Absence reporting for full-time employees
- Real-time event updates via WebSocket

**State**:
```javascript
{
  selectedDate: Date,
  activeTab: 'calendar',
  events: Array<Event>,
  selectedEvent: Event | null,
  showEventFormModal: boolean,
  showEventDetailsModal: boolean,
  eventTypeFilter: string | null,
  priorityFilter: string | null
}
```

**Key Methods**:
- `handleEventSave()`: Create/update events
- `handleEventDelete()`: Delete events
- `handleEventDuplicate()`: Duplicate events
- `refetchEvents()`: Reload calendar data

**Props**: None (top-level page)

### DirectMessenger Component

**Location**: `/client/src/components/DirectMessenger.js`

Full-featured messaging system with direct messages, group chats, and stories.

**Features**:
- Real-time messaging via WebSocket
- Contact list with online status
- Message threads (conversations)
- GIF picker integration
- Voice recording
- File attachments
- Message reactions
- Quick replies
- Story feed (Instagram-style)
- Calendar event sharing
- Message search
- Pinned messages

**State**:
```javascript
{
  contacts: Array<User>,
  threads: Array<Thread>,
  selectedContact: User | null,
  selectedThreadId: number | null,
  messages: Array<Message>,
  messageInput: string,
  searchTerm: string,
  pendingAttachments: Array<File>,
  isRecording: boolean,
  showGifPicker: boolean
}
```

**WebSocket Events**:
- `conversation:new_message`: Incoming message
- `conversation:message_confirmed`: Message delivery confirmation
- `conversation:members_updated`: Group member changes
- `message:reaction`: Message reaction added
- `message:mentioned`: User mentioned in message

### ImprovedKanbanBoard Component

**Location**: `/client/src/components/ImprovedKanbanBoard.js`

Drag-and-drop task board with real-time collaboration.

**Features**:
- 5 columns: Backlog, Todo, In Progress, Review, Done
- Drag-and-drop task movement
- Real-time task updates
- Collaborative editing indicators
- Task filtering and search
- Priority badges
- Task templates
- Bulk actions
- Mobile swipe gestures

**State**:
```javascript
{
  tasks: Array<Task>,
  columns: Array<Column>,
  selectedTask: Task | null,
  showTaskModal: boolean,
  filters: {
    search: string,
    priority: string,
    assignee: string
  },
  editingUsers: Map<taskId, User>
}
```

**Drag and Drop**:
Uses `@hello-pangea/dnd` library for drag-and-drop functionality.

```javascript
const onDragEnd = (result) => {
  const { source, destination, draggableId } = result;

  if (!destination) return;

  // Update task status
  await updateTask(draggableId, {
    status: destination.droppableId
  });
};
```

### Calendar Component

**Location**: `/client/src/components/Calendar.js`

Weekly calendar view with events and schedule display.

**Props**:
```javascript
{
  weekStart: Date,
  selectedDay: Date,
  onDaySelect: (day: Date) => void,
  scheduleData: Object,
  events: Array<Event>,
  onEventClick: (event: Event) => void
}
```

**Features**:
- 7-day week view
- Color-coded day status
- Working hours display
- Event indicators
- Hover effects
- Today highlighting

### KistenManager Component

**Location**: `/client/src/components/KistenManager.js`

Storage bin management with barcode scanning.

**Features**:
- Barcode scanner integration (Web API)
- QR code generation and display
- Manual code entry
- Due date tracking
- Status filtering (pending, due soon, overdue, completed)
- Sound effects for scanning
- Batch operations

**Barcode Detection**:
```javascript
useEffect(() => {
  if ('BarcodeDetector' in window) {
    setDetectorSupported(true);
    detectorRef.current = new window.BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'code_128']
    });
  }
}, []);
```

### NotificationCenter Component

**Location**: `/client/src/components/NotificationCenter.js`

Notification management with browser notifications.

**Features**:
- Notification dropdown
- Unread count badge
- Mark as read/unread
- Clear all notifications
- Desktop notifications
- Notification preferences
- Real-time updates via WebSocket

**Browser Notifications**:
```javascript
const showNotification = async (title, body, options) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    });
  }
};
```

### Header Component

**Location**: `/client/src/components/Header.js`

Application header with navigation and user menu.

**Features**:
- Desktop navigation (tabs)
- Mobile hamburger menu
- Global search
- Notification dropdown
- User profile dropdown
- Logo and branding
- Responsive design

**Navigation**:
```javascript
const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'navigation.dashboard', icon: '📊' },
  { to: '/messages', labelKey: 'navigation.messages', icon: '💬' },
  { to: '/kanban', labelKey: 'navigation.tasks', icon: '✓' },
  { to: '/kisten', labelKey: 'navigation.kisten', icon: '📦' },
  // ...
];
```

### ErrorBoundary Component

**Location**: `/client/src/components/ErrorBoundary.js`

Global error handling and recovery.

**Features**:
- Catches React errors
- Displays user-friendly error UI
- Shows error details in development
- Error logging to console/service
- Reset and reload actions
- Session storage for debugging

---

## Context Providers

### AuthProvider

**Purpose**: Manages user authentication state

**Implementation**:
```javascript
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const loadUser = async () => {
      if (state.token) {
        try {
          const res = await getUser();
          dispatch({ type: 'LOAD_USER', payload: res.data });
        } catch (err) {
          dispatch({ type: 'USER_ERROR' });
          localStorage.removeItem('token');
        }
      }
    };
    loadUser();
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ state, login, logout, ... }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### WebSocketProvider

**Purpose**: Provides WebSocket connection and event handling

**Implementation**:
```javascript
export const WebSocketProvider = ({ children }) => {
  const socketValue = useWebSocket();
  const memoizedValue = useMemo(() => socketValue, [socketValue]);

  return (
    <WebSocketContext.Provider value={memoizedValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

The actual WebSocket logic is in `useWebSocket` hook.

### LocaleProvider

**Purpose**: Manages internationalization

**Implementation**:
```javascript
export const LocaleProvider = ({ children, defaultLocale = 'de' }) => {
  const [locale, setLocale] = useState(() => {
    const stored = localStorage.getItem('locale');
    return stored || defaultLocale;
  });

  const translateFn = useCallback(
    (key, variables = {}) => translate(key, locale, variables),
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translateFn }}>
      {children}
    </LocaleContext.Provider>
  );
};
```

---

## Custom Hooks

### useWebSocket

**Location**: `/client/src/hooks/useWebSocket.js`

**Purpose**: Manages WebSocket connection and events

**Features**:
- Auto-reconnection with exponential backoff
- Heartbeat mechanism
- Event listener registration
- Online user tracking
- Message handling
- Notification handling
- Task event broadcasting

**Usage**:
```javascript
const useWebSocket = () => {
  const { isAuthenticated, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => socket.disconnect();
  }, [isAuthenticated, token]);

  return { isConnected, sendMessage, onTaskEvent, ... };
};
```

### useMobile

**Location**: `/client/src/hooks/useMobile.js`

**Purpose**: Detects mobile devices and screen orientation

**Returns**:
```javascript
{
  isMobile: boolean,     // < 768px
  isTablet: boolean,     // 768px - 1024px
  isDesktop: boolean,    // > 1024px
  orientation: 'portrait' | 'landscape'
}
```

**Usage**:
```javascript
const { isMobile, orientation } = useMobile();

if (isMobile) {
  return <MobileEventCalendar />;
}
return <DesktopCalendar />;
```

### usePermissions

**Location**: `/client/src/hooks/usePermissions.js`

**Purpose**: Role-based access control

**Methods**:
```javascript
{
  hasPermission: (permission: string) => boolean,
  hasAllPermissions: (...permissions: string[]) => boolean,
  hasAnyPermission: (...permissions: string[]) => boolean,
  hasRole: (...roles: string[]) => boolean,
  isAdmin: () => boolean,
  isSuperAdmin: () => boolean,
  isEmployee: () => boolean,
  ownsResource: (resourceUserId: number) => boolean
}
```

**Permissions**:
- `schedule:read`, `schedule:create`, `schedule:update`, `schedule:delete`
- `message:read`, `message:send`, `message:delete`
- `task:read`, `task:create`, `task:update`, `task:delete`, `task:assign`
- `user:read`, `user:create`, `user:update`, `user:delete`, `user:role`
- `waste:read`, `waste:create`, `waste:update`, `waste:delete`
- `system:settings`, `system:logs`

**Usage**:
```javascript
const { hasPermission, isAdmin } = usePermissions();

if (hasPermission('task:create')) {
  return <CreateTaskButton />;
}

// Component wrapper
<PermissionGate permission="user:read">
  <UserManagement />
</PermissionGate>
```

---

## Utilities

### API Client

**Location**: `/client/src/utils/api.js`

**Base Configuration**:
```javascript
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000/api'
    : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Request Interceptor**:
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Response Interceptor**:
- Network error retry with exponential backoff
- Silent fail for certain endpoints
- Error logging

**Exported Functions**:

**Auth**:
- `login(email, password)`
- `register(name, email, password, role)`
- `getUser()`
- `checkFirstSetup()`

**Schedule**:
- `getCurrentWeek()`
- `getMySchedule()`
- `updateDaySchedule(dayOfWeek, startTime, endTime, status)`
- `getTeamSchedule()`
- `getArchivedSchedules()`

**Events**:
- `getEvents(start, end, type, priority)`
- `createEvent(eventData)`
- `updateEvent(id, eventData)`
- `deleteEvent(id)`
- `duplicateEvent(id, newDate)`
- `createBulkEvents(events)`

**Tasks**:
- `getTasks(status)`
- `createTask(taskData)`
- `updateTask(id, taskData)`
- `deleteTask(id)`

**Messages**:
- `getMessages()`
- `getUnreadCount()`
- `sendMessage(receiverId, message, isGroup)`
- `getUsersForMessaging()`

**Waste**:
- `getWasteCategories()`
- `getWasteItems()`
- `createWasteItem(...)`
- `updateWasteItem(...)`
- `deleteWasteItem(id)`

**Waste Templates**:
- `getWasteTemplates()`
- `createWasteTemplate(templateData)`
- `updateWasteTemplate(id, templateData)`
- `deleteWasteTemplate(id)`

**Admin**:
- `getAllUsers()`
- `updateUser(id, userData)`
- `deleteUser(id)`

### Enhanced API Client

**Location**: `/client/src/utils/apiEnhanced.js`

Additional API endpoints for advanced features:

**User Profile**:
- `getUserProfile(userId)`
- `updateUserProfile(userId, profileData)`
- `uploadProfilePhoto(userId, formData)`
- `getAllContacts(params)`

**Notifications**:
- `getNotifications(params)`
- `getUnreadCount()`
- `markNotificationAsRead(notificationId)`
- `markAllNotificationsAsRead(type)`
- `clearAllReadNotifications()`

**Stories**:
- `getUserStories(userId)`
- `uploadProfileStory(userId, formData)`
- `getStoriesFeed()`
- `markStoryViewed(storyId)`

**Conversations**:
- `getMessageThreads()`
- `getConversationMessages(conversationId)`
- `sendConversationMessage(conversationId, content, ...)`
- `createConversationThread(participants, ...)`

**Storage Bins**:
- `getStorageBins()`
- `createStorageBins(codes, comment, keepUntil)`
- `completeStorageBin(id)`

### Sound Effects

**Location**: `/client/src/utils/soundEffects.js`

Web Audio API-based sound effects for scanner and UI interactions.

**Functions**:
```javascript
playSuccessBeep()        // Scanner success beep (1000 Hz)
playErrorBeep()          // Scanner error beep (400 Hz)
playDoubleBeep()         // Special actions
playConfirmationBeep()   // Ascending tone (800-1200 Hz)
```

**Usage**:
```javascript
import { playSuccessBeep, playErrorBeep } from '../utils/soundEffects';

// On successful scan
playSuccessBeep();

// On error
playErrorBeep();
```

### Date Protection

**Location**: `/client/src/utils/setupDateProtection.js`

Protects against date format issues by intercepting Date methods.

**Setup** (in index.js):
```javascript
import { setupDateProtection } from './utils/setupDateProtection';
setupDateProtection(); // Must be called BEFORE React renders
```

---

## API Integration

### Request Flow

1. **Component initiates request**
2. **API utility function called**
3. **Axios request interceptor adds auth token**
4. **Request sent to backend**
5. **Response interceptor handles errors/retries**
6. **Data returned to component**
7. **Component updates state**

### Error Handling

**Network Errors**:
- Automatic retry with exponential backoff (up to 3 attempts)
- Silent fail for non-critical endpoints (unread counts)

**Authentication Errors**:
- 401 responses trigger logout
- Redirect to login page

**Validation Errors**:
- Display user-friendly error messages
- Form field highlighting

**Example**:
```javascript
try {
  const result = await createEvent(eventData);
  showToast({ type: 'success', title: 'Event created' });
} catch (err) {
  console.error('Error creating event:', err);
  showToast({
    type: 'error',
    title: 'Failed to create event',
    message: err.response?.data?.message || 'Please try again'
  });
}
```

### Request Cancellation

Not currently implemented, but can be added using Axios cancel tokens:

```javascript
const source = axios.CancelToken.source();

api.get('/endpoint', {
  cancelToken: source.token
});

// Cancel request
source.cancel('Operation canceled');
```

---

## Real-time Features

### WebSocket Integration

**Connection**:
```javascript
const socket = io(wsUrl, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});
```

### Event Handling

**Task Events**:
```javascript
socket.on('task:created', (data) => {
  // Update task list
  setTasks(prev => [...prev, data]);

  // Trigger registered handlers
  const handlers = taskEventHandlersRef.current.get('task:created');
  handlers?.forEach(handler => handler(data));
});
```

**Message Events**:
```javascript
socket.on('conversation:new_message', (payload) => {
  // Update messages
  setMessages(prev => [...prev, payload.message]);

  // Show notification
  showNotification(payload.sender.name, payload.content);
});
```

**Online Status**:
```javascript
socket.on('online_users', (users) => {
  setOnlineUsers(users);
});

socket.on('user_online', (data) => {
  setOnlineUsers(prev => [...prev, data]);
});

socket.on('user_offline', (data) => {
  setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
});
```

### Heartbeat Mechanism

```javascript
socket.on('connect', () => {
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    }
  }, 30000); // Every 30 seconds
});
```

### Connection Management

**Auto-Reconnection**:
```javascript
socket.on('connect_error', (error) => {
  reconnectAttemptsRef.current++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
});
```

**Cleanup**:
```javascript
useEffect(() => {
  // Setup socket
  const socket = connectWebSocket();

  return () => {
    // Cleanup on unmount
    if (socket.heartbeatInterval) {
      clearInterval(socket.heartbeatInterval);
    }
    socket.disconnect();
  };
}, [token]);
```

---

## Styling Approach

### Tailwind CSS

The application uses **Tailwind CSS** as the primary styling framework.

**Configuration**:
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: { /* custom colors */ },
      spacing: { /* custom spacing */ }
    }
  }
};
```

**Utility Classes**:
```jsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
  Click me
</button>
```

### CSS Variables

Custom properties for theming:

```css
:root {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --text-primary: #0f172a;
  --accent-primary: #3b82f6;
  --border-radius-xl: 1rem;
  --transition-normal: 0.3s ease;
}
```

### CSS Modules

Component-specific styles in separate CSS files:

**Files**:
- `calendar.css`: Calendar-specific styles
- `desktop-header.css`: Header styles
- `messenger-enhanced.css`: Messenger styles
- `mobile/*.css`: Mobile-specific styles

### Mobile Styles

Dedicated mobile CSS modules for responsive design:

```
styles/mobile/
├── mobile-global.css
├── mobile-scroll-fix.css
├── mobile-bottom-nav.css
├── mobile-header.css
├── mobile-calendar.css
├── mobile-messenger.css
├── mobile-forms.css
├── mobile-modals.css
└── mobile-kanban.css
```

**Example**:
```css
/* mobile-bottom-nav.css */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: white;
  border-top: 1px solid var(--border);
  z-index: var(--z-sticky);
}
```

### Responsive Design

**Breakpoints**:
- Mobile: `< 768px`
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`

**Media Queries**:
```css
/* Mobile-first approach */
.container {
  padding: 1rem;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

**Tailwind Responsive Classes**:
```jsx
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>
```

---

## Performance Optimizations

### Code Splitting

**React.lazy** for lazy loading:
```javascript
const AdminPanel = React.lazy(() => import('./pages/Admin'));

<Suspense fallback={<LoadingSpinner />}>
  <AdminPanel />
</Suspense>
```

### Memoization

**React.memo** for component memoization:
```javascript
const TaskCard = memo(({ task, onTaskClick }) => {
  return <div onClick={() => onTaskClick(task)}>{task.title}</div>;
});
```

**useMemo** for expensive calculations:
```javascript
const filteredTasks = useMemo(() => {
  return tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [tasks, searchTerm]);
```

**useCallback** for function memoization:
```javascript
const handleEventSave = useCallback(async (eventData) => {
  await createEvent(eventData);
  refetchEvents();
}, [refetchEvents]);
```

### Virtual Scrolling

Not currently implemented, but recommended for large lists:

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>{items[index]}</div>
  )}
</FixedSizeList>
```

### Optimistic Updates

Update UI immediately, then sync with server:

```javascript
const handleTaskMove = async (taskId, newStatus) => {
  // Optimistic update
  setTasks(prev => prev.map(task =>
    task.id === taskId ? { ...task, status: newStatus } : task
  ));

  try {
    // Sync with server
    await updateTask(taskId, { status: newStatus });
  } catch (err) {
    // Rollback on error
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, status: task.originalStatus } : task
    ));
  }
};
```

### Debouncing and Throttling

**Debounce** search input:
```javascript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch);
  }
}, [debouncedSearch]);
```

### Image Optimization

**Lazy loading**:
```jsx
<img
  src={imageUrl}
  alt="Description"
  loading="lazy"
/>
```

**Responsive images**:
```jsx
<img
  srcSet={`
    ${image_small} 400w,
    ${image_medium} 800w,
    ${image_large} 1200w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
  src={image_medium}
  alt="Description"
/>
```

---

## Best Practices

### Component Structure

**File Organization**:
```javascript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// 2. Constants
const COLUMNS = [...];

// 3. Helper functions
const formatDate = (date) => { ... };

// 4. Component
const MyComponent = ({ prop1, prop2 }) => {
  // 5. Hooks
  const { user } = useAuth();
  const [state, setState] = useState(null);

  // 6. Effects
  useEffect(() => { ... }, []);

  // 7. Event handlers
  const handleClick = () => { ... };

  // 8. Render
  return <div>...</div>;
};

// 9. Export
export default MyComponent;
```

### Naming Conventions

**Components**: PascalCase
```javascript
UserProfile.js
DirectMessenger.js
KanbanBoard.js
```

**Functions/Variables**: camelCase
```javascript
const handleClick = () => {};
const userData = {};
```

**Constants**: UPPER_SNAKE_CASE
```javascript
const API_BASE_URL = '...';
const MAX_RETRIES = 3;
```

**Event Handlers**: `handle` prefix
```javascript
handleSubmit()
handleChange()
handleClick()
```

**Boolean Props**: `is`, `has`, `should` prefix
```javascript
isLoading
hasPermission
shouldRefresh
```

### Props Validation

Use PropTypes (or TypeScript):
```javascript
import PropTypes from 'prop-types';

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  onSave: PropTypes.func,
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string
  }))
};

MyComponent.defaultProps = {
  onSave: () => {},
  items: []
};
```

### State Management

**Don't mutate state directly**:
```javascript
// Bad
state.items.push(newItem);

// Good
setState(prev => [...prev, newItem]);
```

**Use functional updates for dependent state**:
```javascript
// Bad
setState(state + 1);

// Good
setState(prev => prev + 1);
```

**Batch state updates**:
```javascript
// React 18 automatically batches
setLoading(true);
setError(null);
setData(result);
// All batched into single re-render
```

### Effect Dependencies

Always include all dependencies:
```javascript
useEffect(() => {
  fetchData(userId);
}, [userId]); // Include userId
```

### Error Handling

**Try-catch for async operations**:
```javascript
const fetchData = async () => {
  try {
    const result = await api.getData();
    setData(result);
  } catch (err) {
    console.error('Error fetching data:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

**Error boundaries for component errors**:
```jsx
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### Accessibility

**Semantic HTML**:
```jsx
<button>Click me</button>  // Good
<div onClick={...}>Click me</div>  // Bad
```

**ARIA labels**:
```jsx
<button aria-label="Close modal" onClick={onClose}>
  <X />
</button>
```

**Keyboard navigation**:
```jsx
<input
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleSubmit();
  }}
/>
```

---

## Mobile-First Design

### Responsive Components

**Conditional Rendering**:
```javascript
const { isMobile } = useMobile();

if (isMobile) {
  return <MobileEventCalendar />;
}
return <DesktopCalendar />;
```

**Responsive Classes**:
```jsx
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-2xl md:text-3xl lg:text-4xl">
    Title
  </h1>
</div>
```

### Touch Interactions

**Swipe Gestures**:
```javascript
const { onTouchStart, onTouchMove, onTouchEnd } = useTouch();

<div
  onTouchStart={onTouchStart}
  onTouchMove={onTouchMove}
  onTouchEnd={() => onTouchEnd(onSwipeLeft, onSwipeRight)}
>
  Swipeable content
</div>
```

**Long Press**:
```javascript
const [touchTimer, setTouchTimer] = useState(null);

const handleTouchStart = () => {
  const timer = setTimeout(() => {
    handleLongPress();
  }, 500);
  setTouchTimer(timer);
};

const handleTouchEnd = () => {
  clearTimeout(touchTimer);
};
```

### Mobile Navigation

**Bottom Navigation**:
```jsx
<MobileBottomNav>
  <NavItem to="/dashboard" icon={<Home />} label="Dashboard" />
  <NavItem to="/messages" icon={<MessageCircle />} label="Messages" />
  <NavItem to="/kanban" icon={<CheckSquare />} label="Tasks" />
  <NavItem to="/profile" icon={<User />} label="Profile" />
</MobileBottomNav>
```

**Drawer Menu**:
```jsx
<Drawer open={menuOpen} onClose={() => setMenuOpen(false)}>
  <nav>
    <Link to="/dashboard">Dashboard</Link>
    <Link to="/messages">Messages</Link>
  </nav>
</Drawer>
```

### Scroll Handling

**Scroll Lock**:
```javascript
const { lockScroll, unlockScroll } = useScrollLock();

useEffect(() => {
  if (modalOpen) {
    lockScroll();
  }
  return () => unlockScroll();
}, [modalOpen]);
```

**Infinite Scroll**:
```javascript
const handleScroll = () => {
  const bottom =
    Math.ceil(window.innerHeight + window.scrollY) >=
    document.documentElement.scrollHeight;

  if (bottom && !loading) {
    loadMore();
  }
};

useEffect(() => {
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [loading]);
```

### Viewport Units

**Safe Area Insets**:
```css
.mobile-header {
  padding-top: env(safe-area-inset-top);
}

.mobile-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

**Viewport Height**:
```css
.mobile-container {
  height: 100vh;
  height: -webkit-fill-available; /* Mobile Safari */
}
```

---

## Conclusion

The Biolab Logistik Planner frontend is a modern, scalable React application with:

- **80+ Components** organized by purpose
- **Real-time features** via WebSocket
- **Mobile-first responsive design**
- **Role-based access control**
- **Comprehensive error handling**
- **Performance optimizations**
- **Internationalization support**

For backend documentation, see [BACKEND.md](./BACKEND.md).

For API documentation, see [API.md](./API.md).

---

**Last Updated**: 2025-01-19
**Version**: 0.1.1
