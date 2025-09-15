const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, isFirstSetupRequired } = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/auth/first-setup
// @desc    Check if this is the first setup
router.get('/first-setup', (req, res) => {
  isFirstSetupRequired((err, isFirstSetup) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    res.json({ 
      isFirstSetup: isFirstSetup,
      message: isFirstSetup ? 'First setup required' : 'System already configured'
    });
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'employee' } = req.body;
  
  try {
    // Always check if first setup is required
    isFirstSetupRequired(async (err, isFirstSetup) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      // For first setup, allow registration without authentication
      // For subsequent registrations, require admin authentication
      if (!isFirstSetup) {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
          
          if (decoded.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid token.' });
        }
      }
      
      // Validate inputs
      if (!name?.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      if (!email?.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      // Check if user already exists
      db.get("SELECT id FROM users WHERE email = ? OR name = ?", [email, name], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (existingUser) {
          return res.status(400).json({ 
            error: 'User with this email or name already exists' 
          });
        }
        
        // Hash password
        bcrypt.hash(password, 10, (err, hashedPassword) => {
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
    isFirstSetupRequired((err, isFirstSetup) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (isFirstSetup) {
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