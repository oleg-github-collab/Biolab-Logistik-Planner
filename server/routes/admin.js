const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const auditLogger = require('../utils/auditLog');
const { getIO, getOnlineUsers } = require('../websocket');
const router = express.Router();

// Helper functions to wrap sqlite3 callback API in Promises for async/await
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) { // Use 'function' to access 'this'
      if (err) return reject(err);
      resolve(this);
    });
  });
};


// @route   GET /api/admin/users
// @desc    Get all users (admin only)
router.get('/users', [auth, adminAuth], async (req, res) => {
  try {
    const users = await dbAll("SELECT id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, created_at FROM users ORDER BY name");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin only)
router.put('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, employment_type, auto_schedule, default_start_time, default_end_time } = req.body;
  
  try {
    // 1. Check if user exists
    const user = await dbGet("SELECT id, role FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admins from modifying superadmin accounts
    if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can modify superadmin accounts' });
    }
    
    // 2. Check for email conflicts if email is being updated
    if (email) {
      const existingEmailUser = await dbGet("SELECT id FROM users WHERE email = ? AND id != ?", [email, id]);
      if (existingEmailUser) {
        return res.status(400).json({ error: 'Email already in use by another user' });
      }
    }
    
    // 3. Check for name conflicts if name is being updated
    if (name) {
      const existingNameUser = await dbGet("SELECT id FROM users WHERE name = ? AND id != ?", [name, id]);
      if (existingNameUser) {
        return res.status(400).json({ error: 'Name already in use by another user' });
      }
    }

    // 4. Build the update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (role) {
      const allowedRoles = ['employee', 'admin', 'superadmin'];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified' });
      }

      if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can assign the superadmin role' });
      }

      if (user.role === 'superadmin' && role !== 'superadmin') {
        const superAdminCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'");
        if (superAdminCount.count <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last superadmin' });
        }
      }

      updateFields.push("role = ?");
      updateValues.push(role);
    }

    if (employment_type) {
      const allowedTypes = ['Vollzeit', 'Werkstudent'];
      if (!allowedTypes.includes(employment_type)) {
        return res.status(400).json({ error: 'Invalid employment type specified' });
      }
      updateFields.push("employment_type = ?");
      updateValues.push(employment_type);

      // Auto-set auto_schedule based on employment_type
      updateFields.push("auto_schedule = ?");
      updateValues.push(employment_type === 'Vollzeit' ? 1 : 0);
    }

    if (auto_schedule !== undefined) {
      updateFields.push("auto_schedule = ?");
      updateValues.push(auto_schedule ? 1 : 0);
    }

    if (default_start_time) {
      updateFields.push("default_start_time = ?");
      updateValues.push(default_start_time);
    }

    if (default_end_time) {
      updateFields.push("default_end_time = ?");
      updateValues.push(default_end_time);
    }

    // 5. Hash password if provided (this is now valid within the async function)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?");
      updateValues.push(hashedPassword);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update provided' });
    }
    
    // Add updated_at timestamp
    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    
    // 6. Build and execute the final update query
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);
    
    await dbRun(query, updateValues);
    
    // 7. Get the updated user data to send back
    const updatedUser = await dbGet("SELECT id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, created_at FROM users WHERE id = ?", [id]);
    
    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/admin/users
// @desc    Create new user (admin only)
router.post('/users', [auth, adminAuth], async (req, res) => {
  const { name, email, password, role = 'employee', employment_type = 'Werkstudent', default_start_time = '08:00', default_end_time = '17:00' } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate employment type
    const allowedTypes = ['Vollzeit', 'Werkstudent'];
    if (!allowedTypes.includes(employment_type)) {
      return res.status(400).json({ error: 'Invalid employment type. Must be Vollzeit or Werkstudent' });
    }

    // Validate role
    const allowedRoles = ['employee', 'admin', 'superadmin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can create superadmin accounts' });
    }

    // Check if email already exists
    const existingEmailUser = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
    if (existingEmailUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Check if name already exists
    const existingNameUser = await dbGet("SELECT id FROM users WHERE name = ?", [name]);
    if (existingNameUser) {
      return res.status(400).json({ error: 'Name already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Set auto_schedule based on employment_type
    const auto_schedule = employment_type === 'Vollzeit' ? 1 : 0;

    // Create user
    const result = await dbRun(
      `INSERT INTO users (name, email, password, role, employment_type, auto_schedule, default_start_time, default_end_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [name, email, hashedPassword, role, employment_type, auto_schedule, default_start_time, default_end_time]
    );

    // Get the created user
    const newUser = await dbGet("SELECT id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, created_at FROM users WHERE id = ?", [result.lastID]);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
router.delete('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;
  
  // Prevent deleting the current admin user
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  try {
    // Check if user exists
    const user = await dbGet("SELECT id, name, role FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'superadmin') {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can delete superadmin accounts' });
      }

      const superAdminCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'");
      if (superAdminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin' });
      }
    }
    
    // Delete user
    await dbRun("DELETE FROM users WHERE id = ?", [id]);
    
    res.json({ 
      message: `User ${user.name} deleted successfully`,
      deletedId: id
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/admin/audit/stats
// @desc    Get audit statistics (admin only)
router.get('/audit/stats', [auth, adminAuth], async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await auditLogger.getStatistics(days);
    res.json(stats);
  } catch (err) {
    console.error('Get audit stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/admin/audit/logs
// @desc    Get audit logs (admin only)
router.get('/audit/logs', [auth, adminAuth], async (req, res) => {
  try {
    const { category, severity, limit = 50, userId, action } = req.query;

    const filters = {
      limit: parseInt(limit)
    };

    if (category && category !== 'all') filters.category = category;
    if (severity && severity !== 'all') filters.severity = severity;
    if (userId) filters.userId = parseInt(userId);
    if (action) filters.action = action;

    const logs = await auditLogger.query(filters);
    res.json({ logs });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/admin/audit/export
// @desc    Export audit logs (admin only)
router.get('/audit/export', [auth, adminAuth], async (req, res) => {
  try {
    const { format = 'json', days = 7, category, severity, userId } = req.query;

    const filters = {
      limit: 10000
    };

    if (category && category !== 'all') filters.category = category;
    if (severity && severity !== 'all') filters.severity = severity;
    if (userId) filters.userId = parseInt(userId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    filters.startDate = startDate.toISOString();
    filters.endDate = endDate.toISOString();

    const exportData = await auditLogger.export(filters, format);

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.${format}`);
    res.send(exportData);
  } catch (err) {
    console.error('Export audit logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/admin/users/online
// @desc    Get list of online users (admin only)
router.get('/users/online', [auth, adminAuth], async (req, res) => {
  try {
    const onlineUsers = getOnlineUsers();
    const usersWithDetails = [];

    for (const userId of onlineUsers) {
      const user = await dbGet(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [userId]
      );
      if (user) {
        usersWithDetails.push(user);
      }
    }

    res.json({ users: usersWithDetails });
  } catch (err) {
    console.error('Get online users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/admin/broadcast
// @desc    Broadcast message to all users (admin only)
router.post('/broadcast', [auth, adminAuth], async (req, res) => {
  try {
    const { message, type = 'info' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const io = getIO();
    if (io) {
      io.emit('admin:broadcast', {
        message,
        type,
        timestamp: new Date().toISOString(),
        from: req.user.name
      });
    }

    auditLogger.logSystem('admin_broadcast', {
      adminId: req.user.id,
      adminName: req.user.name,
      message,
      type,
      severity: 'medium'
    });

    res.json({ message: 'Broadcast sent successfully' });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
