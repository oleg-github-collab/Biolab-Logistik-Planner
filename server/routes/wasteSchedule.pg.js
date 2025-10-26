const express = require('express');
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// XSS Protection Helper
function sanitizeInput(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// @route   GET /api/waste/schedule
// @desc    Get disposal schedule with filters
router.get('/schedule', auth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      assignedTo,
      wasteItemId,
      hazardLevel,
      category
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

    // JSONB is automatically parsed by node-postgres
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
  const {
    waste_item_id,
    scheduled_date,
    assigned_to,
    notes,
    reminder_dates
  } = req.body;

  try {
    // Validate inputs
    if (!waste_item_id || !scheduled_date) {
      return res.status(400).json({ error: 'Abfallelement und geplantes Datum sind erforderlich' });
    }

    // Validate waste_item_id
    if (isNaN(parseInt(waste_item_id))) {
      return res.status(400).json({ error: 'Ungültige Abfallelement-ID' });
    }

    // Check if waste item exists
    const itemCheck = await pool.query(
      'SELECT id FROM waste_items WHERE id = $1',
      [waste_item_id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Abfallelement nicht gefunden' });
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

    // Validate reminder_dates format
    let reminderDatesJson = [];
    if (reminder_dates !== undefined && reminder_dates !== null) {
      if (!Array.isArray(reminder_dates)) {
        return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
      }
      reminderDatesJson = reminder_dates;
    }

    // XSS Protection
    const sanitizedNotes = sanitizeInput(notes);

    const result = await pool.query(
      `INSERT INTO waste_disposal_schedule (
        waste_item_id, scheduled_date, assigned_to, notes,
        reminder_dates, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [
        waste_item_id,
        scheduled_date,
        assigned_to,
        sanitizedNotes,
        JSON.stringify(reminderDatesJson)
      ]
    );

    // Get the created schedule with full details
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
  const {
    scheduled_date,
    assigned_to,
    notes,
    status,
    reminder_dates
  } = req.body;

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    // Check if schedule exists
    const scheduleCheck = await pool.query(
      'SELECT id FROM waste_disposal_schedule WHERE id = $1',
      [id]
    );

    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    // Build dynamic update query
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
    // Validate ID
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

// @route   POST /api/waste/schedule/batch
// @desc    Batch create disposal schedules
router.post('/schedule/batch', auth, async (req, res) => {
  const { schedules } = req.body;

  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ error: 'Schedules-Array ist erforderlich' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];
    const errors = [];

    for (let index = 0; index < schedules.length; index++) {
      const schedule = schedules[index];
      const {
        waste_item_id,
        scheduled_date,
        assigned_to,
        notes
      } = schedule;

      if (!waste_item_id || !scheduled_date) {
        errors.push({ index, error: 'Fehlende erforderliche Felder' });
        continue;
      }

      try {
        const result = await client.query(
          `INSERT INTO waste_disposal_schedule (
            waste_item_id, scheduled_date, assigned_to, notes, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
          RETURNING id`,
          [waste_item_id, scheduled_date, assigned_to, sanitizeInput(notes)]
        );

        results.push({ index, id: result.rows[0].id });
      } catch (err) {
        console.error('Batch-Einfügefehler:', err);
        errors.push({ index, error: err.message });
      }
    }

    await client.query('COMMIT');

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errorDetails: errors
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fehler bei Batch-Erstellung:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   POST /api/waste/schedule/:id/reminder
// @desc    Set custom reminder for disposal
router.post('/schedule/:id/reminder', auth, async (req, res) => {
  const { id } = req.params;
  const { reminder_dates } = req.body;

  if (!Array.isArray(reminder_dates)) {
    return res.status(400).json({ error: 'Erinnerungsdaten müssen ein Array sein' });
  }

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const result = await pool.query(
      `UPDATE waste_disposal_schedule
       SET reminder_dates = $1, reminder_sent = false, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(reminder_dates), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    res.json({ message: 'Erinnerungen erfolgreich gesetzt' });
  } catch (error) {
    console.error('Datenbankfehler beim Setzen der Erinnerung:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/schedule/:id/complete
// @desc    Mark disposal as completed
router.post('/schedule/:id/complete', auth, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    const completionDate = new Date().toISOString();

    const result = await pool.query(
      `UPDATE waste_disposal_schedule
       SET status = 'completed',
           completed_at = $1,
           completed_by = $2,
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [completionDate, req.user.userId, sanitizeInput(notes), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entsorgungsplan nicht gefunden' });
    }

    res.json({ message: 'Entsorgung als abgeschlossen markiert' });
  } catch (error) {
    console.error('Datenbankfehler beim Abschließen der Entsorgung:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/schedule/conflicts
// @desc    Check for scheduling conflicts
router.get('/schedule/conflicts', auth, async (req, res) => {
  const { date, maxPerDay = 5 } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Datum ist erforderlich' });
  }

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await pool.query(
      `SELECT wds.*, wt.hazard_level
       FROM waste_disposal_schedule wds
       LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       WHERE wds.scheduled_date BETWEEN $1 AND $2
         AND wds.status NOT IN ('completed', 'cancelled')`,
      [startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const count = result.rows.length;
    const hasConflict = count >= maxPerDay;
    const criticalCount = result.rows.filter(r => r.hazard_level === 'critical').length;

    res.json({
      hasConflict,
      count,
      maxPerDay,
      criticalCount,
      details: result.rows
    });
  } catch (error) {
    console.error('Datenbankfehler beim Prüfen von Konflikten:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
