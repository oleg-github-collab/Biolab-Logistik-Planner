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

// Load routes with error handling
console.log('📊 Loading routes...');

const routes = [
  { path: '/api/auth', file: './server/routes/auth.pg', name: 'auth' },
  { path: '/api/schedule', file: './server/routes/schedule.pg', name: 'schedule' },
  { path: '/api/messages', file: './server/routes/messages.pg', name: 'messages' },
  { path: '/api/tasks', file: './server/routes/tasks.pg', name: 'tasks' },
  { path: '/api/task-pool', file: './server/routes/taskPool.pg', name: 'task-pool' },
  { path: '/api/kanban', file: './server/routes/kanban.pg', name: 'kanban' },
  { path: '/api/kb', file: './server/routes/knowledgeBase.pg', name: 'kb' },
  { path: '/api/profile', file: './server/routes/userProfile.pg', name: 'profile' },
  { path: '/api/notifications', file: './server/routes/notifications.pg', name: 'notifications' },
  { path: '/api/uploads', file: './server/routes/uploads', name: 'uploads' },
  { path: '/api/kisten', file: './server/routes/kisten.pg', name: 'kisten' },
  { path: '/api/waste', file: './server/routes/waste.pg', name: 'waste' },
  { path: '/api/waste-categories', file: './server/routes/wasteCategories.pg', name: 'waste-categories' },
  { path: '/api/admin', file: './server/routes/admin.pg', name: 'admin' },
  { path: '/api/events', file: './server/routes/event-breaks.pg', name: 'events' }
];

routes.forEach(route => {
  try {
    app.use(route.path, require(route.file));
    console.log(`  ✓ ${route.name}`);
  } catch(e) {
    console.error(`  ✗ ${route.name}:`, e.message);
  }
});

console.log('✅ All routes loaded');

// Health check route (additional API version)
try {
  app.use('/api/health', require('./server/routes/health'));
  console.log('  ✓ health route');
} catch(e) {
  console.error('  ✗ health route:', e.message);
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
    console.error('⚠️  Entsorgungsbot initialization failed:', entsorgungError.message);
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
