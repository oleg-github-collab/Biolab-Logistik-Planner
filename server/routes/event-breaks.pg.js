const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

// @route   GET /api/events/:eventId/breaks
// @desc    Get all breaks for an event
router.get('/:eventId/breaks', auth, async (req, res) => {
  const { eventId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM event_breaks WHERE event_id = $1 ORDER BY break_start ASC`,
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching breaks:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Pausen' });
  }
});

// @route   POST /api/events/:eventId/breaks
// @desc    Add a break to an event
router.post('/:eventId/breaks', auth, async (req, res) => {
  const { eventId } = req.params;
  const { break_start, break_end, break_type, notes } = req.body;

  try {
    // Validate times
    if (!break_start || !break_end) {
      return res.status(400).json({ error: 'Start- und Endzeit sind erforderlich' });
    }

    // Check if event exists and belongs to user
    const eventCheck = await pool.query(
      `SELECT id FROM calendar_events WHERE id = $1`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const result = await pool.query(
      `INSERT INTO event_breaks (event_id, break_start, break_end, break_type, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [eventId, break_start, break_end, break_type || 'lunch', notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating break:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Pause' });
  }
});

// @route   PUT /api/events/:eventId/breaks/:breakId
// @desc    Update a break
router.put('/:eventId/breaks/:breakId', auth, async (req, res) => {
  const { eventId, breakId } = req.params;
  const { break_start, break_end, break_type, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE event_breaks
       SET break_start = COALESCE($1, break_start),
           break_end = COALESCE($2, break_end),
           break_type = COALESCE($3, break_type),
           notes = COALESCE($4, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND event_id = $6
       RETURNING *`,
      [break_start, break_end, break_type, notes, breakId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pause nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating break:', error);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren der Pause' });
  }
});

// @route   DELETE /api/events/:eventId/breaks/:breakId
// @desc    Delete a break
router.delete('/:eventId/breaks/:breakId', auth, async (req, res) => {
  const { eventId, breakId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM event_breaks WHERE id = $1 AND event_id = $2 RETURNING id`,
      [breakId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pause nicht gefunden' });
    }

    res.json({ message: 'Pause gelöscht' });
  } catch (error) {
    console.error('Error deleting break:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Pause' });
  }
});

// ==================== EVENT CONFLICT DETECTION ====================

/**
 * @route   GET /api/events/conflicts
 * @desc    Detect overlapping calendar events
 * @access  Private
 */
router.get('/conflicts', auth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      WITH event_pairs AS (
        SELECT
          e1.id as event1_id,
          e1.title as event1_title,
          e1.start_time as event1_start,
          e1.end_time as event1_end,
          e1.created_by as event1_creator,
          u1.name as event1_creator_name,
          e2.id as event2_id,
          e2.title as event2_title,
          e2.start_time as event2_start,
          e2.end_time as event2_end,
          e2.created_by as event2_creator,
          u2.name as event2_creator_name
        FROM calendar_events e1
        JOIN calendar_events e2 ON e1.id < e2.id
        LEFT JOIN users u1 ON e1.created_by = u1.id
        LEFT JOIN users u2 ON e2.created_by = u2.id
        WHERE e1.status != 'cancelled'
          AND e2.status != 'cancelled'
          AND (
            (e1.start_time < e2.end_time AND e1.end_time > e2.start_time)
          )
    `;

    const params = [];
    if (start_date && end_date) {
      query += ` AND e1.start_time >= $1 AND e1.end_time <= $2`;
      params.push(start_date, end_date);
    }

    query += `
      )
      SELECT
        event1_id,
        event1_title,
        event1_start,
        event1_end,
        event1_creator,
        event1_creator_name,
        event2_id,
        event2_title,
        event2_start,
        event2_end,
        event2_creator,
        event2_creator_name,
        CASE
          WHEN event1_start < event2_start THEN event2_start
          ELSE event1_start
        END as overlap_start,
        CASE
          WHEN event1_end < event2_end THEN event1_end
          ELSE event2_end
        END as overlap_end
      FROM event_pairs
      ORDER BY overlap_start ASC
    `;

    const result = await pool.query(query, params);

    // Group conflicts
    const conflicts = result.rows.map(row => ({
      events: [
        {
          id: row.event1_id,
          title: row.event1_title,
          start_time: row.event1_start,
          end_time: row.event1_end,
          creator_id: row.event1_creator,
          creator_name: row.event1_creator_name
        },
        {
          id: row.event2_id,
          title: row.event2_title,
          start_time: row.event2_start,
          end_time: row.event2_end,
          creator_id: row.event2_creator,
          creator_name: row.event2_creator_name
        }
      ],
      overlap: {
        start: row.overlap_start,
        end: row.overlap_end
      },
      severity: calculateConflictSeverity(row)
    }));

    res.json({
      conflicts,
      total: conflicts.length
    });

  } catch (error) {
    console.error('Error detecting conflicts:', error);
    res.status(500).json({ error: 'Serverfehler bei Konfliktprüfung' });
  }
});

/**
 * @route   POST /api/events/check-conflict
 * @desc    Check if a new/edited event would conflict with existing events
 * @access  Private
 */
router.post('/check-conflict', auth, async (req, res) => {
  try {
    const { start_time, end_time, event_id } = req.body;

    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'Start und Endzeit erforderlich' });
    }

    let query = `
      SELECT
        e.id,
        e.title,
        e.start_time,
        e.end_time,
        e.created_by,
        u.name as creator_name,
        CASE
          WHEN $1 < e.start_time THEN e.start_time
          ELSE $1
        END as overlap_start,
        CASE
          WHEN $2 < e.end_time THEN $2
          ELSE e.end_time
        END as overlap_end
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.status != 'cancelled'
        AND e.start_time < $2
        AND e.end_time > $1
    `;

    const params = [start_time, end_time];

    // Exclude current event if editing
    if (event_id) {
      query += ' AND e.id != $3';
      params.push(event_id);
    }

    const result = await pool.query(query, params);

    const conflicts = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      start_time: row.start_time,
      end_time: row.end_time,
      creator_id: row.created_by,
      creator_name: row.creator_name,
      overlap: {
        start: row.overlap_start,
        end: row.overlap_end
      },
      severity: calculateConflictSeverity({
        event1_start: start_time,
        event1_end: end_time,
        event2_start: row.start_time,
        event2_end: row.end_time
      })
    }));

    res.json({
      hasConflict: conflicts.length > 0,
      conflicts,
      total: conflicts.length
    });

  } catch (error) {
    console.error('Error checking conflict:', error);
    res.status(500).json({ error: 'Serverfehler bei Konfliktprüfung' });
  }
});

/**
 * Helper: Calculate conflict severity
 * Returns 'high', 'medium', or 'low'
 */
function calculateConflictSeverity(conflict) {
  const event1Start = new Date(conflict.event1_start);
  const event1End = new Date(conflict.event1_end);
  const event2Start = new Date(conflict.event2_start);
  const event2End = new Date(conflict.event2_end);

  const overlapStart = event1Start < event2Start ? event2Start : event1Start;
  const overlapEnd = event1End < event2End ? event1End : event2End;

  const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);
  const event1Duration = (event1End - event1Start) / (1000 * 60);
  const event2Duration = (event2End - event2Start) / (1000 * 60);

  const minDuration = Math.min(event1Duration, event2Duration);
  const overlapPercentage = (overlapMinutes / minDuration) * 100;

  // High severity: >75% overlap
  if (overlapPercentage > 75) return 'high';
  // Medium severity: 25-75% overlap
  if (overlapPercentage > 25) return 'medium';
  // Low severity: <25% overlap
  return 'low';
}

module.exports = router;
