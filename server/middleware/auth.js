const jwt = require('jsonwebtoken');
const db = require('../database'); // Import db directly

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');
    req.user = decoded.user;
    
    // Verify user exists in database
    db.get("SELECT id, name, email, role FROM users WHERE id = ?", [req.user.id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'User not found. Please login again.' });
      }
      
      // Update req.user with current user data from database
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      
      next();
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

const adminAuth = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

const superAdminAuth = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Superadmin privileges required.' });
  }
  next();
};

module.exports = { auth, adminAuth, superAdminAuth };
