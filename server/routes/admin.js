const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
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
    const users = await dbAll("SELECT id, name, email, role, created_at FROM users ORDER BY name");
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
  const { name, email, role, password } = req.body;
  
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
    const updatedUser = await dbGet("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [id]);
    
    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (err) {
    console.error('Update user error:', err.message);
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

module.exports = router;
