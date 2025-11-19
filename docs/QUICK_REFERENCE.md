# Quick Reference Guide

**Biolab Logistik Planner - Developer Quick Reference**

---

## Table of Contents

1. [Common Tasks](#common-tasks)
2. [Database Quick Reference](#database-quick-reference)
3. [API Quick Reference](#api-quick-reference)
4. [Frontend Component Reference](#frontend-component-reference)
5. [Debugging Guide](#debugging-guide)
6. [Deployment Checklist](#deployment-checklist)

---

## Common Tasks

### Add a New API Endpoint

1. **Create/Edit route file** in `server/routes/`
   ```javascript
   router.get('/api/your-endpoint', authMiddleware, async (req, res) => {
     try {
       const result = await pool.query('SELECT * FROM your_table WHERE user_id = $1', [req.user.id]);
       res.json(result.rows);
     } catch (error) {
       logger.error('Error in your-endpoint', { error: error.message, userId: req.user.id });
       res.status(500).json({ error: 'Internal server error' });
     }
   });
   ```

2. **Add to server.js** if new route file
   ```javascript
   const yourRoute = require('./routes/yourRoute.pg.js');
   app.use('/api/your-module', yourRoute);
   ```

3. **Test** with curl or Postman
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/your-endpoint
   ```

### Add a New Database Table

1. **Create migration file** `server/migrations/XXX_your_migration.sql`
   ```sql
   BEGIN;

   CREATE TABLE IF NOT EXISTS your_table (
     id SERIAL PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX IF NOT EXISTS idx_your_table_user ON your_table(user_id);

   CREATE TRIGGER trg_your_table_updated_at
   BEFORE UPDATE ON your_table
   FOR EACH ROW EXECUTE FUNCTION set_updated_timestamp();

   COMMIT;
   ```

2. **Run migration** on Railway
   ```bash
   railway run psql < server/migrations/XXX_your_migration.sql
   ```

3. **Update documentation** in `docs/DATABASE.md`

### Add a New React Component

1. **Create component file** `client/src/components/YourComponent.js`
   ```javascript
   import React, { useState, useEffect } from 'react';
   import { YourIcon } from 'lucide-react';
   import { yourApiCall } from '../utils/api';

   const YourComponent = ({ prop1, prop2 }) => {
     const [data, setData] = useState([]);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       loadData();
     }, []);

     const loadData = async () => {
       try {
         const result = await yourApiCall();
         setData(result);
       } catch (error) {
         console.error('Error loading data:', error);
       } finally {
         setLoading(false);
       }
     };

     if (loading) return <div>Loading...</div>;

     return (
       <div className="your-component">
         {/* Your JSX */}
       </div>
     );
   };

   export default YourComponent;
   ```

2. **Add API function** in `client/src/utils/api.js`
   ```javascript
   export const yourApiCall = async () => {
     const response = await fetch(`${API_BASE_URL}/api/your-endpoint`, {
       headers: {
         'Authorization': `Bearer ${getToken()}`,
         'Content-Type': 'application/json'
       }
     });
     if (!response.ok) throw new Error('API call failed');
     return response.json();
   };
   ```

3. **Import and use** in parent component or page

### Add a New WebSocket Event

1. **Server side** in `server/services/webSocketHandlers.js` or route file
   ```javascript
   // Emit event to specific user
   const userSocket = io.sockets.sockets.get(userSocketId);
   if (userSocket) {
     userSocket.emit('your-event', { data: yourData });
   }

   // Emit to all users in room
   io.to(`conversation-${conversationId}`).emit('your-event', { data: yourData });

   // Broadcast to all connected users
   io.emit('your-event', { data: yourData });
   ```

2. **Client side** in `client/src/context/WebSocketContext.js` or component
   ```javascript
   useEffect(() => {
     if (!socket) return;

     socket.on('your-event', (data) => {
       console.log('Received your-event:', data);
       // Handle event
     });

     return () => {
       socket.off('your-event');
     };
   }, [socket]);
   ```

### Add BL_Bot Functionality

1. **Edit bot service** `server/services/blBot.js`
2. **Update** `getUserContext()` to fetch additional data
3. **Modify** system prompt in `generateAIResponse()` to include new capability
4. **Add** scheduled task in `server/services/botScheduler.js` if needed
5. **Update** `docs/BOT_KNOWLEDGE.md` with new feature

---

## Database Quick Reference

### Connect to Database

```bash
# Via Railway CLI
railway run psql

# Via psql directly
PGPASSWORD="..." psql -h gondola.proxy.rlwy.net -p 33866 -U postgres -d railway
```

### Common Queries

**Get user by ID:**
```sql
SELECT * FROM users WHERE id = 1;
```

**Get user's tasks:**
```sql
SELECT * FROM tasks WHERE user_id = 1 ORDER BY created_at DESC;
```

**Get conversation messages:**
```sql
SELECT m.*, u.name as sender_name
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.conversation_id = 2
ORDER BY m.created_at ASC;
```

**Get unread notifications:**
```sql
SELECT * FROM notifications
WHERE user_id = 1 AND is_read = false
ORDER BY ai_priority_score DESC, created_at DESC;
```

**Get active storage bins:**
```sql
SELECT * FROM storage_bins
WHERE status = 'pending' AND keep_until >= CURRENT_DATE
ORDER BY keep_until ASC;
```

**Get KB articles with feedback:**
```sql
SELECT a.*,
  COUNT(f.id) FILTER (WHERE f.is_helpful = true) as helpful_count,
  COUNT(f.id) FILTER (WHERE f.is_helpful = false) as not_helpful_count
FROM kb_articles a
LEFT JOIN kb_article_feedback f ON a.id = f.article_id
WHERE a.status = 'published'
GROUP BY a.id;
```

### Useful Database Commands

```sql
-- List all tables
\dt

-- Describe table structure
\d table_name

-- List indexes
\di

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('table_name'));

-- Find slow queries (enable pg_stat_statements)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Active connections
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Kill a connection
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;
```

---

## API Quick Reference

### Authentication

**All endpoints except /api/auth/login and /api/auth/register require:**
```
Authorization: Bearer <JWT_TOKEN>
```

### Quick Endpoint List

| Module | Method | Endpoint | Description |
|--------|--------|----------|-------------|
| Auth | POST | `/api/auth/login` | Login user |
| Auth | POST | `/api/auth/register` | Register new user |
| Auth | GET | `/api/auth/status` | Check auth status |
| Profile | GET | `/api/profile` | Get user profile |
| Profile | PUT | `/api/profile` | Update profile |
| Messages | GET | `/api/messages/conversations` | Get all conversations |
| Messages | GET | `/api/messages/conversations/:id/messages` | Get conversation messages |
| Messages | POST | `/api/messages/conversations/:id/messages` | Send message |
| Messages | DELETE | `/api/messages/:id` | Delete message |
| Tasks | GET | `/api/tasks/unified-board` | Get all tasks |
| Tasks | POST | `/api/tasks` | Create task |
| Tasks | PUT | `/api/tasks/:id` | Update task |
| Tasks | DELETE | `/api/tasks/:id` | Delete task |
| Kanban | GET | `/api/kanban/tasks` | Get kanban tasks |
| Kanban | PUT | `/api/kanban/tasks/:id` | Update task status |
| Calendar | GET | `/api/events` | Get calendar events |
| Calendar | POST | `/api/events` | Create event |
| Schedule | GET | `/api/schedule` | Get work schedule |
| Schedule | PUT | `/api/schedule` | Update schedule |
| KB | GET | `/api/kb/articles` | Get articles |
| KB | POST | `/api/kb/articles` | Create article |
| KB | POST | `/api/kb/articles/:id/dictate` | Transcribe audio |
| Waste | GET | `/api/waste` | Get waste items |
| Waste | POST | `/api/waste` | Create waste item |
| Kisten | GET | `/api/kisten` | Get storage bins |
| Kisten | POST | `/api/kisten` | Create bins with QR codes |
| Notifications | GET | `/api/notifications` | Get notifications |
| Notifications | PUT | `/api/notifications/:id/read` | Mark as read |
| Admin | GET | `/api/admin/users` | Get all users (admin) |
| Admin | POST | `/api/admin/broadcast` | Send broadcast (admin) |

### Common Request Examples

**Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Get profile:**
```bash
curl http://localhost:8080/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Send message:**
```bash
curl -X POST http://localhost:8080/api/messages/conversations/2/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!","messageType":"text"}'
```

**Create task:**
```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Task","description":"Task description","priority":"medium","status":"todo"}'
```

---

## Frontend Component Reference

### Key Components by Function

**Layout:**
- `App.js` - Root component with routing
- `Header.js` - Top navigation bar
- `Footer.js` - Bottom footer
- `MobileBottomNav.js` - Mobile bottom navigation

**Pages:**
- `Dashboard.js` - Main dashboard with calendar
- `Login.js` / `Register.js` - Authentication
- `KnowledgeBase.js` - KB article listing

**Messaging:**
- `DirectMessenger.js` - Full messenger interface
- `MessageList.js` - Message display
- `MessageInput.js` - Message composition
- `VoiceRecorder.js` - Voice message recording
- `VoiceMessagePlayer.js` - Voice playback
- `GifPicker.js` - GIF search and selection
- `MessageReactions.js` - Emoji reactions
- `QuickRepliesPanel.js` - Quick reply templates

**Tasks & Kanban:**
- `ImprovedKanbanBoard.js` - Drag-drop kanban
- `TaskPoolView.js` - Daily task pool
- `UnifiedTaskBoard.js` - Combined task view
- `TaskModal.js` - Task detail modal
- `TaskChecklist.js` - Checklist items
- `TaskComments.js` - Task comments
- `TaskTemplateSelector.js` - Task templates

**Calendar:**
- `Calendar.js` - Main calendar component
- `AdvancedCalendar.js` - Enhanced calendar view
- `SimpleCalendar.js` - Simple date picker
- `EventFormModal.js` - Create/edit events
- `EventDetailsModal.js` - View event details
- `TeamScheduleCalendar.js` - Team view

**Scheduling:**
- `ScheduleForm.js` - Work schedule editor
- `MonthlyHoursCalculator.js` - Hours calculation
- `HoursCalendar.js` - Calendar with hours
- `AbsenceModal.js` - Absence/vacation

**Knowledge Base:**
- `DictationArticleEditor.js` - Article editor with voice
- `ArticleVersionHistory.js` - Version management

**Waste & Bins:**
- `WasteManagement.js` - Waste tracking
- `KistenManager.js` - Storage bins with QR scanning
- `BarcodeViewer.js` - Fullscreen barcode gallery

**Notifications:**
- `NotificationCenter.js` - Notification list
- `NotificationDropdown.js` - Header dropdown
- `SmartNotificationPanel.js` - Advanced notification view
- `NotificationPreferencesModal.js` - Settings

**Profile & Stories:**
- `UserProfile.js` - User profile page
- `StoryComposer.js` - Create stories
- `FirstLoginFlow.js` - Onboarding

**Admin:**
- `AdminDashboard.js` - Admin panel
- `AdminAuditLog.js` - Audit logs

**Utilities:**
- `LoadingSpinner.js` - Loading indicator
- `SkeletonLoader.js` - Skeleton screens
- `ErrorBoundary.js` - Error handling
- `ConnectionStatus.js` - WebSocket status
- `CookieConsent.js` - GDPR compliance

### Common Component Patterns

**API data fetching:**
```javascript
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiFunction();
      setData(data);
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

**Form handling:**
```javascript
const [formData, setFormData] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await submitFunction(formData);
    showSuccess('Saved successfully');
    onClose();
  } catch (error) {
    showError('Save failed');
  }
};
```

**Modal management:**
```javascript
const [showModal, setShowModal] = useState(false);

// In JSX
{showModal && (
  <YourModal
    onClose={() => setShowModal(false)}
    onSave={handleSave}
  />
)}
```

---

## Debugging Guide

### Backend Debugging

**Check logs:**
```bash
# Railway logs
railway logs

# Local logs
tail -f server/logs/app.log
tail -f server/logs/error.log
tail -f server/logs/audit/audit.log
```

**Enable debug logging:**
```javascript
// In any file
const logger = require('./utils/logger');
logger.debug('Debug message', { data: yourData });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error: err.message });
```

**Check database queries:**
```javascript
// Add before query
console.log('Query:', query);
console.log('Params:', params);

