const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
router.get('/users', [auth, adminAuth], (req, res) => {
  db.all("SELECT id, name, email, role, created_at FROM users ORDER BY name", (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    res.json(users);
  });
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin only)
router.put('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body;
  
  try {
    // Check if user exists
    db.get("SELECT id FROM users WHERE id = ?", [id], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check for email conflicts
      let emailCheckQuery = "SELECT id FROM users WHERE email = ? AND id != ?";
      db.get(emailCheckQuery, [email, id], (err, existingEmailUser) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (existingEmailUser) {
          return res.status(400).json({ error: 'Email already in use by another user' });
        }
        
        // Check for name conflicts
        let nameCheckQuery = "SELECT id FROM users WHERE name = ? AND id != ?";
        db.get(nameCheckQuery, [name, id], (err, existingNameUser) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          if (existingNameUser) {
            return res.status(400).json({ error: 'Name already in use by another user' });
          }
          
          // Build update query
          let updateFields = [];
          let updateValues = [];
          
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
          
          if (password) {
            // Hash new password
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push("password = ?");
            updateValues.push(hashedPassword);
          }
          
          if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
          }
          
          // Add updated_at
          updateFields.push("updated_at = CURRENT_TIMESTAMP");
          
          // Build and execute update query
          let query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
          updateValues.push(id);
          
          db.run(query, updateValues, function(err) {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            
            // Get updated user
            db.get("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [id], (err, updatedUser) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              res.json({
                message: 'User updated successfully',
                user: updatedUser
              });
            });
          });
        });
      });
    });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
router.delete('/users/:id', [auth, adminAuth], (req, res) => {
  const { id } = req.params;
  
  // Prevent deleting the current admin user
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Check if user exists
  db.get("SELECT id, name FROM users WHERE id = ?", [id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user
    db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      res.json({ 
        message: `User ${user.name} deleted successfully`,
        deletedId: id
      });
    });
  });
});

module.exports = router;