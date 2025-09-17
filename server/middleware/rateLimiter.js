const logger = require('../utils/logger');
const { createError } = require('./errorHandler');

class RateLimiter {
  constructor() {
    this.clients = new Map();
    this.cleanup();
  }

  cleanup() {
    // Clean up old entries every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.clients.entries()) {
        if (now - data.resetTime > 3600000) { // 1 hour
          this.clients.delete(key);
        }
      }
    }, 3600000);
  }

  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // requests per window
      message = 'Too many requests',
      keyGenerator = (req) => req.ip,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();

      let clientData = this.clients.get(key);

      if (!clientData || now > clientData.resetTime) {
        clientData = {
          count: 0,
          resetTime: now + windowMs,
          firstRequest: now
        };
        this.clients.set(key, clientData);
      }

      clientData.count++;

      // Set response headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - clientData.count),
        'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
      });

      if (clientData.count > max) {
        logger.security('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
          count: clientData.count,
          limit: max
        });

        return res.status(429).json({
          success: false,
          error: {
            message,
            retryAfter: Math.round((clientData.resetTime - now) / 1000)
          }
        });
      }

      // Skip counting if configured
      const originalSend = res.send;
      res.send = function(data) {
        const statusCode = res.statusCode;

        if (
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400)
        ) {
          clientData.count--;
        }

        originalSend.call(this, data);
      };

      next();
    };
  }
}

const rateLimiter = new RateLimiter();

// Predefined limiters
const limiters = {
  // Strict limiter for authentication endpoints
  auth: rateLimiter.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later'
  }),

  // API limiter for general endpoints
  api: rateLimiter.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many API requests, please slow down'
  }),

  // Strict limiter for admin endpoints
  admin: rateLimiter.createLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 requests per window
    message: 'Too many admin requests, please slow down'
  }),

  // Limiter for file uploads or heavy operations
  upload: rateLimiter.createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload limit exceeded, please try again later'
  }),

  // User-based limiter
  user: rateLimiter.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window per user
    keyGenerator: (req) => req.user?.id || req.ip,
    message: 'User request limit exceeded'
  })
};

module.exports = {
  rateLimiter,
  limiters
};