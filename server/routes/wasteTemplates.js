const express = require('express');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/waste/templates
// @desc    Get all waste templates
router.get('/templates', auth, (req, res) => {
  try {
    db.all(
      "SELECT * FROM waste_templates ORDER BY name",
      (err, templates) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json(templates);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/templates
// @desc    Create a new waste template (admin only)
router.post('/templates', [auth, adminAuth], (req, res) => {
  try {
    const { 
      name, 
      description, 
      disposalInstructions, 
      color = '#A9D08E',
      icon = 'trash',
      defaultFrequency = 'weekly',
      defaultNextDate
    } = req.body;
    
    // Validate inputs
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    if (!disposalInstructions?.trim()) {
      return res.status(400).json({ error: 'Disposal instructions are required' });
    }
    
    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFrequencies.includes(defaultFrequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    
    db.run(
      `INSERT INTO waste_templates (
        name, description, disposal_instructions, color, icon, 
        default_frequency, default_next_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        disposalInstructions,
        color,
        icon,
        defaultFrequency,
        defaultNextDate || null
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        db.get(
          "SELECT * FROM waste_templates WHERE id = ?",
          [this.lastID],
          (err, template) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            
            res.status(201).json(template);
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/waste/templates/:id
// @desc    Update a waste template (admin only)
router.put('/templates/:id', [auth, adminAuth], (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      disposalInstructions, 
      color,
      icon,
      defaultFrequency,
      defaultNextDate
    } = req.body;
    
    // First, verify the template exists
    db.get(
      "SELECT id FROM waste_templates WHERE id = ?",
      [id],
      (err, template) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
          if (!name?.trim()) {
            return res.status(400).json({ error: 'Name is required' });
          }
          updates.push("name = ?");
          values.push(name);
        }
        
        if (description !== undefined) {
          updates.push("description = ?");
          values.push(description || null);
        }
        
        if (disposalInstructions !== undefined) {
          if (!disposalInstructions?.trim()) {
            return res.status(400).json({ error: 'Disposal instructions are required' });
          }
          updates.push("disposal_instructions = ?");
          values.push(disposalInstructions);
        }
        
        if (color !== undefined) {
          updates.push("color = ?");
          values.push(color);
        }
        
        if (icon !== undefined) {
          updates.push("icon = ?");
          values.push(icon);
        }
        
        if (defaultFrequency !== undefined) {
          const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
          if (!validFrequencies.includes(defaultFrequency)) {
            return res.status(400).json({ error: 'Invalid frequency' });
          }
          updates.push("default_frequency = ?");
          values.push(defaultFrequency);
        }
        
        if (defaultNextDate !== undefined) {
          updates.push("default_next_date = ?");
          values.push(defaultNextDate || null);
        }
        
        updates.push("updated_at = CURRENT_TIMESTAMP");
        
        if (updates.length === 1) { // Only updated_at was added
          return res.status(400).json({ error: 'No fields to update' });
        }
        
        const query = `UPDATE waste_templates SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);
        
        db.run(query, values, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          db.get(
            "SELECT * FROM waste_templates WHERE id = ?",
            [id],
            (err, updatedTemplate) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              res.json(updatedTemplate);
            }
          );
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/waste/templates/:id
// @desc    Delete a waste template (admin only)
router.delete('/templates/:id', [auth, adminAuth], (req, res) => {
  try {
    const { id } = req.params;
    
    // First, verify the template exists
    db.get(
      "SELECT id FROM waste_templates WHERE id = ?",
      [id],
      (err, template) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
        
        db.run(
          "DELETE FROM waste_templates WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            
            res.json({ message: 'Template deleted successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;