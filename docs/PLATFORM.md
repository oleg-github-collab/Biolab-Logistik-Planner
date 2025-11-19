# Biolab Logistik Planner - Platform Documentation

## Overview

**Biolab Logistik Planner** is a comprehensive workplace management platform designed for Biolab laboratories. It integrates scheduling, task management, waste disposal tracking, knowledge base, messaging, and AI-powered assistance.

**Version:** 3.6
**Stack:** React (Frontend) + Node.js/Express (Backend) + PostgreSQL (Database) + Socket.IO (Real-time)
**Deployment:** Railway.app
**Primary Language:** German (DE)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Modules](#core-modules)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Authentication & Authorization](#authentication--authorization)
7. [Real-time Communication](#real-time-communication)
8. [AI Integration (BL_Bot)](#ai-integration-bl_bot)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  React SPA + WebSocket Client + Service Workers             │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         SERVER LAYER                         │
│  Express.js API + Socket.IO + JWT Auth + BL_Bot Service     │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                         │
│  PostgreSQL + Extensions (pgcrypto, uuid-ossp)              │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                       │
│  OpenAI API (BL_Bot) + Tenor GIF API + File Storage         │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Client Request** → HTTP/WebSocket
2. **Authentication Middleware** → JWT verification
3. **Route Handler** → Business logic
4. **Database Query** → PostgreSQL via `pg` pool
5. **Response** → JSON/WebSocket event
6. **Real-time Updates** → Socket.IO broadcast

---

## Core Modules

### 1. **Authentication & User Management**
- User registration, login, logout
- JWT token-based authentication
- Role-based access control (employee, admin, superadmin)
- User profiles with customizable settings
- First-login onboarding flow

### 2. **Scheduling System**
- Weekly work schedules
- Absence/vacation tracking
- Public holidays integration
- Working hours calculation
- Time blocks and breaks
- Team schedule overview

### 3. **Task Management**
- Personal task pool
- Kanban board with custom columns
- Task templates
- Task attachments and checklists
- Task comments
- Bulk actions
- Progress tracking

### 4. **Calendar & Events**
- Calendar events with recurring support
- Event templates
- Event conflicts detection
- Event breaks management
- Team calendar view
- Calendar-message linking

### 5. **Messaging System**
- Direct messages (1-on-1)
- Group conversations
- Message reactions
- Message pinning
- Message forwarding
- Voice messages
- File attachments
- GIF support (Tenor API)
- @mention system
- Quick replies
- Typing indicators
- Read receipts

### 6. **Knowledge Base**
- Article creation and editing
- Voice dictation for articles
- Article categories with colors
- Article versions and history
- Article feedback (helpful/not helpful)
- Article comments
- Search and filtering
- Featured/pinned articles

### 7. **Waste Management**
- Waste disposal tracking
- Waste categories
- Waste disposal planner
- Waste-task linking
- Waste-kanban integration
- Waste statistics

### 8. **Storage Bins (Kisten)**
- QR code auto-generation
- Barcode scanning
- Bin expiration tracking
- Calendar integration
- Barcode viewing gallery

### 9. **Notifications**
- Smart notifications with AI prioritization
- Notification grouping
- Notification preferences
- Notification actions
- Snooze functionality
- Real-time updates

### 10. **Stories**
- User stories (24-hour expiration)
- Story creation with media
- Story viewing tracking
- Story feed

### 11. **AI Assistant (BL_Bot)**
- OpenAI GPT-4 integration
- Context-aware responses
- Direct message support
- Group chat @mentions
- Scheduled reminders
- Waste disposal notifications

### 12. **Admin Panel**
- User management
- Audit logs
- System statistics
- Broadcast messages

---

## Key Features

### Real-time Features
- Live message updates
- Typing indicators
- Online/offline status
- Notification badges
- Task updates
- Calendar sync

### Mobile Optimization
- Responsive design
- Touch gestures
- Mobile-first UI
- Bottom navigation
- Swipeable galleries

### Accessibility
- Keyboard navigation
- Screen reader support
- ARIA labels
- Focus management

### Performance
- Database indexes
- Query optimization
- Connection pooling
- Client-side caching
- Lazy loading
- Code splitting

### Security
- Password hashing (bcrypt)
- JWT tokens with expiration
- CORS protection
- SQL injection prevention (parameterized queries)
- XSS protection
- HTTPS enforcement
- Audit logging

---

## Technology Stack

### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **State Management:** React Context + Hooks
- **HTTP Client:** Fetch API with custom wrapper
- **WebSocket:** Socket.IO Client
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Drag & Drop:** Custom implementation
- **Barcode:** Browser BarcodeDetector API
- **Audio:** Web Audio API
- **Build Tool:** Create React App

### Backend
- **Runtime:** Node.js v18
- **Framework:** Express.js
- **Database Client:** pg (node-postgres)
- **WebSocket:** Socket.IO
- **Authentication:** jsonwebtoken + bcrypt
- **File Upload:** multer
- **Logging:** Custom winston-based logger
- **Environment:** dotenv
- **Process Management:** PM2 (production)

### Database
- **Database:** PostgreSQL 15
- **Extensions:** uuid-ossp, pgcrypto
- **Connection Pooling:** pg Pool
- **Migrations:** Manual SQL files

### External Services
- **AI:** OpenAI API (GPT-4)
- **GIFs:** Tenor API
- **Deployment:** Railway.app
- **File Storage:** Local filesystem (/uploads)

---

## Project Structure

```
Biolab-Logistik-Planner/
├── client/                      # Frontend React application
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Calendar.js
│   │   │   ├── DirectMessenger.js
│   │   │   ├── KanbanBoard.js
│   │   │   ├── KistenManager.js
│   │   │   ├── NotificationCenter.js
│   │   │   ├── UserProfile.js
│   │   │   └── ... (80+ components)
│   │   ├── context/             # React Context providers
│   │   │   ├── AuthContext.js
│   │   │   └── WebSocketContext.js
│   │   ├── hooks/               # Custom React hooks
│   │   │   └── useMobile.js
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.js
│   │   │   ├── KnowledgeBase.js
│   │   │   ├── Login.js
│   │   │   └── Register.js
│   │   ├── styles/              # CSS modules
│   │   ├── utils/               # Utility functions
│   │   │   ├── api.js           # API client
│   │   │   └── soundEffects.js
│   │   ├── App.js               # Root component
│   │   └── index.js             # Entry point
│   └── package.json
│
├── server/                      # Backend Node.js application
│   ├── routes/                  # API route handlers
│   │   ├── auth.pg.js           # Authentication
│   │   ├── messages.pg.js       # Messaging
│   │   ├── tasks.pg.js          # Tasks
│   │   ├── kanban.pg.js         # Kanban board
│   │   ├── schedule.pg.js       # Scheduling
│   │   ├── knowledgeBase.pg.js  # Knowledge base
│   │   ├── kisten.pg.js         # Storage bins
│   │   ├── waste.pg.js          # Waste management
│   │   ├── notifications.pg.js  # Notifications
│   │   ├── admin.pg.js          # Admin panel
│   │   └── ... (16 route files)
│   ├── services/                # Business logic services
│   │   ├── blBot.js             # BL_Bot AI service
│   │   ├── botScheduler.js      # Bot scheduled tasks
│   │   ├── barcodeGenerator.js  # QR code generation
│   │   └── webSocketHandlers.js # Socket.IO handlers
│   ├── middleware/              # Express middleware
│   │   ├── auth.js              # JWT authentication
│   │   └── auditLog.js          # Audit logging
│   ├── migrations/              # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_task_pool_and_contacts.sql
│   │   └── ... (30+ migrations)
│   ├── utils/                   # Utility functions
│   │   ├── logger.js            # Winston logger
│   │   └── db.js                # Database pool
│   ├── config/                  # Configuration
│   │   └── database.js
│   ├── logs/                    # Log files
│   │   └── audit/
│   ├── server.js                # Entry point
│   └── package.json
│
├── uploads/                     # User-uploaded files
│   ├── attachments/
│   ├── voice/
│   ├── stories/
│   ├── avatars/
│   └── barcodes/
│
├── docs/                        # Documentation
│   ├── PLATFORM.md              # This file
│   ├── DATABASE.md              # Database schema
│   ├── API.md                   # API endpoints
│   ├── FRONTEND.md              # Frontend architecture
│   ├── BOT_KNOWLEDGE.md         # Bot knowledge base
│   └── QUICK_REFERENCE.md       # Quick reference
│
├── .env                         # Environment variables
├── .gitignore
├── package.json                 # Root package.json
└── README.md
```

---

## Authentication & Authorization

### JWT Authentication Flow

1. **Login:**
   ```
   POST /api/auth/login
   → Validate credentials
   → Generate JWT token
   → Return token + user data
   ```

2. **Token Verification:**
   ```
   Request Header: Authorization: Bearer <token>
   → Middleware extracts token
   → Verifies JWT signature
   → Decodes user data
   → Attaches to req.user
   ```

3. **Protected Routes:**
   All routes except `/api/auth/login` and `/api/auth/register` require authentication.

### Role Hierarchy

- **employee:** Basic user access
- **admin:** Can manage users, view audit logs
- **superadmin:** Full system access (not currently differentiated from admin)

### System User: BL_Bot

- **User ID:** 1
- **Email:** bl_bot@biolab.de
- **Role:** admin
- **Type:** is_system_user = true
- **Purpose:** AI assistant for automated responses and scheduled tasks

---

## Real-time Communication

### Socket.IO Events

#### Client → Server

| Event | Description | Payload |
|-------|-------------|---------|
| `typing:start` | User starts typing | `{ conversationId, userId, userName }` |
| `typing:stop` | User stops typing | `{ conversationId, userId }` |
| `message:read` | Mark message as read | `{ messageId, conversationId }` |
| `user:status` | Update user status | `{ status, statusMessage }` |

#### Server → Client

| Event | Description | Payload |
|-------|-------------|---------|
| `new-message` | New message received | `{ message, conversationId }` |
| `message-deleted` | Message deleted | `{ messageId, conversationId }` |
| `message-reaction` | Reaction added/removed | `{ messageId, reaction, userId }` |
| `typing:update` | Typing indicator | `{ conversationId, userId, userName, isTyping }` |
| `notification:new` | New notification | `{ notification }` |
| `user:online` | User came online | `{ userId }` |
| `user:offline` | User went offline | `{ userId }` |

### WebSocket Connection

```javascript
// Client
const socket = io(API_BASE_URL, {
  auth: { token: localStorage.getItem('token') }
});

// Server
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify token...
});
```

---

## AI Integration (BL_Bot)

### Overview

BL_Bot is an AI assistant powered by OpenAI GPT-4, designed to help users with:
- Task management
- Schedule queries
- Knowledge base search
- Waste disposal reminders
- General workplace assistance

### Initialization

**File:** `server/services/blBot.js`

```javascript
class BLBot {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.botId = 1; // User ID of BL_Bot
    this.botName = 'BL_Bot';
  }
}
```

### Message Processing Flow

1. **User sends message** to BL_Bot (direct or @mention in group)
2. **Server detects** bot should respond
3. **getUserContext()** fetches user's tasks, events, notifications
4. **generateAIResponse()** calls OpenAI with context
5. **Bot sends response** via messaging system
6. **Real-time update** via WebSocket

### Bot Behavior

- **Direct Messages:** Responds to all messages
- **Group Chats:** Responds only when @mentioned (`@BL_Bot`)
- **Context-Aware:** Uses user's tasks, schedule, and notifications
- **Scheduled Tasks:** Sends reminders for waste disposal, bin expiration

### Scheduled Jobs

**File:** `server/services/botScheduler.js`

- **Daily 8:00 AM:** Check waste disposal reminders
- **Daily 9:00 AM:** Check storage bin expirations

---

## Environment Variables

**File:** `.env`

```bash
# Server
PORT=8080
NODE_ENV=production

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://...
PGHOST=gondola.proxy.rlwy.net
PGPORT=33866
PGUSER=postgres
PGPASSWORD=...
PGDATABASE=railway

# Authentication
JWT_SECRET=your-secret-key

# OpenAI
OPENAI_API_KEY=sk-...

# Tenor GIF API
TENOR_API_KEY=...

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

---

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd client && npm install
cd ../server && npm install

# Start backend (port 8080)
cd server
npm start

# Start frontend (port 3000)
cd client
npm start
```

### Production (Railway)

```bash
# Build frontend
cd client
npm run build

# Start server (serves static build)
cd ../server
npm start
```

---

## Next Steps

- See [DATABASE.md](./DATABASE.md) for complete database schema
- See [API.md](./API.md) for all API endpoints
- See [FRONTEND.md](./FRONTEND.md) for component documentation
- See [BOT_KNOWLEDGE.md](./BOT_KNOWLEDGE.md) for BL_Bot user guide
- See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for common tasks

---

**Last Updated:** 2025-11-19
**Maintained By:** Development Team
