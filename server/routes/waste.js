const express = require('express');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/waste/items
// @desc    Get all waste items
router.get('/items', auth, (req, res) => {
  try {
    db.all(
      "SELECT * FROM waste_items ORDER BY next_disposal_date ASC, name ASC",
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json(rows);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/items
// @desc    Create a new waste item (admin only)
router.post('/items', auth, adminAuth, (req, res) => {
  const { name, description, disposalInstructions, nextDisposalDate } = req.body;
  
  try {
    // Validate inputs
    if (!name || !disposalInstructions) {
      return res.status(400).json({ error: 'Name and disposal instructions are required' });
    }
    
    db.run(
      "INSERT INTO waste_items (name, description, disposal_instructions, next_disposal_date) VALUES (?, ?, ?, ?)",
      [name, description, disposalInstructions, nextDisposalDate],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ 
          id: this.lastID, 
          name, 
          description, 
          disposalInstructions, 
          nextDisposalDate 
        });
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

module.exports = router;