// Minimal production server - only essential features
// Updated: 2025-11-18 07:25 - Debug logging + fixes
console.log('='.repeat(80));
console.log('🚀 BIOLAB LOGISTIK PLANNER - SERVER v3.6-DEBUG');
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

// Load routes with error handling - ULTRA RELIABLE VERSION
console.log('📊 Loading routes...');
console.log('📁 __dirname:', __dirname);

const routes = [
  { path: '/api/auth', file: path.join(__dirname, 'server', 'routes', 'auth.pg'), name: 'auth' },
  { path: '/api/schedule', file: path.join(__dirname, 'server', 'routes', 'schedule.pg'), name: 'schedule' },
  { path: '/api/messages', file: path.join(__dirname, 'server', 'routes', 'messages.pg'), name: 'messages' },
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

const fs = require('fs');
let loadedCount = 0;
let failedCount = 0;

routes.forEach(route => {
  try {
    // Check if file exists
    if (!fs.existsSync(route.file + '.js')) {
      console.error(`  ✗ ${route.name}: File not found at ${route.file}.js`);
      failedCount++;
      return;
    }

    const routeModule = require(route.file);
    app.use(route.path, routeModule);
    console.log(`  ✅ ${route.name} loaded (${route.path})`);
    loadedCount++;
  } catch(e) {
    console.error(`  ❌ ${route.name} FAILED:`, e.message);
    console.error(`     File: ${route.file}`);
    console.error(`     Stack:`, e.stack);
    failedCount++;
  }
});

console.log(`\n✅ Routes loaded: ${loadedCount}/${routes.length}`);
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
  try {
    await runPendingMigrations();
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
