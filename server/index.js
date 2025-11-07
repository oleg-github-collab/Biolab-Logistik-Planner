// Immediate startup logging
console.log('='.repeat(80));
console.log('🚀 BIOLAB LOGISTIK PLANNER - SERVER STARTING');
console.log('='.repeat(80));
console.log('Time:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT from env:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('='.repeat(80));

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { initializeSocket } = require('./websocket');
const logger = require('./utils/logger');
const redisService = require('./services/redisService');
const { ensureMessageSchema } = require('./services/messageService');
const { scheduleKistenReminders, runReminderJob } = require('./services/kistenReminder');
const {
  scheduleEntsorgungReminders,
  runEntsorgungReminderJob
} = require('./services/entsorgungReminder');
const { runPendingMigrations } = require('./utils/postgresMigrations');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('✅ Express app created, PORT:', PORT);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "http://localhost:5000", "http://localhost:3000", "https://*.railway.app", "https://*.vercel.app", "https://*.herokuapp.com"],
      "script-src": ["'self'", "'unsafe-inline'", "https://*.railway.app"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "", "https://*.railway.app", "https://*.vercel.app", "https://*.herokuapp.com"]
    }
  }
}));
app.use(morgan('combined'));

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('railway.app') ||
        origin.includes('vercel.app') ||
        origin.includes('herokuapp.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// API routes - PostgreSQL only (SQLite removed)
console.log('📊 Loading routes...');
console.log('  ✓ auth');
app.use('/api/auth', require('./routes/auth.pg'));
console.log('  ✓ schedule');
app.use('/api/schedule', require('./routes/schedule.pg'));
console.log('  ✓ messages');
app.use('/api/messages', require('./routes/messages.pg'));
console.log('  ✓ tasks');
app.use('/api/tasks', require('./routes/tasks.pg'));
console.log('  ✓ task-pool');
app.use('/api/task-pool', require('./routes/taskPool.pg'));
console.log('  ✓ kanban');
app.use('/api/kanban', require('./routes/kanban.pg'));
console.log('  ✓ kb');
app.use('/api/kb', require('./routes/knowledgeBase.pg'));
console.log('  ✓ profile');
app.use('/api/profile', require('./routes/userProfile.pg'));
console.log('  ✓ notifications');
app.use('/api/notifications', require('./routes/notifications.pg'));
console.log('  ✓ uploads');
app.use('/api/uploads', require('./routes/uploads'));
console.log('  ✓ kisten');
app.use('/api/kisten', require('./routes/kisten.pg'));

// Waste management routes (PostgreSQL)
console.log('  ✓ waste');
app.use('/api/waste', require('./routes/waste.pg'));
console.log('  ✓ waste-categories');
app.use('/api/waste-categories', require('./routes/wasteCategories.pg'));

// Admin routes (PostgreSQL)
console.log('  ✓ admin');
app.use('/api/admin', require('./routes/admin.pg'));
console.log('  ✓ event-breaks');
app.use('/api/events', require('./routes/event-breaks.pg'));
console.log('✅ All routes loaded');

// Health check route
app.use('/api/health', require('./routes/health'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// Simple test endpoint - FIRST, before everything
app.get('/ping', (req, res) => {
  res.send('PONG');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Note: Scheduled tasks removed - will be implemented with PostgreSQL in production

// Helper functions
function getMonday(d) {
  d = new Date(d);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateForDB(date) {
  return date.toISOString().split('T')[0];
}

// Start server with WebSocket support
const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

const startServer = async () => {
  console.log('🚀 Starting server initialization...');
  console.log(`PORT: ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

  try {
    try {
      await runPendingMigrations();
    } catch (migrationError) {
      console.error('⚠️  PostgreSQL migrations failed:', migrationError.message);
      console.error('Continuing startup, but database schema may be outdated');
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`WebSocket server enabled`);
    });

    // Then do optional initializations (non-blocking)
    setImmediate(async () => {
      try {
        await ensureMessageSchema();
        console.log('✅ Messaging schema verified');
      } catch (schemaError) {
        console.error('⚠️  Failed to verify messaging schema:', schemaError.message);
        logger.warn('Messaging schema verification failed', {
          error: schemaError.message
        });
      }

      redisService.connect()
        .then((connected) => {
          if (!connected) {
            logger.warn('Redis connection could not be established. Continuing without cache/pub-sub features.');
          } else {
            logger.info('Redis connected and ready');
          }
        })
        .catch((error) => {
          logger.error('Redis startup connection failed', { error: error.message });
        });

      try {
        scheduleKistenReminders();
        await runReminderJob({ triggeredByScheduler: false });
      } catch (reminderError) {
        logger.error('Failed to initialize Kisten reminders', { error: reminderError.message });
      }

      try {
        scheduleEntsorgungReminders();
        await runEntsorgungReminderJob({ triggeredByScheduler: false });
      } catch (entsorgungError) {
        logger.error('Failed to initialize Entsorgungs reminders', { error: entsorgungError.message });
      }
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('Server closed');

    // Close PostgreSQL pool
    try {
      const { shutdown: shutdownDB } = require('./config/database');
      await shutdownDB();
      await redisService.disconnect();
      console.log('Database and Redis connections closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught Exception - continuing', { error: error.message, stack: error.stack });
  // Don't shutdown on every uncaught exception in production
  if (process.env.NODE_ENV !== 'production') {
    shutdown('UNCAUGHT_EXCEPTION');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection - continuing', { reason });
  // Don't shutdown on every rejection in production
  if (process.env.NODE_ENV !== 'production') {
    shutdown('UNHANDLED_REJECTION');
  }
});

module.exports = app;
