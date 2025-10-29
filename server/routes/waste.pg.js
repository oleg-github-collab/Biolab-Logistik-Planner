const express = require('express');
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// XSS Protection Helper
function sanitizeInput(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// @route   GET /api/waste/templates
// @desc    Get all waste templates
router.get('/templates', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM waste_templates ORDER BY category, name'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/templates
// @desc    Create a new waste template (Admin only)
router.post('/templates', auth, adminAuth, async (req, res) => {
  try {
    const {
      name, category, hazard_level, disposal_frequency_days,
      disposal_instructions, default_frequency, waste_code,
      color, icon, description, safety_instructions
    } = req.body;

    if (!name || !category || !hazard_level) {
      return res.status(400).json({ error: 'Name, Kategorie und Gefahrenstufe sind erforderlich' });
    }

    const result = await pool.query(
      `INSERT INTO waste_templates (
        name, category, hazard_level, disposal_frequency_days,
        disposal_instructions, default_frequency, waste_code,
        color, icon, description, safety_instructions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        sanitizeInput(name), sanitizeInput(category), hazard_level,
        disposal_frequency_days, sanitizeInput(disposal_instructions),
        default_frequency, sanitizeInput(waste_code), color, icon,
        sanitizeInput(description), sanitizeInput(safety_instructions)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Fehler beim Erstellen der Vorlage:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/templates/:id
// @desc    Update waste template (Admin only)
router.put('/templates/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, category, hazard_level, disposal_frequency_days,
      disposal_instructions, default_frequency, waste_code,
      color, icon, description, safety_instructions
    } = req.body;

    const result = await pool.query(
      `UPDATE waste_templates SET
        name = $1, category = $2, hazard_level = $3,
        disposal_frequency_days = $4, disposal_instructions = $5,
        default_frequency = $6, waste_code = $7, color = $8,
        icon = $9, description = $10, safety_instructions = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING *`,
      [
        sanitizeInput(name), sanitizeInput(category), hazard_level,
        disposal_frequency_days, sanitizeInput(disposal_instructions),
        default_frequency, sanitizeInput(waste_code), color, icon,
        sanitizeInput(description), sanitizeInput(safety_instructions), id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Vorlage:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/waste/templates/:id
// @desc    Delete waste template (Admin only)
router.delete('/templates/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is in use
    const usage = await pool.query(
      'SELECT COUNT(*) as count FROM waste_items WHERE template_id = $1',
      [id]
    );

    if (parseInt(usage.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Diese Vorlage wird noch verwendet und kann nicht gelöscht werden'
      });
    }

    const result = await pool.query(
      'DELETE FROM waste_templates WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    res.json({ message: 'Vorlage erfolgreich gelöscht', id: result.rows[0].id });
  } catch (error) {
    console.error('Fehler beim Löschen der Vorlage:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/items
// @desc    Get all waste items with template data
router.get('/items', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wi.*, wt.name as template_name, wt.description, wt.color, wt.icon,
              wt.hazard_level, wt.category, wt.disposal_frequency_days
       FROM waste_items wi
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       ORDER BY wi.next_disposal_date ASC, wt.name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/items
// @desc    Create a new waste item
router.post('/items', auth, async (req, res) => {
  const { template_id, name, location, quantity, unit, next_disposal_date, notes } = req.body;

  try {
    // Validate inputs
    if (!template_id) {
      return res.status(400).json({ error: 'Template-ID ist erforderlich' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    // XSS Protection
    const sanitizedName = sanitizeInput(name);
    const sanitizedLocation = sanitizeInput(location);
    const sanitizedNotes = sanitizeInput(notes);

    // Validate template exists
    const templateCheck = await pool.query(
      'SELECT id FROM waste_templates WHERE id = $1',
      [template_id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Ungültige Template-ID' });
    }

    // Validate quantity if provided
    if (quantity !== undefined && quantity !== null && isNaN(parseFloat(quantity))) {
      return res.status(400).json({ error: 'Ungültige Menge' });
    }

    const result = await pool.query(
      `INSERT INTO waste_items (
        template_id, name, location, quantity, unit,
        next_disposal_date, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [template_id, sanitizedName, sanitizedLocation, quantity, unit, next_disposal_date, sanitizedNotes]
    );

    // Get the created item with template data
    const itemWithTemplate = await pool.query(
      `SELECT wi.*, wt.name as template_name, wt.description, wt.color, wt.icon,
              wt.hazard_level, wt.category, wt.disposal_frequency_days
       FROM waste_items wi
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       WHERE wi.id = $1`,
      [result.rows[0].id]
    );

    res.json(itemWithTemplate.rows[0]);
  } catch (error) {
    console.error('Datenbankfehler beim Erstellen des Abfallelements:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/items/:id
// @desc    Update a waste item
router.put('/items/:id', auth, async (req, res) => {
  const { name, location, quantity, unit, status, next_disposal_date, last_disposal_date, notes } = req.body;
  const { id } = req.params;

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    // Check if item exists
    const itemCheck = await pool.query(
      'SELECT id FROM waste_items WHERE id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Abfallelement nicht gefunden' });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Name darf nicht leer sein' });
      }
      updateFields.push(`name = $${paramCount}`);
      values.push(sanitizeInput(name));
      paramCount++;
    }

    if (location !== undefined) {
      updateFields.push(`location = $${paramCount}`);
      values.push(sanitizeInput(location));
      paramCount++;
    }

    if (quantity !== undefined) {
      if (quantity !== null && isNaN(parseFloat(quantity))) {
        return res.status(400).json({ error: 'Ungültige Menge' });
      }
      updateFields.push(`quantity = $${paramCount}`);
      values.push(quantity);
      paramCount++;
    }

    if (unit !== undefined) {
      updateFields.push(`unit = $${paramCount}`);
      values.push(unit);
      paramCount++;
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'disposed', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Ungültiger Status' });
      }
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (next_disposal_date !== undefined) {
      updateFields.push(`next_disposal_date = $${paramCount}`);
      values.push(next_disposal_date);
      paramCount++;
    }

    if (last_disposal_date !== undefined) {
      updateFields.push(`last_disposal_date = $${paramCount}`);
      values.push(last_disposal_date);
      paramCount++;
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      values.push(sanitizeInput(notes));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine zu aktualisierenden Felder angegeben' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE waste_items SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    res.json({ message: 'Abfallelement erfolgreich aktualisiert', item: result.rows[0] });
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/waste/items/:id
// @desc    Delete a waste item (admin only)
router.delete('/items/:id', auth, adminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const result = await pool.query(
      'DELETE FROM waste_items WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Abfallelement nicht gefunden' });
    }

    res.json({ message: 'Abfallelement erfolgreich gelöscht' });
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/items/:id/assign
// @desc    Assign waste item to user
router.put('/items/:id/assign', auth, async (req, res) => {
  const { id } = req.params;
  const { assigned_to, notification_users } = req.body;

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    // Validate assigned_to if provided
    if (assigned_to !== null && assigned_to !== undefined) {
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [assigned_to]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }
    }

    // Check if item exists
    const itemCheck = await pool.query(
      'SELECT id FROM waste_items WHERE id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Abfallelement nicht gefunden' });
    }

    // Note: notification_users is not in the schema provided, but keeping for compatibility
    const result = await pool.query(
      'UPDATE waste_items SET updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({ message: 'Abfallelement erfolgreich zugewiesen' });
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/notifications
// @desc    Send notifications for waste assignments
router.post('/notifications', auth, async (req, res) => {
  const { waste_id, user_ids, type } = req.body;

  try {
    // Validate inputs
    if (!waste_id || !Array.isArray(user_ids) || user_ids.length === 0 || !type) {
      return res.status(400).json({ error: 'Ungültige Eingabedaten' });
    }

    // Here you would implement the notification logic
    // For now, just return success
    console.log(`Sende ${type} Benachrichtigungen für Abfall ${waste_id} an Benutzer:`, user_ids);

    res.json({ message: 'Benachrichtigungen erfolgreich gesendet' });
  } catch (error) {
    console.error('Fehler beim Senden von Benachrichtigungen:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
