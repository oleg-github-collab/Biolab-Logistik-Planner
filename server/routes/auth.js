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

const router = express.Router();
const apiController = new ApiController();

// @route   GET /api/auth/first-setup
// @desc    Check if this is the first setup
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

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', limiters.auth, validate.registerUser, asyncHandler(async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;

  logger.info('User registration attempt', {
    email,
    role,
    ip: req.ip
  });

  // Check if first setup
  const userCount = await apiController.executeQuery(
    db,
    "SELECT COUNT(*) as userCount FROM users",
    [],
    'get'
  );

  const isFirstSetup = userCount.userCount === 0;

  // For non-first setup, require admin authentication
  if (!isFirstSetup) {
    apiController.checkPermissions(req.user, 'admin');
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
  const userRole = isFirstSetup ? 'admin' : role;

  // Create user
  const result = await apiController.executeQuery(
    db,
    "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
    [name, email, hashedPassword, userRole],
    'run'
  );

  // Mark first setup as completed if this is the first user
  if (isFirstSetup) {
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
    "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
    [result.id],
    'get'
  );

  logger.info('User registered successfully', {
    userId: result.id,
    email,
    role: userRole,
    isFirstSetup
  });

  return apiController.sendResponse(res, {
    user: apiController.sanitizeUserData(newUser),
    isFirstSetup
  }, 'User registered successfully', 201);
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          // Determine role for first user
          const userRole = isFirstSetup ? 'admin' : (role === 'admin' ? 'admin' : 'employee');
          
          // Insert user
          db.run(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, userRole],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              // Get the created user
              db.get(
                "SELECT id, name, email, role FROM users WHERE id = ?", 
                [this.lastID], 
                (err, user) => {
                  if (err) {
                    return res.status(500).json({ error: 'Server error' });
                  }
                  
                  // If this was the first setup, mark it as completed
                  if (isFirstSetup) {
                    db.run(
                      "INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')",
                      (err) => {
                        if (err) {
                          console.error('Error marking first setup as completed:', err);
                        } else {
                          console.log('First setup completed successfully');
                        }
                      }
                    );
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
                      
                      res.status(201).json({ 
                        token, 
                        user: payload.user,
                        message: isFirstSetup ? 'Admin account created successfully' : 'User registered successfully'
                      });
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

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
          return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
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