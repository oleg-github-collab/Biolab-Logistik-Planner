const express = require('express');
const { pool } = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const { ensureDisposalCalendarEvent } = require('../services/entsorgungBot');
const router = express.Router();

// XSS Protection Helper
function sanitizeInput(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

const parseReminderDates = (value) => {
  if (!value && value !== 0) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

let wasteKanbanColumnEnsured = false;

async function ensureWasteKanbanLinkColumn() {
  if (wasteKanbanColumnEnsured) {
    return;
  }

  try {
    const check = await pool.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_name = 'waste_items'
          AND column_name = 'kanban_task_id'
        LIMIT 1`
    );

    if (check.rows.length === 0) {
      await pool.query(
        `ALTER TABLE waste_items
           ADD COLUMN kanban_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_waste_items_task ON waste_items(kanban_task_id)`
      );
    }

    wasteKanbanColumnEnsured = true;
  } catch (error) {
    console.error('Failed to ensure waste_items.kanban_task_id column:', error);
  }
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
    await ensureWasteKanbanLinkColumn();
    const result = await pool.query(
      `SELECT
         wi.*,
         wt.name as template_name,
         wt.description as template_description,
         wt.color,
         wt.icon,
         wt.hazard_level,
         wt.category,
         wt.disposal_frequency_days,
         t.status AS task_status,
         t.priority AS task_priority,
         t.due_date AS task_due_date,
         t.assigned_to AS task_assigned_to,
         COALESCE(
           json_agg(
             DISTINCT jsonb_build_object(
               'id', ta.id,
               'type', ta.file_type,
               'url', CASE
                        WHEN ta.file_url IS NULL THEN NULL
                        WHEN ta.file_url LIKE '/%' THEN ta.file_url
                        ELSE '/' || ta.file_url
                      END,
               'name', ta.file_name,
               'mimeType', ta.mime_type,
               'size', ta.file_size
             )
           ) FILTER (WHERE ta.id IS NOT NULL),
           '[]'::json
         ) AS attachments
       FROM waste_items wi
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       LEFT JOIN tasks t ON wi.kanban_task_id = t.id
       LEFT JOIN task_attachments ta ON t.id = ta.task_id
       GROUP BY wi.id, wt.id, wt.name, wt.description, wt.color, wt.icon, wt.hazard_level, wt.category, wt.disposal_frequency_days, t.id, t.status, t.priority, t.due_date, t.assigned_to
       ORDER BY (wi.status = 'disposed')::int DESC, wi.next_disposal_date ASC NULLS LAST, wt.name ASC NULLS LAST`
    );

    const rows = result.rows.map((row) => ({
      ...row,
      attachments: Array.isArray(row.attachments) ? row.attachments : []
    }));

    const active = rows.filter((row) => row.status !== 'disposed');
    const history = rows.filter((row) => row.status === 'disposed');

    res.json({ active, history });
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/items
// @desc    Create a new waste item
router.post('/items', auth, async (req, res) => {
  const {
    template_id,
    name,
    location,
    quantity,
    unit,
    next_disposal_date,
    notes,
    attachments = []
  } = req.body;

  if (!template_id) {
    return res.status(400).json({ error: 'Template-ID ist erforderlich' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  if (quantity !== undefined && quantity !== null && isNaN(parseFloat(quantity))) {
    return res.status(400).json({ error: 'Ungültige Menge' });
  }

  const sanitizedName = sanitizeInput(name);
  const sanitizedLocation = sanitizeInput(location);
  const sanitizedNotes = sanitizeInput(notes);

  const client = await pool.connect();

  try {
    await ensureWasteKanbanLinkColumn();
    await client.query('BEGIN');

    const templateResult = await client.query(
      'SELECT * FROM waste_templates WHERE id = $1',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ungültige Template-ID' });
    }

    const template = templateResult.rows[0];

    const itemResult = await client.query(
      `INSERT INTO waste_items (
        template_id, name, location, quantity, unit,
        status, next_disposal_date, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        template_id,
        sanitizedName,
        sanitizedLocation,
        quantity,
        unit || 'Stück',
        next_disposal_date || null,
        sanitizedNotes
      ]
    );

    const item = itemResult.rows[0];

    const taskTitle = `Abfall: ${sanitizedName}`;
    const taskDescriptionParts = [
      `Kategorie: ${template.name}`,
      sanitizedLocation ? `Ort: ${sanitizedLocation}` : null,
      quantity ? `Menge: ${quantity} ${unit || 'Stück'}` : null,
      sanitizedNotes ? `Hinweise: ${sanitizedNotes}` : null
    ].filter(Boolean);
    const taskDescription = taskDescriptionParts.join('\n');
    const dueDate = next_disposal_date || new Date().toISOString().split('T')[0];

    const taskResult = await client.query(
      `INSERT INTO tasks (
        title, description, status, priority, due_date, category,
        created_by, labels, checklist, created_at, updated_at
      ) VALUES ($1, $2, 'todo', 'high', $3, 'waste', $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [
        taskTitle,
        taskDescription || `Abfall aus Kategorie ${template.name}`,
        dueDate,
        req.user.id,
        ['waste', template.category || ''],
        null
      ]
    );

    const task = taskResult.rows[0];

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment?.url) continue;

        let detectedType = attachment.type || 'document';
        if (!detectedType && attachment.mimeType) {
          if (attachment.mimeType.startsWith('image/')) detectedType = 'image';
          else if (attachment.mimeType.startsWith('audio/')) detectedType = 'audio';
          else if (attachment.mimeType.startsWith('video/')) detectedType = 'video';
          else detectedType = 'document';
        }

        await client.query(
          `INSERT INTO task_attachments (
            task_id, file_type, file_url, file_name, file_size, mime_type, uploaded_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            task.id,
            detectedType,
            attachment.url,
            attachment.name || null,
            attachment.size || null,
            attachment.mimeType || null,
            req.user.id
          ]
        );
      }
    }

    await client.query(
      `UPDATE waste_items
         SET kanban_task_id = $1,
             updated_at = NOW()
       WHERE id = $2`,
      [task.id, item.id]
    );

    await client.query('COMMIT');

    const aggregated = await pool.query(
      `SELECT
         wi.*,
         wt.name as template_name,
         wt.description as template_description,
         wt.color,
         wt.icon,
         wt.hazard_level,
         wt.category,
         wt.disposal_frequency_days,
         t.status AS task_status,
         t.priority AS task_priority,
         t.due_date AS task_due_date,
         t.assigned_to AS task_assigned_to,
         COALESCE(
           json_agg(
             DISTINCT jsonb_build_object(
               'id', ta.id,
               'type', ta.file_type,
               'url', CASE
                        WHEN ta.file_url IS NULL THEN NULL
                        WHEN ta.file_url LIKE '/%' THEN ta.file_url
                        ELSE '/' || ta.file_url
                      END,
               'name', ta.file_name,
               'mimeType', ta.mime_type,
               'size', ta.file_size
             )
           ) FILTER (WHERE ta.id IS NOT NULL),
           '[]'::json
         ) AS attachments
       FROM waste_items wi
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       LEFT JOIN tasks t ON wi.kanban_task_id = t.id
       LEFT JOIN task_attachments ta ON t.id = ta.task_id
       WHERE wi.id = $1
       GROUP BY wi.id, wt.id, wt.name, wt.description, wt.color, wt.icon, wt.hazard_level, wt.category, wt.disposal_frequency_days, t.id, t.status, t.priority, t.due_date, t.assigned_to`,
      [item.id]
    );

    const payload = aggregated.rows[0] || { ...item, attachments: [] };
    payload.attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    res.json(payload);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Datenbankfehler beim Erstellen des Abfallelements:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   PUT /api/waste/items/:id
// @desc    Update a waste item
router.put('/items/:id', auth, async (req, res) => {
  const { name, location, quantity, unit, status, next_disposal_date, last_disposal_date, notes } = req.body;
  const { id } = req.params;

  try {
    await ensureWasteKanbanLinkColumn();
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
    const updatedItem = result.rows[0];

    if (updatedItem.kanban_task_id) {
      if (status === 'disposed') {
        await pool.query(
          `UPDATE tasks
              SET status = 'done',
                  completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
          [updatedItem.kanban_task_id]
        );
      } else if (status === 'active') {
        await pool.query(
          `UPDATE tasks
              SET status = 'todo',
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
          [updatedItem.kanban_task_id]
        );
      }
    }

    res.json({ message: 'Abfallelement erfolgreich aktualisiert', item: updatedItem });
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
    await ensureWasteKanbanLinkColumn();
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const itemResult = await pool.query(
      'DELETE FROM waste_items WHERE id = $1 RETURNING id, kanban_task_id',
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Abfallelement nicht gefunden' });
    }

    const taskId = itemResult.rows[0].kanban_task_id;
    if (taskId) {
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
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
    await ensureWasteKanbanLinkColumn();
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

  const client = await pool.connect();
  try {
    if (!waste_item_id || !scheduled_date) {
      client.release();
      return res.status(400).json({ error: 'Abfallelement und geplantes Datum sind erforderlich' });
    }

    const parsedItemId = parseInt(waste_item_id, 10);
    if (!Number.isInteger(parsedItemId)) {
      client.release();
      return res.status(400).json({ error: 'Ungültige Abfallelement-ID' });
    }

    await client.query('BEGIN');

    const itemCheck = await client.query(
      'SELECT id FROM waste_items WHERE id = $1',
      [parsedItemId]
    );

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Abfallelement nicht gefunden' });
    }

    let assignedUserId = null;
    if (assigned_to !== null && assigned_to !== undefined) {
      const parsedAssigned = parseInt(assigned_to, 10);
      if (!Number.isInteger(parsedAssigned)) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [parsedAssigned]
      );

      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      assignedUserId = parsedAssigned;
    }

    if (reminder_dates !== undefined && reminder_dates !== null && !Array.isArray(reminder_dates)) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
    }

    const sanitizedNotes = sanitizeInput(notes);
    const reminderArray = parseReminderDates(reminder_dates);
    const reminderJson = JSON.stringify(reminderArray);

    const insertResult = await client.query(
      `INSERT INTO waste_disposal_schedule (
        waste_item_id, scheduled_date, assigned_to, notes,
        reminder_dates, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [parsedItemId, scheduled_date, assignedUserId, sanitizedNotes, reminderJson, req.user.id]
    );

    const scheduleRow = insertResult.rows[0];
    const calendarEvent = await ensureDisposalCalendarEvent(client, scheduleRow, {
      createdBy: assignedUserId || req.user.id
    });

    if (calendarEvent) {
      await client.query(
        `UPDATE waste_disposal_schedule
            SET calendar_event_id = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [calendarEvent.id, scheduleRow.id]
      );
      scheduleRow.calendar_event_id = calendarEvent.id;
    }

    await client.query('COMMIT');

    const scheduleWithDetails = await client.query(
      `SELECT
        wds.*,
        wi.name as waste_name,
        wi.location as waste_location,
        wi.notification_users,
        wi.notes as waste_notes,
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
      [scheduleRow.id]
    );

    const payload = scheduleWithDetails.rows[0] || scheduleRow;
    payload.reminder_dates = reminderArray;
    payload.calendar_event = calendarEvent || null;

    res.json(payload);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Datenbankfehler beim Erstellen des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   PUT /api/waste/schedule/:id
// @desc    Update a disposal event
router.put('/schedule/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { scheduled_date, assigned_to, notes, status, reminder_dates } = req.body;

  const client = await pool.connect();
  try {
    const scheduleId = parseInt(id, 10);
    if (!Number.isInteger(scheduleId)) {
      client.release();
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT
         wds.*,
         wi.name as waste_name,
         wi.location as waste_location,
         wi.notification_users,
         wi.notes as waste_notes,
         wt.name as template_name,
         wt.category as template_category,
         wt.hazard_level
       FROM waste_disposal_schedule wds
       LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       WHERE wds.id = $1`,
      [scheduleId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (scheduled_date !== undefined) {
      updateFields.push(`scheduled_date = $${paramIndex}`);
      values.push(scheduled_date);
      paramIndex++;
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        updateFields.push('assigned_to = NULL');
      } else {
        const parsedAssigned = parseInt(assigned_to, 10);
        if (!Number.isInteger(parsedAssigned)) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
        }

        const userCheck = await client.query(
          'SELECT id FROM users WHERE id = $1',
          [parsedAssigned]
        );

        if (userCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
        }

        updateFields.push(`assigned_to = $${paramIndex}`);
        values.push(parsedAssigned);
        paramIndex++;
      }
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      values.push(sanitizeInput(notes));
      paramIndex++;
    }

    if (status !== undefined) {
      const validStatuses = ['scheduled', 'rescheduled', 'completed', 'overdue', 'cancelled'];
      if (!validStatuses.includes(status)) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Ungültiger Status' });
      }
      updateFields.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (reminder_dates !== undefined) {
      if (!Array.isArray(reminder_dates)) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
      }
      updateFields.push(`reminder_dates = $${paramIndex}`);
      values.push(JSON.stringify(reminder_dates));
      paramIndex++;
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = NOW()');
      const updateQuery = `UPDATE waste_disposal_schedule SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      values.push(scheduleId);
      const updated = await client.query(updateQuery, values);
      existingResult.rows[0] = { ...existingResult.rows[0], ...updated.rows[0] };
    }

    const mergedSchedule = existingResult.rows[0];
    const calendarEvent = await ensureDisposalCalendarEvent(client, mergedSchedule, {
      createdBy: mergedSchedule.assigned_to || req.user.id
    });

    if (calendarEvent) {
      await client.query(
        `UPDATE waste_disposal_schedule
            SET calendar_event_id = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [calendarEvent.id, mergedSchedule.id]
      );
      mergedSchedule.calendar_event_id = calendarEvent.id;
    }

    await client.query('COMMIT');

    const scheduleWithDetails = await client.query(
      `SELECT
        wds.*,
        wi.name as waste_name,
        wi.location as waste_location,
        wi.notification_users,
        wi.notes as waste_notes,
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
      [scheduleId]
    );

    const payload = scheduleWithDetails.rows[0] || mergedSchedule;
    payload.reminder_dates =
      reminder_dates !== undefined ? reminder_dates : parseReminderDates(payload.reminder_dates);
    payload.calendar_event = calendarEvent || null;

    res.json({ message: 'Entsorgungsplan erfolgreich aktualisiert', schedule: payload });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Datenbankfehler beim Aktualisieren des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   DELETE /api/waste/schedule/:id
// @desc    Delete a disposal event
router.delete('/schedule/:id', auth, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    const scheduleId = parseInt(id, 10);
    if (!Number.isInteger(scheduleId)) {
      client.release();
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT calendar_event_id FROM waste_disposal_schedule WHERE id = $1',
      [scheduleId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    await client.query(
      'DELETE FROM waste_disposal_schedule WHERE id = $1',
      [scheduleId]
    );

    const calendarEventId = existing.rows[0].calendar_event_id;
    if (calendarEventId) {
      await client.query(
        `UPDATE calendar_events
            SET status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [calendarEventId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Entsorgungsplan erfolgreich gelöscht' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Datenbankfehler beim Löschen des Entsorgungsplans:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

module.exports = router;
