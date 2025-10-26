const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const schedule = require('node-schedule');
const { initializeSocket } = require('./websocket');
const logger = require('./utils/logger');
const redisService = require('./services/redisService');

const app = express();
const PORT = process.env.PORT || 5000;

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
console.log('📊 Using PostgreSQL routes');
app.use('/api/auth', require('./routes/auth.pg'));
app.use('/api/schedule', require('./routes/schedule.pg'));
app.use('/api/messages', require('./routes/messages.pg'));
app.use('/api/messages', require('./routes/messagesEnhanced.pg'));
app.use('/api/tasks', require('./routes/tasks.pg'));
app.use('/api/task-pool', require('./routes/taskPool.pg'));
app.use('/api/kb', require('./routes/knowledgeBase.pg'));
app.use('/api/profile', require('./routes/userProfile.pg'));
app.use('/api/notifications', require('./routes/notifications.pg'));

// Waste management routes (PostgreSQL)
app.use('/api/waste', require('./routes/waste.pg'));
app.use('/api/waste', require('./routes/wasteTemplates.pg'));
app.use('/api/waste', require('./routes/wasteSchedule.pg'));

// Admin routes (PostgreSQL)
app.use('/api/admin', require('./routes/admin.pg'));

// Health check route
app.use('/api/health', require('./routes/health'));

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`API Base URL: ${process.env.NODE_ENV === 'production' ? 'https://your-app.railway.app/api' : 'http://localhost:5000/api'}`);
  console.log(`WebSocket server enabled`);
});

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
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

module.exports = app;
