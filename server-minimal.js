// Minimal production server - only essential features
// Updated: 2026-01-22 12:00 - ПОВЕРНУТО ОРИГІНАЛЬНИЙ messages.pg.js
console.log('='.repeat(80));
console.log('🚀 BIOLAB LOGISTIK PLANNER - SERVER v12.0-ORIGINAL-MESSAGES');
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
const { Pool } = require('pg');

const { runPendingMigrations } = require('./server/utils/postgresMigrations');
const { scheduleEntsorgungReminders, runEntsorgungReminderJob } = require('./server/services/entsorgungReminder');
const botScheduler = require('./server/services/botScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database pool globally
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Health endpoints - SIMPLE, NO DATABASE
app.get('/ping', (req, res) => {
  console.log('✅ PING received');
  res.send('PONG');
});

app.get('/health', (req, res) => {
  console.log('✅ HEALTH check received');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptime: process.uptime()
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
    failedCount,
    lastError: global.lastRouteError || null
  });
});

// Test messages.pg.js loading
app.get('/debug/test-messages', (req, res) => {
  try {
    delete require.cache[require.resolve('./server/routes/messages.pg')];
    const messagesRouter = require('./server/routes/messages.pg');
    res.json({ success: true, message: 'Messages router loaded successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

app.get('/debug/check-stories-table', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_stories'
      ) as table_exists
    `);

    const tableExists = result.rows[0]?.table_exists;

    if (tableExists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM user_stories');
      res.json({
        success: true,
        table_exists: true,
        story_count: parseInt(countResult.rows[0].count, 10)
      });
    } else {
      res.json({
        success: true,
        table_exists: false,
        message: 'Migration 050 has not been applied yet'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

app.get('/debug/users-photos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, profile_photo, is_active
      FROM users
      ORDER BY id
    `);
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/debug/fix-photo-paths', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE users
      SET profile_photo = regexp_replace(profile_photo, '^/app/', '/', 'i')
      WHERE profile_photo LIKE '/app/%'
      RETURNING id, name, profile_photo
    `);
    res.json({
      success: true,
      message: `Fixed ${result.rows.length} photo paths`,
      updated: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== LOAD ROUTES FROM FILES ====================

const fs = require('fs');
console.log('📊 Loading other routes...');

const routes = [
  { path: '/api/auth', file: path.join(__dirname, 'server', 'routes', 'auth.pg'), name: 'auth' },
  { path: '/api/messages', file: path.join(__dirname, 'server', 'routes', 'messages.pg'), name: 'messages' },
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

let loadedCount = 0;
let failedCount = 0;

routes.forEach(route => {
  try {
    if (!fs.existsSync(route.file + '.js')) {
      console.error(`  ✗ ${route.name}: File not found`);
      failedCount++;
      global.lastRouteError = { route: route.name, error: 'File not found', path: route.file + '.js' };
      return;
    }

    const routeModule = require(route.file);
    app.use(route.path, routeModule);
    console.log(`  ✅ ${route.name} loaded`);
    loadedCount++;
  } catch(e) {
    console.error(`  ❌ ${route.name} FAILED:`, e.message);
    console.error(`     Stack:`, e.stack);
    global.lastRouteError = { route: route.name, error: e.message, stack: e.stack };
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
  console.log('\n🔧 ENSURING MESSAGE TABLES EXIST...');

  // CREATE MESSAGE TABLES FIRST - BEFORE MIGRATIONS
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set! Skipping table creation.');
  } else {

    try {
      const tablesCheck = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'message%'
      `);
      console.log('📊 Message tables found:', tablesCheck.rows.map(r => r.table_name));

      if (tablesCheck.rows.length === 0) {
        console.error('❌ CRITICAL: No message tables found! Creating them now...');

      // FORCE CREATE message tables - SEPARATE QUERIES
      await pool.query(`CREATE TABLE IF NOT EXISTS message_conversations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50) DEFAULT 'direct',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS message_conversation_members (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        file_url TEXT,
        file_type VARCHAR(100),
        file_name VARCHAR(255),
        file_size BIGINT,
        read_status BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS message_read_status (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS quick_replies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create indexes
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_read_status_message ON message_read_status(message_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_read_status_user ON message_read_status(user_id)`);

        console.log('✅ Message tables created successfully!');
      }
    } catch (error) {
      console.error('⚠️  Failed to create message tables:', error.message);
      console.error('Continuing startup...');
    }
  }

  // NOW RUN MIGRATIONS
  console.log('\n🔧 RUNNING DATABASE MIGRATIONS...');
  try {
    await runPendingMigrations();
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('⚠️  PostgreSQL migrations failed:', error.message);
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

  console.log('\n🚀 STARTING HTTP SERVER...');
  console.log('PORT:', PORT);
  console.log('Binding to: 0.0.0.0');

  server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(80));
    console.log('✅✅✅ SERVER SUCCESSFULLY STARTED ✅✅✅');
    console.log('='.repeat(80));
    console.log('🌐 Listening on port:', PORT);
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    console.log('⏰ Started at:', new Date().toISOString());
    console.log('='.repeat(80));
  });

  server.on('error', (error) => {
    console.error('❌❌❌ SERVER ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
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
// Force restart - v12.9 deployment
