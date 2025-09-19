const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { auth } = require('../middleware/auth');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const validate = require('../middleware/validation');
const { limiters } = require('../middleware/rateLimiter');
const ApiController = require('../controllers/apiController');
const logger = require('../utils/logger');

const router = express.Router();
const apiController = new ApiController();

const JWT_SECRET = process.env.JWT_SECRET || 'biolab-logistik-secret-key';
const TOKEN_EXPIRY = '7d';

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const normalizeName = (name) => (typeof name === 'string' ? name.trim() : '');
const resolveRole = (role, isFirstSetup) => {
  if (isFirstSetup) {
    return 'admin';
  }

  const normalized = typeof role === 'string' ? role.toLowerCase() : 'employee';
  return normalized === 'admin' ? 'admin' : 'employee';
};

router.get('/first-setup', asyncHandler(async (req, res) => {
  logger.info('Checking first setup status', { ip: req.ip });

  try {
    const userCount = await apiController.executeQuery(
      db,
      "SELECT COUNT(*) as userCount FROM users",
      [],
      'get'
    );

    if (userCount.userCount === 0) {
      return apiController.sendResponse(res, {
        isFirstSetup: true
      }, 'First setup required');
    }

    const systemFlag = await apiController.executeQuery(
      db,
      "SELECT value FROM system_flags WHERE name = 'first_setup_completed'",
      [],
      'get'
    );

    const isFirstSetup = !systemFlag || systemFlag.value !== 'true';

    return apiController.sendResponse(res, {
      isFirstSetup
    }, isFirstSetup ? 'First setup required' : 'System already configured');
  } catch (error) {
    logger.error('Error checking first setup status', error, { ip: req.ip });
    throw createError.internal('Failed to check setup status');
  }
}));

router.post('/register', limiters.auth, validate.registerUser, asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const sanitizedName = normalizeName(name);
  const sanitizedEmail = normalizeEmail(email);
  const requestedRole = role || 'employee';

  logger.info('User registration attempt', {
    email: sanitizedEmail,
    requestedRole,
    ip: req.ip
  });

  const userCount = await apiController.executeQuery(
    db,
    "SELECT COUNT(*) as userCount FROM users",
    [],
    'get'
  );

  const isFirstSetup = (userCount?.userCount || 0) === 0;
  let actingUser = null;

  if (!isFirstSetup) {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Registration denied - missing token', {
        email: sanitizedEmail,
        ip: req.ip
      });
      throw createError.unauthorized('Access denied. No token provided.');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      actingUser = decoded.user;

      if (!actingUser || actingUser.role !== 'admin') {
        logger.warn('Registration denied - insufficient privileges', {
          email: sanitizedEmail,
          actorId: actingUser?.id || null,
          actorRole: actingUser?.role || null,
          ip: req.ip
        });
        throw createError.forbidden('Access denied. Admin privileges required.');
      }
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }

      logger.warn('Registration denied - invalid token', {
        email: sanitizedEmail,
        ip: req.ip,
        error: error.message
      });

      throw createError.unauthorized('Invalid token.');
    }
  }

  const existingUser = await apiController.executeQuery(
    db,
    'SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?',
    [sanitizedEmail, sanitizedName.toLowerCase()],
    'get'
  );

  if (existingUser) {
    logger.warn('Registration failed - user already exists', {
      email: sanitizedEmail,
      name: sanitizedName,
      ip: req.ip
    });
    throw createError.conflict('User with this email or name already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const userRole = resolveRole(requestedRole, isFirstSetup);

  const result = await apiController.executeQuery(
    db,
    "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
    [sanitizedName, sanitizedEmail, hashedPassword, userRole],
    'run'
  );

  if (isFirstSetup) {
    await apiController.executeQuery(
      db,
      "INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')",
      [],
      'run'
    );

    logger.info('First setup completed', {
      userId: result.id,
      email: sanitizedEmail
    });
  }

  const newUser = await apiController.executeQuery(
    db,
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [result.id],
    'get'
  );

  const safeUser = apiController.sanitizeUserData(newUser);
  const payload = { user: safeUser };

  let tokenResponse = null;
  if (isFirstSetup) {
    tokenResponse = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }

  logger.info('User registered successfully', {
    userId: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
    isFirstSetup,
    actorId: actingUser?.id || null
  });

  return apiController.sendResponse(
    res,
    {
      user: safeUser,
      isFirstSetup,
      ...(tokenResponse && { token: tokenResponse })
    },
    isFirstSetup ? 'Admin account created successfully' : 'User registered successfully',
    201
  );
}));

router.post('/login', limiters.auth, validate.loginUser, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const sanitizedEmail = normalizeEmail(email);

  logger.info('User login attempt', {
    email: sanitizedEmail,
    ip: req.ip
  });

  const userCount = await apiController.executeQuery(
    db,
    "SELECT COUNT(*) as userCount FROM users",
    [],
    'get'
  );

  if ((userCount?.userCount || 0) === 0) {
    logger.warn('Login blocked - first setup required', {
      email: sanitizedEmail,
      ip: req.ip
    });

    return res.status(403).json({
      success: false,
      error: 'First setup required',
      firstSetupRequired: true
    });
  }

  const user = await apiController.executeQuery(
    db,
    'SELECT * FROM users WHERE LOWER(email) = ?',
    [sanitizedEmail],
    'get'
  );

  if (!user) {
    logger.warn('Login failed - user not found', {
      email: sanitizedEmail,
      ip: req.ip
    });
    throw createError.unauthorized('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    logger.warn('Login failed - invalid password', {
      userId: user.id,
      email: sanitizedEmail,
      ip: req.ip
    });
    throw createError.unauthorized('Invalid credentials');
  }

  const safeUser = apiController.sanitizeUserData(user);
  const token = jwt.sign({ user: safeUser }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  logger.info('User login successful', {
    userId: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
    ip: req.ip
  });

  return apiController.sendResponse(
    res,
    {
      token,
      user: safeUser
    },
    'Login successful'
  );
}));

router.get('/user', auth, asyncHandler(async (req, res) => {
  const user = await apiController.executeQuery(
    db,
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
    [req.user.id],
    'get'
  );

  if (!user) {
    logger.warn('User profile requested but not found', {
      userId: req.user.id,
      ip: req.ip
    });
    throw createError.notFound('User not found');
  }

  return apiController.sendResponse(
    res,
    apiController.sanitizeUserData(user),
    'User profile retrieved successfully'
  );
}));

module.exports = router;
