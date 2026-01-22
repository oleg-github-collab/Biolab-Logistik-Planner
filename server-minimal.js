// Minimal production server - only essential features
// Updated: 2026-01-22 10:20 - INLINE MESSAGES ROUTER - 100% GUARANTEED
console.log('='.repeat(80));
console.log('🚀 BIOLAB LOGISTIK PLANNER - SERVER v5.0-INLINE-MESSAGES');
console.log('='.repeat(80));
console.log('Time:', new Date().toISOString());
console.log('Node:', process.version);
console.log('ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT);
console.log('DB:', !!process.env.DATABASE_URL);
console.log('='.repeat(80));

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const { runPendingMigrations } = require('./server/utils/postgresMigrations');
const { scheduleEntsorgungReminders, runEntsorgungReminderJob } = require('./server/services/entsorgungReminder');
const botScheduler = require('./server/services/botScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket
try {
  const { initializeSocket } = require('./server/websocket');
  initializeSocket(server);
  console.log('✅ WebSocket initialized');
} catch(e) {
  console.error('⚠️  WebSocket initialization failed:', e.message);
  console.error('Continuing without WebSocket support');
}

// Health endpoints
app.get('/ping', (req, res) => {
  res.send('PONG');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT
  });
});

// Debug endpoint to check loaded routes
app.get('/debug/routes', (req, res) => {
  const loadedRoutes = app._router.stack
    .filter(r => r.route || r.name === 'router')
    .map(r => {
      if (r.route) {
        return {
          path: r.route.path,
          methods: Object.keys(r.route.methods)
        };
      } else if (r.name === 'router') {
        return {
          path: r.regexp.toString(),
          name: r.handle.name || 'anonymous router'
        };
      }
    });

  res.json({
    totalRoutes: loadedRoutes.length,
    routes: loadedRoutes,
    loadedCount,
    failedCount
  });
});

// ==================== INLINE MESSAGES ROUTER - GUARANTEED TO WORK ====================
console.log('📊 Setting up INLINE messages router...');

// Messages router dependencies
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Database pool
let dbPool;
try {
  const { pool } = require('./server/config/database');
  dbPool = pool;
  console.log('✅ Database pool loaded');
} catch(e) {
  console.error('❌ Failed to load database pool:', e.message);
}

// Auth middleware
let authMiddleware;
try {
  const { auth } = require('./server/middleware/auth');
  authMiddleware = auth;
  console.log('✅ Auth middleware loaded');
} catch(e) {
  console.error('❌ Failed to load auth middleware:', e.message);
}

// Create messages router
const messagesRouter = express.Router();

// Setup multer for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ==================== MESSAGES ROUTES ====================

// GET /api/messages/threads - Get all conversations/threads
messagesRouter.get('/threads', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await dbPool.query(`
      SELECT DISTINCT
        mc.id,
        mc.name,
        mc.type,
        mc.created_at,
        mc.updated_at,
        mc.last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = mc.id AND sender_id != $1
         AND id NOT IN (SELECT message_id FROM message_read_status WHERE user_id = $1)) as unread_count,
        (SELECT content FROM messages WHERE conversation_id = mc.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT u.name FROM messages m JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = mc.id ORDER BY m.created_at DESC LIMIT 1) as last_sender_name
      FROM message_conversations mc
      JOIN message_conversation_members mcm ON mc.id = mcm.conversation_id
      WHERE mcm.user_id = $1
      ORDER BY mc.last_message_at DESC NULLS LAST, mc.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Unterhaltungen' });
  }
});

// GET /api/messages/stories - Get all active stories
messagesRouter.get('/stories', authMiddleware, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT
        us.id,
        us.user_id,
        us.media_url,
        us.media_type,
        us.caption,
        us.created_at,
        us.expires_at,
        u.name as user_name,
        u.profile_photo_url,
        (SELECT COUNT(*) FROM user_story_views WHERE story_id = us.id) as view_count,
        (SELECT COUNT(*) > 0 FROM user_story_views WHERE story_id = us.id AND viewer_id = $1) as viewed_by_me
      FROM user_stories us
      JOIN users u ON u.id = us.user_id
      WHERE us.expires_at > NOW()
      ORDER BY us.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Stories' });
  }
});

// POST /api/messages/stories - Create a new story
messagesRouter.post('/stories', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const mediaPath = req.file.path;
    const mediaUrl = `/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const caption = req.body.caption || '';

    const result = await dbPool.query(`
      INSERT INTO user_stories (id, user_id, media_path, media_url, media_type, caption, expires_at)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
      RETURNING *
    `, [req.user.id, mediaPath, mediaUrl, mediaType, caption]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Story' });
  }
});