// Add after query
console.log('Result:', result.rows);
console.log('Row count:', result.rowCount);
```

**Test API endpoint:**
```bash
# Check if server is running
curl http://localhost:8080/api/health

# Test protected endpoint
curl -H "Authorization: Bearer TOKEN" http://localhost:8080/api/profile
```

### Frontend Debugging

**React DevTools:**
- Install React DevTools browser extension
- Inspect component props and state
- Profile performance
- View component tree

**Console logging:**
```javascript
console.log('Component rendered', { props, state });
console.table(arrayData); // Table format
console.group('Group name'); // Grouped logs
console.error('Error:', error); // Red error
```

**Network inspection:**
- Open browser DevTools → Network tab
- Filter by XHR/Fetch
- Check request headers (Authorization)
- Check response status and body
- Look for 401 (auth), 403 (forbidden), 500 (server error)

**WebSocket debugging:**
```javascript
// In WebSocketContext or component
socket.on('connect', () => console.log('WebSocket connected'));
socket.on('disconnect', () => console.log('WebSocket disconnected'));
socket.on('error', (err) => console.error('WebSocket error:', err));

// Log all events
socket.onAny((event, ...args) => {
  console.log('WebSocket event:', event, args);
});
```

**Common issues:**

| Issue | Cause | Fix |
|-------|-------|-----|
| "Unauthorized" | Token missing/invalid | Check localStorage, re-login |
| "Network error" | Server down | Check server is running |
| "CORS error" | Cross-origin issue | Check server CORS config |
| Component not updating | State not changing reference | Use spread operator |
| Infinite re-render | useEffect dependency issue | Check dependency array |
| WebSocket not connecting | Server WebSocket not initialized | Check server.js |

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests pass locally
- [ ] No console errors in browser
- [ ] Database migrations created and tested
- [ ] Environment variables set in Railway
- [ ] Code reviewed and merged to main branch
- [ ] Updated documentation if needed
- [ ] Tested on mobile viewport

### Deployment Steps

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. **Railway auto-deploys** from GitHub
   - Watch deployment logs: `railway logs`
   - Wait for "Deployment successful"

3. **Run database migrations** (if any):
   ```bash
   railway run psql < server/migrations/XXX_your_migration.sql
   ```

4. **Verify deployment:**
   - Check health endpoint: `https://your-app.railway.app/api/health`
   - Test critical features
   - Check logs for errors

