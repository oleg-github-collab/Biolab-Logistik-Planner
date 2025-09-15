const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/auth/first-setup
// @desc    Check if this is the first setup (no users exist)
router.get('/first-setup', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    res.json({ 
      isFirstSetup: row.count === 0,
      userCount: row.count
    });
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user (admin only, or first user during setup)
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'employee' } = req.body;
  
  try {
    // Check if this is the first setup
    db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      const isFirstSetup = row.count === 0;
      const isValidRole = ['employee', 'admin'].includes(role);
      
      // If not first setup, require admin privileges
      if (!isFirstSetup) {
        // For non-first-setup, we need to validate JWT
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
          
          // Check if user is admin
          if (decoded.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid token.' });
        }
      }
      
      if (!isValidRole) {
        return res.status(400).json({ error: 'Invalid role specified' });
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
          
          // Insert user
          db.run(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, role],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              // If this is the first user, make them admin automatically
              const userRole = isFirstSetup ? 'admin' : role;
              
              // Get the created user
              db.get(
                "SELECT id, name, email, role FROM users WHERE id = ?", 
                [this.lastID], 
                (err, user) => {
                  if (err) {
                    return res.status(500).json({ error: 'Server error' });
                  }
                  
                  // If this was the first setup, update role to admin
                  if (isFirstSetup) {
                    db.run(
                      "UPDATE users SET role = 'admin' WHERE id = ?",
                      [user.id],
                      (err) => {
                        if (err) {
                          console.error('Error updating first user to admin:', err);
                        } else {
                          user.role = 'admin';
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
                        message: isFirstSetup ? 'First admin user created successfully' : 'User registered successfully'
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