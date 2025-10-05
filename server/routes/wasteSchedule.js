const express = require('express');
const db = require('../database');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/waste/schedule
// @desc    Get disposal schedule with filters
router.get('/schedule', auth, (req, res) => {
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
        wi.description as waste_description,
        wt.hazard_level,
        wt.waste_code,
        wt.category,
        wt.color,
        wt.icon,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        uc.name as created_by_name
      FROM waste_disposal_schedule wds
      LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
      LEFT JOIN waste_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wds.assigned_to = u.id
      LEFT JOIN users uc ON wds.created_by = uc.id
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ' AND wds.scheduled_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND wds.scheduled_date <= ?';
      params.push(endDate);
    }

    if (status) {
      query += ' AND wds.status = ?';
      params.push(status);
    }

    if (assignedTo) {
      query += ' AND wds.assigned_to = ?';
      params.push(assignedTo);
    }

    if (wasteItemId) {
      query += ' AND wds.waste_item_id = ?';
      params.push(wasteItemId);
    }

    if (hazardLevel) {
      query += ' AND wt.hazard_level = ?';
      params.push(hazardLevel);
    }

    if (category) {
      query += ' AND wt.category = ?';
      params.push(category);
    }

    query += ' ORDER BY wds.scheduled_date ASC';

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      // Parse JSON fields
      const schedules = rows.map(row => ({
        ...row,
        reminder_dates: row.reminder_dates ? JSON.parse(row.reminder_dates) : []
      }));

      res.json(schedules);
    });
  } catch (error) {
    console.error('Error fetching waste schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/waste/schedule/upcoming
// @desc    Get upcoming disposals (next 30 days)
router.get('/schedule/upcoming', auth, (req, res) => {
  try {
    const { days = 30 } = req.query;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const query = `
      SELECT
        wds.*,
        wi.name as waste_name,
        wi.description as waste_description,
        wt.hazard_level,
        wt.waste_code,
        wt.category,
        wt.color,
        wt.icon,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM waste_disposal_schedule wds
      LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
      LEFT JOIN waste_templates wt ON wi.template_id = wt.id
      LEFT JOIN users u ON wds.assigned_to = u.id
      WHERE wds.scheduled_date BETWEEN ? AND ?
        AND wds.status IN ('scheduled', 'rescheduled')
      ORDER BY wds.scheduled_date ASC, wt.hazard_level DESC
    `;

    db.all(query, [now.toISOString(), futureDate.toISOString()], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      const schedules = rows.map(row => ({
        ...row,
        reminder_dates: row.reminder_dates ? JSON.parse(row.reminder_dates) : []
      }));

      res.json(schedules);
    });
  } catch (error) {
    console.error('Error fetching upcoming disposals:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/schedule
// @desc    Create a new disposal event
router.post('/schedule', auth, (req, res) => {
  const {
    waste_item_id,
    scheduled_date,
    assigned_to,
    notes,
    reminder_dates,
    is_recurring,
    recurrence_pattern,
    recurrence_end_date,
    priority,
    disposal_method,
    quantity,
    unit
  } = req.body;

  try {
    // Validate inputs
    if (!waste_item_id || !scheduled_date) {
      return res.status(400).json({ error: 'Waste item and scheduled date are required' });
    }

    const reminderDatesJson = reminder_dates ? JSON.stringify(reminder_dates) : JSON.stringify([]);
    const next_occurrence = is_recurring ? scheduled_date : null;

    db.run(
      `INSERT INTO waste_disposal_schedule (
        waste_item_id, scheduled_date, assigned_to, notes,
        reminder_dates, is_recurring, recurrence_pattern,
        recurrence_end_date, next_occurrence, priority,
        disposal_method, quantity, unit, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        waste_item_id,
        scheduled_date,
        assigned_to,
        notes,
        reminderDatesJson,
        is_recurring ? 1 : 0,
        recurrence_pattern,
        recurrence_end_date,
        next_occurrence,
        priority || 'medium',
        disposal_method,
        quantity,
        unit,
        req.user.userId
      ],
      function(err) {
        if (err) {
          console.error('Database error creating disposal schedule:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        // Get the created schedule with full details
        db.get(
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
          WHERE wds.id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('Error fetching created schedule:', err);
              return res.status(500).json({ error: 'Schedule created but failed to fetch details' });
            }

            res.json({
              ...row,
              reminder_dates: row.reminder_dates ? JSON.parse(row.reminder_dates) : []
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error creating disposal schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/waste/schedule/:id
// @desc    Update a disposal event
router.put('/schedule/:id', auth, (req, res) => {
  const { id } = req.params;
  const {
    scheduled_date,
    assigned_to,
    notes,
    status,
    reminder_dates,
    priority,
    disposal_method,
    quantity,
    unit
  } = req.body;

  try {
    const reminderDatesJson = reminder_dates ? JSON.stringify(reminder_dates) : undefined;

    let updateFields = [];
    let params = [];

    if (scheduled_date !== undefined) {
      updateFields.push('scheduled_date = ?');
      params.push(scheduled_date);
    }
    if (assigned_to !== undefined) {
      updateFields.push('assigned_to = ?');
      params.push(assigned_to);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    if (reminderDatesJson !== undefined) {
      updateFields.push('reminder_dates = ?');
      params.push(reminderDatesJson);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      params.push(priority);
    }
    if (disposal_method !== undefined) {
      updateFields.push('disposal_method = ?');
      params.push(disposal_method);
    }
    if (quantity !== undefined) {
      updateFields.push('quantity = ?');
      params.push(quantity);
    }
    if (unit !== undefined) {
      updateFields.push('unit = ?');
      params.push(unit);
    }

    updateFields.push('updated_at = datetime(\'now\')');
    params.push(id);

    if (updateFields.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE waste_disposal_schedule SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(query, params, function(err) {
      if (err) {
        console.error('Database error updating schedule:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Disposal schedule not found' });
      }

      res.json({ message: 'Disposal schedule updated successfully' });
    });
  } catch (error) {
    console.error('Error updating disposal schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/waste/schedule/:id
// @desc    Delete a disposal event
router.delete('/schedule/:id', auth, (req, res) => {
  const { id } = req.params;

  try {
    db.run(
      'DELETE FROM waste_disposal_schedule WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          console.error('Database error deleting schedule:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Disposal schedule not found' });
        }

        res.json({ message: 'Disposal schedule deleted successfully' });
      }
    );
  } catch (error) {
    console.error('Error deleting disposal schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/schedule/batch
// @desc    Batch create/update disposal schedules
router.post('/schedule/batch', auth, (req, res) => {
  const { schedules } = req.body;

  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ error: 'Schedules array is required' });
  }

  try {
    const results = [];
    let completed = 0;
    let errors = [];

    schedules.forEach((schedule, index) => {
      const {
        waste_item_id,
        scheduled_date,
        assigned_to,
        notes,
        priority,
        disposal_method,
        quantity,
        unit
      } = schedule;

      if (!waste_item_id || !scheduled_date) {
        errors.push({ index, error: 'Missing required fields' });
        completed++;
        return;
      }

      db.run(
        `INSERT INTO waste_disposal_schedule (
          waste_item_id, scheduled_date, assigned_to, notes,
          priority, disposal_method, quantity, unit,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          waste_item_id,
          scheduled_date,
          assigned_to,
          notes,
          priority || 'medium',
          disposal_method,
          quantity,
          unit,
          req.user.userId
        ],
        function(err) {
          completed++;

          if (err) {
            console.error('Batch insert error:', err);
            errors.push({ index, error: err.message });
          } else {
            results.push({ index, id: this.lastID });
          }

          if (completed === schedules.length) {
            res.json({
              success: results.length,
              errors: errors.length,
              results,
              errorDetails: errors
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in batch create:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/schedule/:id/reminder
// @desc    Set custom reminder for disposal
router.post('/schedule/:id/reminder', auth, (req, res) => {
  const { id } = req.params;
  const { reminder_dates } = req.body;

  if (!Array.isArray(reminder_dates)) {
    return res.status(400).json({ error: 'reminder_dates must be an array' });
  }

  try {
    const reminderDatesJson = JSON.stringify(reminder_dates);

    db.run(
      `UPDATE waste_disposal_schedule
       SET reminder_dates = ?, reminder_sent = 0, updated_at = datetime('now')
       WHERE id = ?`,
      [reminderDatesJson, id],
      function(err) {
        if (err) {
          console.error('Database error setting reminder:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Disposal schedule not found' });
        }

        res.json({ message: 'Reminders set successfully' });
      }
    );
  } catch (error) {
    console.error('Error setting reminders:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/waste/schedule/:id/complete
// @desc    Mark disposal as completed
router.post('/schedule/:id/complete', auth, (req, res) => {
  const { id } = req.params;
  const { actual_date, notes } = req.body;

  try {
    const completionDate = actual_date || new Date().toISOString();

    db.run(
      `UPDATE waste_disposal_schedule
       SET status = 'completed',
           actual_date = ?,
           notes = COALESCE(?, notes),
           updated_at = datetime('now')
       WHERE id = ?`,
      [completionDate, notes, id],
      function(err) {
        if (err) {
          console.error('Database error completing schedule:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Disposal schedule not found' });
        }

        // Check if it's recurring and create next occurrence
        db.get(
          'SELECT * FROM waste_disposal_schedule WHERE id = ?',
          [id],
          (err, schedule) => {
            if (err || !schedule || !schedule.is_recurring) {
              return res.json({ message: 'Disposal marked as completed' });
            }

            // Create next occurrence based on recurrence pattern
            const nextDate = calculateNextOccurrence(
              schedule.scheduled_date,
              schedule.recurrence_pattern
            );

            if (nextDate && (!schedule.recurrence_end_date || nextDate <= schedule.recurrence_end_date)) {
              db.run(
                `INSERT INTO waste_disposal_schedule (
                  waste_item_id, scheduled_date, assigned_to, notes,
                  reminder_dates, is_recurring, recurrence_pattern,
                  recurrence_end_date, priority, disposal_method,
                  quantity, unit, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                  schedule.waste_item_id,
                  nextDate,
                  schedule.assigned_to,
                  schedule.notes,
                  schedule.reminder_dates,
                  schedule.is_recurring,
                  schedule.recurrence_pattern,
                  schedule.recurrence_end_date,
                  schedule.priority,
                  schedule.disposal_method,
                  schedule.quantity,
                  schedule.unit,
                  schedule.created_by
                ],
                (err) => {
                  if (err) {
                    console.error('Error creating next occurrence:', err);
                  }
                  res.json({
                    message: 'Disposal marked as completed',
                    nextOccurrence: nextDate
                  });
                }
              );
            } else {
              res.json({ message: 'Disposal marked as completed' });
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Error completing disposal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to calculate next occurrence
function calculateNextOccurrence(currentDate, pattern) {
  const date = new Date(currentDate);

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return date.toISOString();
}

// @route   GET /api/waste/schedule/conflicts
// @desc    Check for scheduling conflicts
router.get('/schedule/conflicts', auth, (req, res) => {
  const { date, maxPerDay = 5 } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    db.all(
      `SELECT COUNT(*) as count, wds.*, wt.hazard_level
       FROM waste_disposal_schedule wds
       LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
       LEFT JOIN waste_templates wt ON wi.template_id = wt.id
       WHERE wds.scheduled_date BETWEEN ? AND ?
         AND wds.status NOT IN ('completed', 'cancelled')`,
      [startOfDay.toISOString(), endOfDay.toISOString()],
      (err, rows) => {
        if (err) {
          console.error('Database error checking conflicts:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        const count = rows.length;
        const hasConflict = count >= maxPerDay;
        const criticalCount = rows.filter(r => r.hazard_level === 'critical').length;

        res.json({
          hasConflict,
          count,
          maxPerDay,
          criticalCount,
          details: rows
        });
      }
    );
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
