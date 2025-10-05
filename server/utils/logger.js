const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Custom log levels and colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    security: 2,
    audit: 3,
    info: 4,
    http: 5,
    database: 6,
    performance: 7,
    debug: 8,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    security: 'magenta',
    audit: 'cyan',
    info: 'green',
    http: 'blue',
    database: 'gray',
    performance: 'yellow',
    debug: 'white',
  },
};

winston.addColors(customLevels.colors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata } = info;
    const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

// Logs directory
const logsDir = path.join(__dirname, '..', 'logs');

// Error logs - kept for 30 days
const errorFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
});

// Combined logs - kept for 14 days
const combinedFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '14d',
  format: logFormat,
});

// HTTP access logs - kept for 7 days
const httpFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxSize: '20m',
  maxFiles: '7d',
  format: logFormat,
});

// Security logs - kept for 90 days
const securityFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'security',
  maxSize: '20m',
  maxFiles: '90d',
  format: logFormat,
});

// Audit logs - kept for 90 days
const auditFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'audit',
  maxSize: '20m',
  maxFiles: '90d',
  format: logFormat,
});

// Database logs - kept for 7 days
const databaseFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'database-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'database',
  maxSize: '20m',
  maxFiles: '7d',
  format: logFormat,
});

// Performance logs - kept for 7 days
const performanceFileRotate = new DailyRotateFile({
  filename: path.join(logsDir, 'performance-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'performance',
  maxSize: '20m',
  maxFiles: '7d',
  format: logFormat,
});

// Create the logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  format: logFormat,
  transports: [
    errorFileRotate,
    combinedFileRotate,
    httpFileRotate,
    securityFileRotate,
    auditFileRotate,
    databaseFileRotate,
    performanceFileRotate,
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

// Helper methods for structured logging
class LoggerWrapper {
  constructor(winstonLogger) {
    this.logger = winstonLogger;
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...meta, pid: process.pid });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, pid: process.pid });
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      stack: error.stack,
      name: error.name,
      errorMessage: error.message,
      ...meta,
      pid: process.pid
    } : { ...meta, pid: process.pid };

    this.logger.error(message, errorMeta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, pid: process.pid });
  }

  security(message, meta = {}) {
    this.logger.log('security', message, {
      ...meta,
      ip: meta.ip || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      pid: process.pid
    });
  }

  audit(message, meta = {}) {
    this.logger.log('audit', message, {
      ...meta,
      sessionId: meta.sessionId || 'unknown',
      pid: process.pid
    });
  }

  database(message, meta = {}) {
    this.logger.log('database', message, { ...meta, pid: process.pid });
  }

  performance(message, duration, meta = {}) {
    this.logger.log('performance', message, {
      ...meta,
      duration: `${duration}ms`,
      pid: process.pid
    });

    if (duration > 1000) {
      this.warn(`Slow operation detected: ${message}`, {
        duration: `${duration}ms`,
        ...meta
      });
    }
  }

  http(message, meta = {}) {
    this.logger.http(message, { ...meta, pid: process.pid });
  }

  // Express middleware for request logging
  request(req, res, next) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - start;

      logger.http('Request completed', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        contentLength: res.get('Content-Length')
      });

      if (duration > 5000) {
        logger.performance('Slow request detected', duration, {
          method: req.method,
          url: req.originalUrl,
          userId: req.user?.id
        });
      }

      originalSend.call(this, data);
    };

    next();
  }

  // Stream for Morgan
  get stream() {
    return {
      write: (message) => {
        this.logger.http(message.trim());
      },
    };
  }
}

module.exports = new LoggerWrapper(logger);