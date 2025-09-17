const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: this.getTimestamp(),
      level,
      message,
      ...meta,
      pid: process.pid,
      memory: process.memoryUsage()
    }) + '\n';
  }

  writeToFile(filename, content) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, content);
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('INFO', message, meta);
    console.log(`[INFO] ${message}`, meta);
    this.writeToFile('app.log', formatted);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('WARN', message, meta);
    console.warn(`[WARN] ${message}`, meta);
    this.writeToFile('app.log', formatted);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      stack: error.stack,
      name: error.name,
      message: error.message,
      ...meta
    } : meta;

    const formatted = this.formatMessage('ERROR', message, errorMeta);
    console.error(`[ERROR] ${message}`, errorMeta);
    this.writeToFile('error.log', formatted);
    this.writeToFile('app.log', formatted);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('DEBUG', message, meta);
      console.debug(`[DEBUG] ${message}`, meta);
      this.writeToFile('debug.log', formatted);
    }
  }

  security(message, meta = {}) {
    const formatted = this.formatMessage('SECURITY', message, {
      ...meta,
      ip: meta.ip || 'unknown',
      userAgent: meta.userAgent || 'unknown'
    });
    console.warn(`[SECURITY] ${message}`, meta);
    this.writeToFile('security.log', formatted);
  }

  performance(message, duration, meta = {}) {
    const formatted = this.formatMessage('PERFORMANCE', message, {
      ...meta,
      duration: `${duration}ms`
    });

    if (duration > 1000) {
      console.warn(`[PERFORMANCE] ${message} - ${duration}ms`, meta);
    } else {
      console.log(`[PERFORMANCE] ${message} - ${duration}ms`, meta);
    }

    this.writeToFile('performance.log', formatted);
  }

  audit(message, meta = {}) {
    const formatted = this.formatMessage('AUDIT', message, {
      ...meta,
      sessionId: meta.sessionId || 'unknown'
    });
    console.log(`[AUDIT] ${message}`, meta);
    this.writeToFile('audit.log', formatted);
  }

  database(message, meta = {}) {
    const formatted = this.formatMessage('DATABASE', message, meta);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DATABASE] ${message}`, meta);
    }
    this.writeToFile('database.log', formatted);
  }

  request(req, res, next) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - start;
      const logger = new Logger();

      logger.info('Request completed', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
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
}

module.exports = new Logger();