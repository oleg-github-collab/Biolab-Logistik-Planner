const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const auth = require('../middleware/auth');

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

module.exports = router;
