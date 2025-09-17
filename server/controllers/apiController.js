const { asyncHandler, createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class ApiController {
  constructor() {
    this.sendResponse = this.sendResponse.bind(this);
    this.sendError = this.sendError.bind(this);
    this.sendPaginatedResponse = this.sendPaginatedResponse.bind(this);
    this.cache = new Map();
  }

  sendResponse(res, data, message = 'Success', statusCode = 200, meta = {}) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      ...meta
    };

    logger.info(`API Response: ${message}`, {
      statusCode,
      dataType: data ? typeof data : null,
      hasData: !!data
    });

    return res.status(statusCode).json(response);
  }

  sendError(res, message, statusCode = 500, errors = null) {
    const response = {
      success: false,
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        ...(errors && { details: errors })
      }
    };

    logger.error(`API Error: ${message}`, null, {
      statusCode,
      errors
    });

    return res.status(statusCode).json(response);
  }

  sendPaginatedResponse(res, data, pagination, message = 'Success') {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);
  }

  // Helper method for database operations with error handling
  async executeQuery(db, query, params = [], operation = 'query') {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const callback = (err, result) => {
        const duration = Date.now() - start;

        if (err) {
          logger.error(`Database ${operation} failed`, err, {
            query: query.substring(0, 100),
            params,
            duration
          });
          reject(err);
        } else {
          logger.debug(`Database ${operation} completed`, {
            query: query.substring(0, 100),
            duration,
            affectedRows: result?.changes || result?.length || 0
          });
          resolve(result);
        }
      };

      switch (operation) {
        case 'get':
          db.get(query, params, callback);
          break;
        case 'all':
          db.all(query, params, callback);
          break;
        case 'run':
          db.run(query, params, function(err) {
            callback(err, {
              id: this?.lastID,
              changes: this?.changes
            });
          });
          break;
        default:
          db.all(query, params, callback);
      }
    });
  }

  // Helper method for transaction handling
  async executeTransaction(db, operations) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const results = [];
        let completed = 0;

        const rollback = (error) => {
          db.run('ROLLBACK', () => {
            logger.error('Transaction rolled back', error);
            reject(error);
          });
        };

        const commit = () => {
          db.run('COMMIT', (err) => {
            if (err) {
              logger.error('Transaction commit failed', err);
              reject(err);
            } else {
              logger.info('Transaction committed successfully');
              resolve(results);
            }
          });
        };

        operations.forEach((op, index) => {
          const { query, params, operation } = op;

          const callback = (err, result) => {
            if (err) {
              rollback(err);
              return;
            }

            results[index] = result;
            completed++;

            if (completed === operations.length) {
              commit();
            }
          };

          switch (operation) {
            case 'get':
              db.get(query, params, callback);
              break;
            case 'run':
              db.run(query, params, function(err) {
                callback(err, {
                  id: this?.lastID,
                  changes: this?.changes
                });
              });
              break;
            default:
              db.all(query, params, callback);
          }
        });
      });
    });
  }

  // Helper method for input sanitization
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    return input;
  }

  // Helper method for safe JSON parsing
  safeJsonParse(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('JSON parse failed', { jsonString, error: error.message });
      return fallback;
    }
  }

  // Helper method for date validation and formatting
  validateAndFormatDate(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw createError.badRequest('Invalid date format');
    }
    return date.toISOString().split('T')[0];
  }

  // Helper method for time validation
  validateTime(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) {
      throw createError.badRequest('Invalid time format. Use HH:MM');
    }
    return timeString;
  }

  // Helper method for permission checking
  checkPermissions(user, requiredRole = 'user', resourceOwnerId = null) {
    if (!user) {
      throw createError.unauthorized('Authentication required');
    }

    if (requiredRole === 'admin' && user.role !== 'admin') {
      throw createError.forbidden('Admin access required');
    }

    if (resourceOwnerId && user.id !== resourceOwnerId && user.role !== 'admin') {
      throw createError.forbidden('Access denied to this resource');
    }

    return true;
  }

  // Helper method for safe user data response
  sanitizeUserData(user) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  // Cache helpers
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      logger.debug('Cache hit', { key });
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  setCached(key, data, ttlMs = 300000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
    logger.debug('Cache set', { key, ttlMs });
  }

  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Bulk operations handler
  async processBulkOperation(db, operations, tableName) {
    const results = [];
    const errors = [];

    logger.info('Starting bulk operation', {
      tableName,
      operationCount: operations.length
    });

    for (let i = 0; i < operations.length; i++) {
      try {
        const operation = operations[i];
        const result = await this.executeQuery(
          db,
          operation.query,
          operation.params,
          operation.operation || 'run'
        );
        results.push({ index: i, success: true, result });
      } catch (error) {
        logger.error('Bulk operation item failed', error, {
          tableName,
          index: i
        });
        errors.push({ index: i, error: error.message });
      }
    }

    return { results, errors };
  }

  // Audit logging
  logUserAction(userId, action, details = {}) {
    logger.audit('User action', {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Health check helper
  async healthCheck(db) {
    try {
      await this.executeQuery(db, "SELECT 1 as health", [], 'get');
      return {
        database: 'healthy',
        cache: `${this.cache.size} items`,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime())}s`
      };
    } catch (error) {
      logger.error('Health check failed', error);
      throw createError.service('Database health check failed');
    }
  }

  // Input validation helpers
  validateRequiredFields(data, requiredFields) {
    const missing = requiredFields.filter(field =>
      data[field] === undefined || data[field] === null || data[field] === ''
    );
    if (missing.length > 0) {
      throw createError.badRequest(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  validateEmailUnique(db, email, excludeUserId = null) {
    return new Promise((resolve, reject) => {
      let query = "SELECT id FROM users WHERE email = ?";
      let params = [email];

      if (excludeUserId) {
        query += " AND id != ?";
        params.push(excludeUserId);
      }

      db.get(query, params, (err, user) => {
        if (err) {
          reject(err);
        } else if (user) {
          reject(createError.conflict('Email address is already in use'));
        } else {
          resolve(true);
        }
      });
    });
  }
}

module.exports = ApiController;