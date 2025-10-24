const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const validate = require('../middleware/validation');
const { limiters } = require('../middleware/rateLimiter');
const ApiController = require('../controllers/apiController');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');

const router = express.Router();
const apiController = new ApiController();
const { autoScheduleOnEmploymentChange } = require('../utils/scheduleHelper');

// @route   GET /api/auth/first-setup
// @desc    Check if this is the first setup
router.get('/first-setup', asyncHandler(async (req, res) => {
  logger.info('Checking first setup status', { ip: req.ip });

  try {
    const userStats = await apiController.executeQuery(
      db,
      "SELECT COUNT(*) as userCount, SUM(CASE WHEN role = 'superadmin' THEN 1 ELSE 0 END) as superAdminCount FROM users",
      [],
      'get'
    );

    const totalUsers = userStats?.userCount || 0;
    const superAdminCount = userStats?.superAdminCount || 0;
    const hasSuperAdmin = superAdminCount > 0;

    if (totalUsers === 0) {
      return apiController.sendResponse(res, {
        isFirstSetup: true,
        reason: 'no_users'
      }, 'First setup required');
    }

    if (!hasSuperAdmin) {
      return apiController.sendResponse(res, {
        isFirstSetup: true,
        reason: 'no_superadmin'
      }, 'Superadmin setup required');
    }

    const systemFlag = await apiController.executeQuery(
      db,
      "SELECT value FROM system_flags WHERE name = 'first_setup_completed'",
      [],
      'get'
    );

    const isFirstSetup = !systemFlag || systemFlag.value !== 'true';

    return apiController.sendResponse(res, {
      isFirstSetup,
      reason: isFirstSetup ? 'flag_not_completed' : 'ready'
    }, isFirstSetup ? 'First setup required' : 'System already configured');

  } catch (error) {
    logger.error('Error checking first setup status', error, { ip: req.ip });
    throw createError.internal('Failed to check setup status');
  }
}));

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', limiters.auth, validate.registerUser, asyncHandler(async (req, res) => {
  const { name, email, password, role = 'user', employment_type = 'Werkstudent' } = req.body;

  logger.info('User registration attempt', {
    email,
    role,
    ip: req.ip
  });

  const userStats = await apiController.executeQuery(
    db,
    "SELECT COUNT(*) as userCount, SUM(CASE WHEN role = 'superadmin' THEN 1 ELSE 0 END) as superAdminCount FROM users",
    [],
    'get'
  );

  const totalUsers = userStats?.userCount || 0;
  const superAdminCount = userStats?.superAdminCount || 0;
  const hasSuperAdmin = superAdminCount > 0;
  const isInitialSetup = totalUsers === 0;
  const isSuperAdminMissing = !hasSuperAdmin;
  const allowOpenRegistration = isInitialSetup || isSuperAdminMissing;

  // For environments with an existing superadmin, require authentication
  if (!allowOpenRegistration) {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      throw createError.unauthorized('Superadmin authentication required');
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
    } catch (error) {
      throw createError.unauthorized('Invalid or expired token');
    }

    const actingUser = await apiController.executeQuery(
      db,
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [decoded.user.id],
      'get'
    );

    if (!actingUser) {
      throw createError.unauthorized('User not found. Please login again.');
    }

    req.user = actingUser;
    apiController.checkPermissions(req.user, 'superadmin');
  }

  // Check if user exists
  const existingUser = await apiController.executeQuery(
    db,
    "SELECT id FROM users WHERE email = ? OR name = ?",
    [email, name],
    'get'
  );

  if (existingUser) {
    logger.warn('Registration failed - user exists', { email, ip: req.ip });
    throw createError.conflict('User with this email or name already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Set role for first user
  const normalizedRole = role === 'user' ? 'employee' : role;
  const allowedRoles = ['employee', 'admin', 'superadmin'];
  const requestedRole = allowedRoles.includes(normalizedRole) ? normalizedRole : 'employee';

  const userRole = allowOpenRegistration ? 'superadmin' : requestedRole;

  // Create user
  const result = await apiController.executeQuery(
    db,
    "INSERT INTO users (name, email, password, role, employment_type, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    [name, email, hashedPassword, userRole, employment_type],
    'run'
  );

  // Mark first setup as completed if this is the first user
  if (allowOpenRegistration) {
    await apiController.executeQuery(
      db,
      "INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')",
      [],
      'run'
    );

    logger.info('First setup completed', { userId: result.id, email });
  }

  // Get created user (without password)
  const newUser = await apiController.executeQuery(
    db,
    "SELECT id, name, email, role, employment_type, created_at FROM users WHERE id = ?",
    [result.id],
    'get'
  );

  const sanitizedUser = apiController.sanitizeUserData(newUser);

  let token = null;
  if (allowOpenRegistration) {
    const payload = {
      user: sanitizedUser
    };

    token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'biolab-logistik-secret-key',
      { expiresIn: '7d' }
    );
  }

  // Auto-schedule if Vollzeit
  if (employment_type === 'Vollzeit') {
    try {
      await autoScheduleOnEmploymentChange(result.id, employment_type);
      logger.info('Auto-schedule completed for Vollzeit employee', { userId: result.id });
    } catch (scheduleErr) {
      logger.warn('Auto-schedule failed but continuing', { userId: result.id, error: scheduleErr.message });
    }
  }

  logger.info('User registered successfully', {
    userId: result.id,
    email,
    role: userRole,
    employmentType: employment_type,
    isFirstSetup: allowOpenRegistration
  });

  // Audit log
  auditLogger.logAuth('user_registered', result.id, email, {
    role: userRole,
    employmentType: employment_type,
    isFirstSetup: allowOpenRegistration,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  return apiController.sendResponse(res, {
    user: sanitizedUser,
    token,
    isFirstSetup: allowOpenRegistration
  }, 'User registered successfully', 201);
}));

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // First, check if first setup is required
    db.get("SELECT COUNT(*) as userCount FROM users", (err, userRow) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (userRow.userCount === 0) {
        return res.status(403).json({ 
          error: 'First setup required', 
          firstSetupRequired: true 
        });
      }
      
      // Check if user exists
      db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
          auditLogger.logAuth('login_failed', null, email, {
            reason: 'user_not_found',
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
          return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          auditLogger.logAuth('login_failed', user.id, email, {
            reason: 'invalid_password',
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
          return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        // Create JWT payload
        const payload = {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        };
        
        // Sign token
        jwt.sign(
          payload,
          process.env.JWT_SECRET || 'biolab-logistik-secret-key',
          { expiresIn: '7d' },
          (err, token) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }

            auditLogger.logAuth('login_success', user.id, email, {
              role: user.role,
              ip: req.ip,
              userAgent: req.get('user-agent')
            });

            res.json({
              token,
              user: payload.user,
              message: 'Login successful'
            });
          }
        );
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/auth/user
// @desc    Get user data
router.get('/user', auth, (req, res) => {
  db.get("SELECT id, name, email, role FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });
});

module.exports = router;
