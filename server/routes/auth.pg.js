const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');

const router = express.Router();

// @route   GET /api/auth/first-setup
// @desc    Check if this is the first setup
router.get('/first-setup', async (req, res) => {
  logger.info('Checking first setup status', { ip: req.ip });

  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE role = 'superadmin') as superadmin_count
       FROM users`
    );

    const totalUsers = parseInt(result.rows[0].user_count);
    const superAdminCount = parseInt(result.rows[0].superadmin_count);
    const hasSuperAdmin = superAdminCount > 0;

    if (totalUsers === 0) {
      return res.json({
        isFirstSetup: true,
        reason: 'no_users'
      });
    }

    if (!hasSuperAdmin) {
      return res.json({
        isFirstSetup: true,
        reason: 'no_superadmin'
      });
    }

    return res.json({
      isFirstSetup: false,
      reason: 'ready'
    });

  } catch (error) {
    logger.error('Error checking first setup status', error, { ip: req.ip });
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  const {
    name,
    email,
    password,
    role = 'employee',
    employment_type = 'Werkstudent',
    weekly_hours_quota
  } = req.body;

  try {
    logger.info('User registration attempt', {
      email,
      role,
      employment_type,
      ip: req.ip
    });

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Check system status
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE role = 'superadmin') as superadmin_count
       FROM users`
    );

    const totalUsers = parseInt(statsResult.rows[0].user_count);
    const superAdminCount = parseInt(statsResult.rows[0].superadmin_count);
    const hasSuperAdmin = superAdminCount > 0;
    const isInitialSetup = totalUsers === 0;
    const isSuperAdminMissing = !hasSuperAdmin;
    const allowOpenRegistration = isInitialSetup || isSuperAdminMissing;

    // For environments with an existing superadmin, require authentication
    if (!allowOpenRegistration) {
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        return res.status(401).json({ error: 'Superadmin authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      let decoded;

      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const actingUserResult = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.user.id]
      );

      if (actingUserResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found. Please login again.' });
      }

      const actingUser = actingUserResult.rows[0];
      if (actingUser.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin permissions required' });
      }
    }

    // Check if user exists
    const existingResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR name = $2',
      [email, name]
    );

    if (existingResult.rows.length > 0) {
      logger.warn('Registration failed - user exists', { email, ip: req.ip });
      return res.status(409).json({ error: 'User with this email or name already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Set role for first user
    const allowedRoles = ['employee', 'admin', 'superadmin'];
    const requestedRole = allowedRoles.includes(role) ? role : 'employee';
    const userRole = allowOpenRegistration ? 'superadmin' : requestedRole;

    // Calculate weekly hours quota based on employment type
    let hoursQuota = weekly_hours_quota;
    if (!hoursQuota) {
      if (employment_type === 'Vollzeit') {
        hoursQuota = 40.0;
      } else if (employment_type === 'Werkstudent') {
        hoursQuota = 20.0;
      } else {
        hoursQuota = 20.0; // Default
      }
    }

    // Create user
    const insertResult = await pool.query(
      `INSERT INTO users (
        name, email, password, role, employment_type, weekly_hours_quota,
        first_login_completed, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING id, name, email, role, employment_type, weekly_hours_quota,
                first_login_completed, created_at`,
      [name, email, hashedPassword, userRole, employment_type, hoursQuota, false]
    );

    const newUser = insertResult.rows[0];

    // Remove password from response
    const sanitizedUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      employment_type: newUser.employment_type,
      weekly_hours_quota: parseFloat(newUser.weekly_hours_quota),
      first_login_completed: newUser.first_login_completed,
      created_at: newUser.created_at
    };

    let token = null;
    if (allowOpenRegistration) {
      const payload = {
        user: {
          id: sanitizedUser.id,
          name: sanitizedUser.name,
          email: sanitizedUser.email,
          role: sanitizedUser.role
        }
      };

      token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'biolab-logistik-secret-key',
        { expiresIn: '7d' }
      );
    }

    logger.info('User registered successfully', {
      userId: newUser.id,
      email,
      role: userRole,
      employmentType: employment_type,
      isFirstSetup: allowOpenRegistration
    });

    // Audit log
    auditLogger.logAuth('user_registered', newUser.id, email, {
      role: userRole,
      employmentType: employment_type,
      weeklyHoursQuota: hoursQuota,
      isFirstSetup: allowOpenRegistration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(201).json({
      user: sanitizedUser,
      token,
      isFirstSetup: allowOpenRegistration,
      message: 'User registered successfully'
    });

  } catch (error) {
    logger.error('Registration error', error, { email: req.body.email });
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if first setup is required
    const statsResult = await pool.query(
      'SELECT COUNT(*) as user_count FROM users'
    );

    const totalUsers = parseInt(statsResult.rows[0].user_count);

    if (totalUsers === 0) {
      return res.status(403).json({
        error: 'First setup required',
        firstSetupRequired: true
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      `SELECT id, name, email, password, role, employment_type,
              weekly_hours_quota, first_login_completed
       FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      auditLogger.logAuth('login_failed', null, email, {
        reason: 'user_not_found',
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

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

    // Create JWT payload (without password)
    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };

    // Sign token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'biolab-logistik-secret-key',
      { expiresIn: '7d' }
    );

    auditLogger.logAuth('login_success', user.id, email, {
      role: user.role,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employment_type: user.employment_type,
        weekly_hours_quota: parseFloat(user.weekly_hours_quota),
        first_login_completed: user.first_login_completed
      },
      message: 'Login successful'
    });

  } catch (error) {
    logger.error('Login error', error, { email: req.body.email });
    res.status(500).json({ error: 'Server error during login' });
  }
});

// @route   GET /api/auth/user
// @desc    Get current user data
router.get('/user', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, employment_type,
              weekly_hours_quota, first_login_completed, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employment_type: user.employment_type,
      weekly_hours_quota: parseFloat(user.weekly_hours_quota),
      first_login_completed: user.first_login_completed,
      created_at: user.created_at
    });

  } catch (error) {
    logger.error('Error fetching user data', error, { userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/complete-first-login
// @desc    Complete first login and set weekly hours quota
router.post('/complete-first-login', auth, async (req, res) => {
  const { weekly_hours_quota } = req.body;

  try {
    // Validate quota
    const quota = parseFloat(weekly_hours_quota);
    if (isNaN(quota) || quota <= 0 || quota > 80) {
      return res.status(400).json({
        error: 'Weekly hours quota must be between 0 and 80'
      });
    }

    // Update user
    const result = await pool.query(
      `UPDATE users
       SET weekly_hours_quota = $1, first_login_completed = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, role, employment_type, weekly_hours_quota, first_login_completed`,
      [quota, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    auditLogger.logDataChange('update', req.user.id, 'user', req.user.id, {
      action: 'complete_first_login',
      weekly_hours_quota: quota,
      ip: req.ip
    });

    logger.info('First login completed', {
      userId: req.user.id,
      weeklyHoursQuota: quota
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employment_type: user.employment_type,
        weekly_hours_quota: parseFloat(user.weekly_hours_quota),
        first_login_completed: user.first_login_completed
      },
      message: 'First login completed successfully'
    });

  } catch (error) {
    logger.error('Error completing first login', error, { userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
