const jwt = require('jsonwebtoken');
const db = require('../database');
const { pool } = require('../config/database');
const { createError, asyncHandler } = require('./errorHandler');
const logger = require('../utils/logger');

// Role hierarchy and permissions
const ROLES = {
  USER: 'user',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
};

const PERMISSIONS = {
  // Schedule permissions
  'schedule:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:manage': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Message permissions
  'message:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'message:send': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'message:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Waste management permissions
  'waste:read': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Task permissions
  'task:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:assign': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // User management permissions
  'user:read': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:create': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:update': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:delete': [ROLES.SUPERADMIN],
  'user:role': [ROLES.SUPERADMIN],

  // Template permissions
  'template:read': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:create': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:update': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:delete': [ROLES.SUPERADMIN],

  // System permissions
  'system:settings': [ROLES.SUPERADMIN],
  'system:logs': [ROLES.ADMIN, ROLES.SUPERADMIN],
};

// Check if user has permission
const hasPermission = (userRole, permission) => {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    logger.warn('Unknown permission requested', { permission, userRole });
    return false;
  }
  return allowedRoles.includes(userRole);
};

// Authentication middleware
const getUserFromPostgres = async (userId) => {
  if (!userId) return null;
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, employment_type FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('PostgreSQL lookup failed during auth', {
      userId,
      error: error.message
    });
    throw error;
  }
};

const getUserFromSQLite = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, name, email, role, employment_type FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          logger.error('SQLite lookup failed during auth', {
            userId,
            error: err.message
          });
          return reject(err);
        }
        resolve(user || null);
      }
    );
  });
};

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    logger.security('Authentication attempt without token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
    });
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');

    let user = null;

    // Prefer PostgreSQL users (new stack)
    try {
      user = await getUserFromPostgres(decoded.user.id);
    } catch (pgError) {
      // Already logged inside helper, continue to fallback
    }

    // Fallback to legacy SQLite users if Postgres not available / empty
    if (!user) {
      user = await getUserFromSQLite(decoded.user.id);
    }

    if (!user) {
      logger.security('Authentication with non-existent user', {
        userId: decoded.user.id,
        ip: req.ip,
      });
      return res.status(401).json({ error: 'User not found. Please login again.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employment_type: user.employment_type
    };

    logger.audit('User authenticated successfully', {
      userId: user.id,
      role: user.role,
      url: req.originalUrl,
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.security('Invalid token attempt', {
        ip: req.ip,
        error: error.message,
      });
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      logger.security('Expired token attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    logger.error('Authentication error', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Role-based middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Role check without authenticated user');
      throw createError.unauthorized('Authentication required.');
    }

    if (!roles.includes(req.user.role)) {
      logger.security('Unauthorized role access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        url: req.originalUrl,
      });
      throw createError.forbidden(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

// Permission-based middleware
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required.');
    }

    const hasAllPermissions = permissions.every(permission =>
      hasPermission(req.user.role, permission)
    );

    if (!hasAllPermissions) {
      logger.security('Unauthorized permission access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermissions: permissions,
        url: req.originalUrl,
      });
      throw createError.forbidden('You do not have permission to perform this action.');
    }

    logger.audit('Permission granted', {
      userId: req.user.id,
      permissions,
      url: req.originalUrl,
    });

    next();
  };
};

// Ownership check middleware (user can only access their own resources)
const requireOwnership = (resourceKey = 'id') => {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[resourceKey]);

    // Admins and superadmins can access any resource
    if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
      return next();
    }

    // Regular users can only access their own resources
    if (resourceId !== req.user.id) {
      logger.security('Ownership violation attempt', {
        userId: req.user.id,
        resourceId,
        url: req.originalUrl,
      });
      throw createError.forbidden('You can only access your own resources.');
    }

    next();
  };
};

// Convenience middleware
const adminAuth = requireRole(ROLES.ADMIN, ROLES.SUPERADMIN);
const superAdminAuth = requireRole(ROLES.SUPERADMIN);
const employeeAuth = requireRole(ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN);

module.exports = {
  auth,
  requireRole,
  requirePermission,
  requireOwnership,
  adminAuth,
  superAdminAuth,
  employeeAuth,
  hasPermission,
  ROLES,
  PERMISSIONS,
};