// GET /api/messages/unread-count - Get total unread message count
messagesRouter.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT COUNT(DISTINCT m.id) as count
      FROM messages m
      JOIN message_conversation_members mcm ON m.conversation_id = mcm.conversation_id
      WHERE mcm.user_id = $1
        AND m.sender_id != $1
        AND m.id NOT IN (SELECT message_id FROM message_read_status WHERE user_id = $1)
    `, [req.user.id]);

    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Fehler beim Laden der ungelesenen Nachrichten' });
  }
});

// POST /api/messages - Send a new message
messagesRouter.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { content, conversation_id, receiver_id, message_type = 'text' } = req.body;
    const senderId = req.user.id;

    let fileUrl = null;
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    const result = await dbPool.query(`
      INSERT INTO messages (conversation_id, sender_id, receiver_id, content, message_type, file_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [conversation_id, senderId, receiver_id, content, message_type, fileUrl]);

    // Update conversation last_message_at
    await dbPool.query(`
      UPDATE message_conversations
      SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [conversation_id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
  }
});

// Mount the inline messages router
app.use('/api/messages', messagesRouter);
console.log('✅ INLINE messages router mounted at /api/messages');

// ==================== LOAD OTHER ROUTES ====================

console.log('📊 Loading other routes...');

const routes = [
  { path: '/api/auth', file: path.join(__dirname, 'server', 'routes', 'auth.pg'), name: 'auth' },
  { path: '/api/schedule', file: path.join(__dirname, 'server', 'routes', 'schedule.pg'), name: 'schedule' },
  { path: '/api/tasks', file: path.join(__dirname, 'server', 'routes', 'tasks.pg'), name: 'tasks' },
  { path: '/api/task-pool', file: path.join(__dirname, 'server', 'routes', 'taskPool.pg'), name: 'task-pool' },
  { path: '/api/kanban', file: path.join(__dirname, 'server', 'routes', 'kanban.pg'), name: 'kanban' },
  { path: '/api/kb', file: path.join(__dirname, 'server', 'routes', 'knowledgeBase.pg'), name: 'kb' },
  { path: '/api/profile', file: path.join(__dirname, 'server', 'routes', 'userProfile.pg'), name: 'profile' },
  { path: '/api/notifications', file: path.join(__dirname, 'server', 'routes', 'notifications.pg'), name: 'notifications' },
  { path: '/api/uploads', file: path.join(__dirname, 'server', 'routes', 'uploads'), name: 'uploads' },
  { path: '/api/kisten', file: path.join(__dirname, 'server', 'routes', 'kisten.pg'), name: 'kisten' },
  { path: '/api/waste', file: path.join(__dirname, 'server', 'routes', 'waste.pg'), name: 'waste' },
  { path: '/api/waste-categories', file: path.join(__dirname, 'server', 'routes', 'wasteCategories.pg'), name: 'waste-categories' },
  { path: '/api/admin', file: path.join(__dirname, 'server', 'routes', 'admin.pg'), name: 'admin' },
  { path: '/api/events', file: path.join(__dirname, 'server', 'routes', 'event-breaks.pg'), name: 'events' }
];

let loadedCount = 1; // Already loaded messages inline
let failedCount = 0;

routes.forEach(route => {
  try {
    if (!fs.existsSync(route.file + '.js')) {
      console.error(`  ✗ ${route.name}: File not found`);
      failedCount++;
      return;
    }

    const routeModule = require(route.file);
    app.use(route.path, routeModule);
    console.log(`  ✅ ${route.name} loaded`);
    loadedCount++;
  } catch(e) {
    console.error(`  ❌ ${route.name} FAILED:`, e.message);
    failedCount++;
  }
});

console.log(`\n✅ Routes loaded: ${loadedCount}/${routes.length + 1}`);
if (failedCount > 0) {
  console.error(`❌ Routes failed: ${failedCount}/${routes.length}`);
}

// Health check route (additional API version)
try {
  const healthPath = path.join(__dirname, 'server', 'routes', 'health');
  if (fs.existsSync(healthPath + '.js')) {
    app.use('/api/health', require(healthPath));
    console.log('  ✅ health route loaded');
  } else {
    console.log('  ⚠️  health route: file not found, skipping');
  }
} catch(e) {
  console.error('  ❌ health route FAILED:', e.message);
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✅ Uploads directory served at /uploads');

// Serve static files in production - BUT SKIP API ROUTES!
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'client', 'build');
  console.log('🌐 Production mode - serving static files from:', buildPath);

  // Check asset manifest
  const fs = require('fs');
  const manifestPath = path.join(buildPath, 'asset-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('📦 CSS:', manifest.files['main.css']);
    console.log('📦 JS:', manifest.files['main.js']);
  }

  // Serve static files ONLY for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log('[STATIC-SKIP] API route:', req.path);
      return next();
    }
    express.static(buildPath)(req, res, next);
  });

  // SPA fallback - ONLY for non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      console.log('[FALLBACK-ERROR] API route reached fallback:', req.path);
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.resolve(buildPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

async function startServer() {
  console.log('\n🔧 RUNNING DATABASE MIGRATIONS...');
  try {
    await runPendingMigrations();
    console.log('✅ Database migrations completed');

    // Verify critical tables exist
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const tablesCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'message%'
    `);
    console.log('📊 Message tables found:', tablesCheck.rows.map(r => r.table_name));

    if (tablesCheck.rows.length === 0) {
      console.error('❌ CRITICAL: No message tables found! Migration 016 may have failed!');
    }
  } catch (error) {
    console.error('⚠️  PostgreSQL migrations failed:', error.message);
    console.error('Stack:', error.stack);
    console.error('Continuing startup, but database schema may be outdated');
  }

  // Initialize BL_Bot
  console.log('='.repeat(80));
  console.log('🤖 STARTING BL_BOT INITIALIZATION');
  console.log('='.repeat(80));
  try {
    console.log('🤖 Step 1: Calling botScheduler.start()...');
    await botScheduler.start();
    console.log('✅ Step 2: BL_Bot scheduler initialized successfully');
  } catch (botError) {
    console.error('❌ CRITICAL: Failed to initialize BL_Bot scheduler');
    console.error('Error message:', botError.message);
    console.error('Error stack:', botError.stack);
  }
  console.log('='.repeat(80));

  server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Server running on port', PORT);
    console.log('Environment:', process.env.NODE_ENV);
  });

  try {
    scheduleEntsorgungReminders();
    await runEntsorgungReminderJob({ triggeredByScheduler: false });
  } catch (entsorgungError) {
    console.error('⚠️  BL_Bot initialization failed:', entsorgungError.message);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

console.log('✅ Server initialization complete');
