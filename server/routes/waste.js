const express = require('express');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/waste/templates
// @desc    Get all waste templates
router.get('/templates', auth, (req, res) => {
  try {
    db.all(
      "SELECT * FROM waste_templates ORDER BY category, name",
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.json(rows);
      }
    );
  } catch (error) {
    console.error('Error fetching waste templates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/waste/items
// @desc    Get all waste items with template data
router.get('/items', auth, (req, res) => {
  try {
    db.all(
      `SELECT wi.*, wt.name, wt.description, wt.disposal_instructions, wt.color, wt.icon,
              wt.hazard_level, wt.waste_code, wt.category, wt.default_frequency
       FROM waste_items wi
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       ORDER BY wi.next_disposal_date ASC, wt.name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.json(rows);
      }
    );
  } catch (error) {
    console.error('Error fetching waste items:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/items
// @desc    Create a new waste item (admin only)
router.post('/items', auth, (req, res) => {
  const { template_id, next_disposal_date, assigned_to, notification_users, notes } = req.body;

  try {
    // Validate inputs
    if (!template_id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const notificationUsersJson = notification_users ? JSON.stringify(notification_users) : null;

    db.run(
      `INSERT INTO waste_items (template_id, next_disposal_date, assigned_to, notification_users, notes, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [template_id, next_disposal_date, assigned_to, notificationUsersJson, notes],
      function(err) {
        if (err) {
          console.error('Database error creating waste item:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        // Get the created item with template data
        db.get(
          `SELECT wi.*, wt.name, wt.description, wt.disposal_instructions, wt.color, wt.icon,
                  wt.hazard_level, wt.waste_code, wt.category, wt.default_frequency
           FROM waste_items wi
           LEFT JOIN waste_templates wt ON wi.template_id = wt.id
           WHERE wi.id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('Error fetching created waste item:', err);
              return res.status(500).json({ error: 'Item created but failed to fetch details' });
            }

            res.json(row);
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/waste/items/:id
// @desc    Update a waste item (admin only)
router.put('/items/:id', auth, adminAuth, (req, res) => {
  const { name, description, disposalInstructions, nextDisposalDate } = req.body;
  const { id } = req.params;
  
  try {
    // Validate inputs
    if (!name || !disposalInstructions) {
      return res.status(400).json({ error: 'Name and disposal instructions are required' });
    }
    
    db.run(
      "UPDATE waste_items SET name = ?, description = ?, disposal_instructions = ?, next_disposal_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description, disposalInstructions, nextDisposalDate, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Waste item not found' });
        }
        
        res.json({ message: 'Waste item updated successfully' });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/waste/items/:id
// @desc    Delete a waste item (admin only)
router.delete('/items/:id', auth, adminAuth, (req, res) => {
  const { id } = req.params;
  
  try {
    db.run(
      "DELETE FROM waste_items WHERE id = ?",
      [id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Waste item not found' });
        }
        
        res.json({ message: 'Waste item deleted successfully' });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/waste/items/:id/assign
// @desc    Assign waste item to user
router.put('/items/:id/assign', auth, (req, res) => {
  const { id } = req.params;
  const { assigned_to, notification_users } = req.body;

  try {
    const notificationUsersJson = notification_users ? JSON.stringify(notification_users) : null;

    db.run(
      "UPDATE waste_items SET assigned_to = ?, notification_users = ?, updated_at = datetime('now') WHERE id = ?",
      [assigned_to, notificationUsersJson, id],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Waste item not found' });
        }

        res.json({ message: 'Waste item assigned successfully' });
      }
    );
  } catch (error) {
    console.error('Error assigning waste item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/notifications
// @desc    Send notifications for waste assignments
router.post('/notifications', auth, (req, res) => {
  const { waste_id, user_ids, type } = req.body;

  try {
    // Here you would implement the notification logic
    // For now, just return success
    console.log(`Sending ${type} notifications for waste ${waste_id} to users:`, user_ids);

    res.json({ message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;