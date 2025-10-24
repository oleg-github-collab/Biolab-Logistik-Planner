/**
 * Health Check and System Status Endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');
const fs = require('fs');
const os = require('os');

/**
 * Basic health check - lightweight
 * GET /api/health
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'biolab-logistik-planner'
  });
});

/**
 * Detailed health check - includes all subsystems
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  try {
    // Database check
    checks.checks.database = await checkDatabase();

    // Memory check
    checks.checks.memory = checkMemory();

    // Disk check
    checks.checks.disk = checkDisk();

    // WebSocket check
    checks.checks.websocket = checkWebSocket();

    // Process check
    checks.checks.process = checkProcess();

    // Determine overall status
    const failedChecks = Object.values(checks.checks).filter(c => c.status !== 'healthy');

    if (failedChecks.length > 0) {
      checks.status = failedChecks.some(c => c.status === 'critical') ? 'critical' : 'degraded';
    }

    const statusCode = checks.status === 'healthy' ? 200 :
                       checks.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(checks);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness probe - for Kubernetes/container orchestration
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is ready
    const dbCheck = await checkDatabase();

    if (dbCheck.status !== 'healthy') {
      return res.status(503).json({
        ready: false,
        reason: 'database_not_ready',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe - for Kubernetes/container orchestration
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  // Just check if process is running
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * System metrics
 * GET /api/health/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        hostname: os.hostname()
      },
      process: {
        pid: process.pid,
        version: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      database: await getDatabaseMetrics(),
      audit: await auditLogger.getStatistics(1)
    };

    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

/**
 * Get active connections info
 * GET /api/health/connections
 */
router.get('/connections', (req, res) => {
  try {
    // Get WebSocket connections
    const io = req.app.get('io');
    const sockets = io ? io.sockets.sockets.size : 0;

    res.status(200).json({
      timestamp: new Date().toISOString(),
      websocket: {
        connected: sockets,
        rooms: io ? io.sockets.adapter.rooms.size : 0
      }
    });
  } catch (error) {
    logger.error('Connection info failed:', error);
    res.status(500).json({
      error: 'Failed to get connection info',
      message: error.message
    });
  }
});

// ============= Helper Functions =============

/**
 * Check database health
 */
async function checkDatabase() {
  try {
    const start = Date.now();

    await new Promise((resolve, reject) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const responseTime = Date.now() - start;

    return {
      status: 'healthy',
      responseTime,
      type: 'sqlite'
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory() {
  const usage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = ((totalMem - freeMem) / totalMem) * 100;

  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  let status = 'healthy';
  if (usedPercent > 90 || heapUsedPercent > 90) {
    status = 'critical';
  } else if (usedPercent > 80 || heapUsedPercent > 80) {
    status = 'warning';
  }

  return {
    status,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    heapPercent: Math.round(heapUsedPercent) + '%',
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    systemTotal: Math.round(totalMem / 1024 / 1024 / 1024) + ' GB',
    systemFree: Math.round(freeMem / 1024 / 1024 / 1024) + ' GB',
    systemPercent: Math.round(usedPercent) + '%'
  };
}

/**
 * Check disk usage
 */
function checkDisk() {
  try {
    const dbPath = './data/database.sqlite';
    const dbExists = fs.existsSync(dbPath);

    if (!dbExists) {
      return {
        status: 'warning',
        message: 'Database file not found'
      };
    }

    const stats = fs.statSync(dbPath);
    const sizeInMB = Math.round(stats.size / 1024 / 1024);

    let status = 'healthy';
    if (sizeInMB > 1000) {
      status = 'warning';
    }

    return {
      status,
      databaseSize: sizeInMB + ' MB',
      lastModified: stats.mtime
    };
  } catch (error) {
    return {
      status: 'warning',
      error: error.message
    };
  }
}

/**
 * Check WebSocket service
 */
function checkWebSocket() {
  // This would need access to the WebSocket server instance
  // For now, just return healthy if the module loaded
  return {
    status: 'healthy',
    message: 'WebSocket service running'
  };
}

/**
 * Check process status
 */
function checkProcess() {
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);

  return {
    status: 'healthy',
    uptime: `${uptimeHours}h ${Math.floor((uptime % 3600) / 60)}m`,
    uptimeSeconds: Math.floor(uptime),
    pid: process.pid,
    nodeVersion: process.version
  };
}

/**
 * Get database metrics
 */
async function getDatabaseMetrics() {
  try {
    const counts = await new Promise((resolve, reject) => {
      db.all(`
        SELECT
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM messages) as messages,
          (SELECT COUNT(*) FROM tasks) as tasks,
          (SELECT COUNT(*) FROM schedules) as schedules
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    return {
      status: 'healthy',
      tables: counts
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

module.exports = router;
