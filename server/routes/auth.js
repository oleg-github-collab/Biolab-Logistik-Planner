const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

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
      
      // In production, you'd hash passwords
      // For simplicity, we're comparing plain text
      // const isMatch = await bcrypt.compare(password, user.password);
      const isMatch = password === user.password;
      
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
          if (err) throw err;
          res.json({ token, user: payload.user });
        }
      );
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/auth/user
// @desc    Get user data
router.get('/user', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
    
    db.get("SELECT id, name, email, role FROM users WHERE id = ?", [decoded.user.id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
});

module.exports = router;