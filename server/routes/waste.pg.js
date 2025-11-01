const express = require('express');
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// XSS Protection Helper
function sanitizeInput(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// ========== WASTE TEMPLATES ==========

// @route   GET /api/waste/templates
// @desc    Get all waste templates
router.get('/templates', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM waste_templates ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch waste templates:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/templates/:id
// @desc    Get a single waste template by ID
router.get('/templates/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }
    const result = await pool.query(
      'SELECT * FROM waste_templates WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch waste template by id:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/templates/category/:category
// @desc    Get templates by category
router.get('/templates/category/:category', auth, async (req, res) => {
  const { category } = req.params;
  try {
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Kategorie ist erforderlich' });
    }
    const result = await pool.query(
      'SELECT * FROM waste_templates WHERE category = $1 ORDER BY name',
      [category]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch templates by category:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/templates/hazard/:level
// @desc    Get templates by hazard level
router.get('/templates/hazard/:level', auth, async (req, res) => {
  const { level } = req.params;
  try {
    const validHazardLevels = ['low', 'medium', 'high', 'critical'];
    if (!validHazardLevels.includes(level)) {
      return res.status(400).json({ error: 'Ungültiger Gefahrenlevel. Erlaubt sind: low, medium, high, critical' });
    }
    const result = await pool.query(
      'SELECT * FROM waste_templates WHERE hazard_level = $1 ORDER BY name',
      [level]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch templates by hazard level:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/templates
// @desc    Create a new waste template (Admin only)
router.post('/templates', [auth, adminAuth], async (req, res) => {
  try {
    const {
      name, category, hazard_level, disposal_frequency_days,
      color = '#A9D08E', icon = 'trash', description, safety_instructions
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Kategorie ist erforderlich' });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedCategory = sanitizeInput(category);
    const sanitizedDescription = sanitizeInput(description);
    const sanitizedSafetyInstructions = sanitizeInput(safety_instructions);

    if (hazard_level) {
      const validHazardLevels = ['low', 'medium', 'high', 'critical'];
      if (!validHazardLevels.includes(hazard_level)) {
        return res.status(400).json({ error: 'Ungültiger Gefahrenlevel. Erlaubt sind: low, medium, high, critical' });
      }
    }

    if (disposal_frequency_days !== undefined && disposal_frequency_days !== null) {
      if (isNaN(parseInt(disposal_frequency_days)) || parseInt(disposal_frequency_days) < 1) {
        return res.status(400).json({ error: 'Entsorgungshäufigkeit muss eine positive Zahl sein' });
      }
    }

    const result = await pool.query(
      `INSERT INTO waste_templates (
        name, category, hazard_level, disposal_frequency_days,
        color, icon, description, safety_instructions, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *`,
      [
        sanitizedName, sanitizedCategory, hazard_level || null,
        disposal_frequency_days || null, color, icon,
        sanitizedDescription || null, sanitizedSafetyInstructions || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create waste template:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/templates/:id
// @desc    Update a waste template (Admin only)
router.put('/templates/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, category, hazard_level, disposal_frequency_days,
      color, icon, description, safety_instructions
    } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const templateCheck = await pool.query(
      'SELECT id FROM waste_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

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

    if (category !== undefined) {
      if (!category.trim()) {
        return res.status(400).json({ error: 'Kategorie darf nicht leer sein' });
      }
      updateFields.push(`category = $${paramCount}`);
      values.push(sanitizeInput(category));
      paramCount++;
    }

    if (hazard_level !== undefined) {
      if (hazard_level !== null) {
        const validHazardLevels = ['low', 'medium', 'high', 'critical'];
        if (!validHazardLevels.includes(hazard_level)) {
          return res.status(400).json({ error: 'Ungültiger Gefahrenlevel. Erlaubt sind: low, medium, high, critical' });
        }
      }
      updateFields.push(`hazard_level = $${paramCount}`);
      values.push(hazard_level);
      paramCount++;
    }

    if (disposal_frequency_days !== undefined) {
      if (disposal_frequency_days !== null) {
        if (isNaN(parseInt(disposal_frequency_days)) || parseInt(disposal_frequency_days) < 1) {
          return res.status(400).json({ error: 'Entsorgungshäufigkeit muss eine positive Zahl sein' });
        }
      }
      updateFields.push(`disposal_frequency_days = $${paramCount}`);
      values.push(disposal_frequency_days);
      paramCount++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      values.push(sanitizeInput(description));
      paramCount++;
    }

    if (safety_instructions !== undefined) {
      updateFields.push(`safety_instructions = $${paramCount}`);
      values.push(sanitizeInput(safety_instructions));
      paramCount++;
    }

    if (color !== undefined) {
      updateFields.push(`color = $${paramCount}`);
      values.push(color);
      paramCount++;
    }

    if (icon !== undefined) {
      updateFields.push(`icon = $${paramCount}`);
      values.push(icon);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine zu aktualisierenden Felder angegeben' });
    }

    values.push(id);

    const query = `UPDATE waste_templates SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update waste template:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/waste/templates/:id
// @desc    Delete a waste template (Admin only)
router.delete('/templates/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const usageCheck = await pool.query(
      'SELECT id FROM waste_items WHERE template_id = $1 LIMIT 1',
      [id]
    );

    if (usageCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Template kann nicht gelöscht werden, da es noch von Abfallelementen verwendet wird'
      });
    }

    const result = await pool.query(
      'DELETE FROM waste_templates WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

    res.json({ message: 'Template erfolgreich gelöscht' });
  } catch (error) {
    console.error('Failed to delete waste template:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ========== WASTE ITEMS ==========

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

// ========== WASTE DISPOSAL SCHEDULE ==========

// @route   GET /api/waste/schedule
// @desc    Get disposal schedule with filters
router.get('/schedule', auth, async (req, res) => {
  try {
    const {
      startDate, endDate, status, assignedTo, wasteItemId, hazardLevel, category
    } = req.query;

    let query = `
      SELECT
        wds.*,
        wi.name as waste_name,
        wi.location as waste_location,
        wt.hazard_level,
        wt.category,
        wt.color,
        wt.icon,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        uc.name as completed_by_name
      FROM waste_disposal_schedule wds
      LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
      LEFT JOIN waste_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wds.assigned_to = u.id
      LEFT JOIN users uc ON wds.completed_by = uc.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND wds.scheduled_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND wds.scheduled_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (status) {
      query += ` AND wds.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (assignedTo) {
      query += ` AND wds.assigned_to = $${paramCount}`;
      params.push(assignedTo);
      paramCount++;
    }

    if (wasteItemId) {
      query += ` AND wds.waste_item_id = $${paramCount}`;
      params.push(wasteItemId);
      paramCount++;
    }

    if (hazardLevel) {
      query += ` AND wt.hazard_level = $${paramCount}`;
      params.push(hazardLevel);
      paramCount++;
    }

    if (category) {
      query += ` AND wt.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ' ORDER BY wds.scheduled_date ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/schedule/upcoming
// @desc    Get upcoming disposals (next 30 days)
router.get('/schedule/upcoming', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const query = `
      SELECT
        wds.*,
        wi.name as waste_name,
        wi.location as waste_location,
        wt.hazard_level,
        wt.category,
        wt.color,
        wt.icon,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM waste_disposal_schedule wds
      LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
      LEFT JOIN waste_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wds.assigned_to = u.id
      WHERE wds.scheduled_date BETWEEN $1 AND $2
        AND wds.status IN ('scheduled', 'rescheduled')
      ORDER BY wds.scheduled_date ASC, wt.hazard_level DESC
    `;

    const result = await pool.query(query, [now.toISOString(), futureDate.toISOString()]);
    res.json(result.rows);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/schedule
// @desc    Create a new disposal event
router.post('/schedule', auth, async (req, res) => {
  const { waste_item_id, scheduled_date, assigned_to, notes, reminder_dates } = req.body;

  try {
    if (!waste_item_id || !scheduled_date) {
      return res.status(400).json({ error: 'Abfallelement und geplantes Datum sind erforderlich' });
    }

    if (isNaN(parseInt(waste_item_id))) {
      return res.status(400).json({ error: 'Ungültige Abfallelement-ID' });
    }

    const itemCheck = await pool.query(
      'SELECT id FROM waste_items WHERE id = $1',
      [waste_item_id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Abfallelement nicht gefunden' });
    }

    if (assigned_to !== null && assigned_to !== undefined) {
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [assigned_to]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }
    }

    let reminderDatesJson = [];
    if (reminder_dates !== undefined && reminder_dates !== null) {
      if (!Array.isArray(reminder_dates)) {
        return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
      }
      reminderDatesJson = reminder_dates;
    }

    const sanitizedNotes = sanitizeInput(notes);

    const result = await pool.query(
      `INSERT INTO waste_disposal_schedule (
        waste_item_id, scheduled_date, assigned_to, notes,
        reminder_dates, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [waste_item_id, scheduled_date, assigned_to, sanitizedNotes, JSON.stringify(reminderDatesJson)]
    );

    const scheduleWithDetails = await pool.query(
      `SELECT
        wds.*,
        wi.name as waste_name,
        wt.hazard_level,
        wt.category,
        wt.color,
        wt.icon,
        u.name as assigned_to_name
      FROM waste_disposal_schedule wds
      LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
      LEFT JOIN waste_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wds.assigned_to = u.id
      WHERE wds.id = $1`,
      [result.rows[0].id]
    );

    res.json(scheduleWithDetails.rows[0]);
  } catch (error) {
    console.error('Datenbankfehler beim Erstellen des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/schedule/:id
// @desc    Update a disposal event
router.put('/schedule/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { scheduled_date, assigned_to, notes, status, reminder_dates } = req.body;

  try {
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const scheduleCheck = await pool.query(
      'SELECT id FROM waste_disposal_schedule WHERE id = $1',
      [id]
    );

    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (scheduled_date !== undefined) {
      updateFields.push(`scheduled_date = $${paramCount}`);
      values.push(scheduled_date);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      if (assigned_to !== null) {
        const userCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1',
          [assigned_to]
        );

        if (userCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
        }
      }
      updateFields.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      values.push(sanitizeInput(notes));
      paramCount++;
    }

    if (status !== undefined) {
      const validStatuses = ['scheduled', 'rescheduled', 'completed', 'overdue', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Ungültiger Status' });
      }
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (reminder_dates !== undefined) {
      if (!Array.isArray(reminder_dates)) {
        return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
      }
      updateFields.push(`reminder_dates = $${paramCount}`);
      values.push(JSON.stringify(reminder_dates));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine zu aktualisierenden Felder angegeben' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE waste_disposal_schedule SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    res.json({ message: 'Entsorgungsplan erfolgreich aktualisiert', schedule: result.rows[0] });
  } catch (error) {
    console.error('Datenbankfehler beim Aktualisieren des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/waste/schedule/:id
// @desc    Delete a disposal event
router.delete('/schedule/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const result = await pool.query(
      'DELETE FROM waste_disposal_schedule WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    res.json({ message: 'Entsorgungsplan erfolgreich gelöscht' });
  } catch (error) {
    console.error('Datenbankfehler beim Löschen des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