### Post-Deployment

- [ ] Verify features work in production
- [ ] Check database migrations applied
- [ ] Monitor error logs for issues
- [ ] Test BL_Bot functionality
- [ ] Verify WebSocket connections
- [ ] Check mobile responsiveness
- [ ] Notify team of deployment

### Rollback (if needed)

1. **Revert commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or redeploy previous version** in Railway dashboard

3. **Rollback database migration** (carefully!):
   ```sql
   -- Write reverse migration
   -- Test thoroughly before running
   ```

---

## Environment Variables Reference

```bash
# Server
PORT=8080
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...
PGHOST=gondola.proxy.rlwy.net
PGPORT=33866
PGUSER=postgres
PGPASSWORD=...
PGDATABASE=railway

# Authentication
JWT_SECRET=your-secret-key

# OpenAI (BL_Bot)
OPENAI_API_KEY=sk-...

# Tenor GIFs
TENOR_API_KEY=...

# File Uploads
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Cloudinary (profile photos)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Redis (if using)
REDIS_URL=redis://...

# Email (if configured)
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@biolab.de
```

---

## Useful Code Snippets

### JWT Token Generation
```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

### Password Hashing
```javascript
const bcrypt = require('bcrypt');

// Hash
const hashedPassword = await bcrypt.hash(password, 10);

