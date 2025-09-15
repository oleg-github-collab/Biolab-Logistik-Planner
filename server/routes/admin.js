const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// A helper function to promisify db.all for use with async/await
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// A helper function to promisify db.get
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// A helper function to promisify db.run
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    // Use 'function' to access 'this' for lastID and changes
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
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
    const user = await dbGet("SELECT id FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 2. Check for email conflicts
    if (email) {
      const existingEmailUser = await dbGet("SELECT id FROM users WHERE email = ? AND id != ?", [email, id]);
      if (existingEmailUser) {
        return res.status(400).json({ error: 'Email already in use by another user' });
      }
    }
    
    // 3. Check for name conflicts
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
    if (role && ['employee', 'admin'].includes(role)) {
      updateFields.push("role = ?");
      updateValues.push(role);
    }
    
    // 5. Hash password if provided (this is now valid within an async function)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?");
      updateValues.push(hashedPassword);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
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
    const user = await dbGet("SELECT id, name FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user
    await dbRun("DELETE FROM users WHERE id = ?", [id]);
    
    res.json({ 
      message: `User ${user.name} deleted successfully`,
      deletedId: id
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;