// Minimal production server - only essential features
console.log('='.repeat(80));
console.log('🚀 BIOLAB LOGISTIK PLANNER - MINIMAL SERVER');
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

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// Load routes AFTER server starts
console.log('📊 Loading routes...');

try {
  app.use('/api/auth', require('./server/routes/auth.pg'));
  console.log('  ✓ auth');
} catch(e) {
  console.error('  ✗ auth:', e.message);
}

try {
  app.use('/api/tasks', require('./server/routes/tasks.pg'));
  console.log('  ✓ tasks');
} catch(e) {
  console.error('  ✗ tasks:', e.message);
}

try {
  app.use('/api/waste', require('./server/routes/waste.pg'));
  console.log('  ✓ waste');
} catch(e) {
  console.error('  ✗ waste:', e.message);
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'client', 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(buildPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server running on port', PORT);
  console.log('Environment:', process.env.NODE_ENV);
});

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