// Verify
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Database Transaction
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO table1 ...');
  await client.query('UPDATE table2 ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### File Upload Handling
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/attachments/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### WebSocket Emit to User
```javascript
// Find user's socket
const userSocket = Array.from(io.sockets.sockets.values())
  .find(s => s.handshake.auth.userId === targetUserId);

if (userSocket) {
  userSocket.emit('notification:new', { notification });
}
```

### React Custom Hook
```javascript
import { useState, useEffect } from 'react';

export const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};
```

---

## Performance Tips

### Backend
- Use indexes on frequently queried columns
- Limit query results with LIMIT
- Use connection pooling (already configured)
- Cache frequently accessed data
- Use parameterized queries (prevents SQL injection too)
- Batch database operations when possible

### Frontend
- Use React.memo for expensive components
- Use useMemo for expensive calculations
- Use useCallback for stable function references
- Lazy load components with React.lazy()
- Debounce search inputs
- Virtualize long lists
- Optimize images (compress, proper format)

### Database
- Regular VACUUM and ANALYZE
- Monitor slow queries
- Add indexes for JOIN columns
- Use partial indexes where appropriate
- Archive old data

---

## Security Checklist

- [ ] All API endpoints use authentication middleware
- [ ] User input is validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] Passwords are hashed with bcrypt
- [ ] JWT tokens have expiration
- [ ] CORS is properly configured
- [ ] File uploads are validated (type, size)
- [ ] Sensitive data not logged
- [ ] HTTPS enforced in production
- [ ] Environment variables not committed to git

---

## Documentation Links

- [PLATFORM.md](./PLATFORM.md) - Platform overview and architecture
- [DATABASE.md](./DATABASE.md) - Complete database schema
- [API.md](./API.md) - All API endpoints
- [FRONTEND.md](./FRONTEND.md) - Frontend components and structure
- [BOT_KNOWLEDGE.md](./BOT_KNOWLEDGE.md) - User guide for BL_Bot

---

**Last Updated:** 2025-11-19
**Maintained By:** Development Team
