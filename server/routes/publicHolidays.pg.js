/**
 * Public Holidays Routes
 * Manage company-wide public holidays and non-working days
 * Only superadmin can create/update/delete holidays
 */

const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to check superadmin access
const requireSuperadmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Nur Superadmin kann Feiertage verwalten' });
  }
  next();
};

// @route   GET /api/public-holidays
// @desc    Get all public holidays (optionally filtered by year)
// @access  Authenticated users
router.get('/', auth, async (req, res) => {
  try {
    const { year, country_code = 'DE' } = req.query;

    let query = `
      SELECT id, date, name, description, is_recurring,
             recurrence_month, recurrence_day, country_code, region,
             created_at
      FROM public_holidays
      WHERE country_code = $1
    `;
    const params = [country_code];

    if (year) {
      query += ` AND EXTRACT(YEAR FROM date) = $2`;
      params.push(parseInt(year));
    }

    query += ` ORDER BY date ASC`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching public holidays', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/public-holidays/:id
// @desc    Get single public holiday
// @access  Authenticated users
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM public_holidays WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feiertag nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching public holiday', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/public-holidays
// @desc    Create new public holiday
// @access  Superadmin only
router.post('/', auth, requireSuperadmin, async (req, res) => {
  try {
    const {
      date,
      name,
      description,
      is_recurring = false,
      recurrence_month,
      recurrence_day,
      country_code = 'DE',
      region
    } = req.body;

    if (!date || !name) {
      return res.status(400).json({ error: 'Datum und Name sind erforderlich' });
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datumsformat' });
    }

    // If recurring, validate recurrence fields
    if (is_recurring) {
      if (!recurrence_month || !recurrence_day) {
        return res.status(400).json({
          error: 'Für wiederkehrende Feiertage müssen Monat und Tag angegeben werden'
        });
      }

      if (recurrence_month < 1 || recurrence_month > 12) {
        return res.status(400).json({ error: 'Monat muss zwischen 1 und 12 liegen' });
      }

      if (recurrence_day < 1 || recurrence_day > 31) {
        return res.status(400).json({ error: 'Tag muss zwischen 1 und 31 liegen' });
      }
    }

    const result = await pool.query(
      `INSERT INTO public_holidays
       (date, name, description, is_recurring, recurrence_month, recurrence_day, country_code, region, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        date,
        name,
        description,
        is_recurring,
        is_recurring ? recurrence_month : null,
        is_recurring ? recurrence_day : null,
        country_code,
        region,
        req.user.id
      ]
    );

    logger.info('Public holiday created', {
      holidayId: result.rows[0].id,
      date,
      name,
      createdBy: req.user.id
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Feiertag für dieses Datum existiert bereits' });
    }
    logger.error('Error creating public holiday', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/public-holidays/:id
// @desc    Update public holiday
// @access  Superadmin only
router.put('/:id', auth, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      name,
      description,
      is_recurring,
      recurrence_month,
      recurrence_day,
      region
    } = req.body;

    // Check if holiday exists
    const existing = await pool.query(
      'SELECT * FROM public_holidays WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Feiertag nicht gefunden' });
    }

    const result = await pool.query(
      `UPDATE public_holidays
       SET date = COALESCE($1, date),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           is_recurring = COALESCE($4, is_recurring),
           recurrence_month = $5,
           recurrence_day = $6,
           region = COALESCE($7, region),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        date,
        name,
        description,
        is_recurring,
        is_recurring ? recurrence_month : null,
        is_recurring ? recurrence_day : null,
        region,
        id
      ]
    );

    logger.info('Public holiday updated', {
      holidayId: id,
      updatedBy: req.user.id
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating public holiday', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/public-holidays/:id
// @desc    Delete public holiday
// @access  Superadmin only
router.delete('/:id', auth, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM public_holidays WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feiertag nicht gefunden' });
    }

    logger.info('Public holiday deleted', {
      holidayId: id,
      deletedBy: req.user.id
    });

    res.json({ message: 'Feiertag erfolgreich gelöscht', holiday: result.rows[0] });
  } catch (error) {
    logger.error('Error deleting public holiday', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/public-holidays/bulk
// @desc    Bulk create public holidays (e.g., for entire year)
// @access  Superadmin only
router.post('/bulk', auth, requireSuperadmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({ error: 'Keine Feiertage angegeben' });
    }

    await client.query('BEGIN');

    const inserted = [];
    const errors = [];

    for (const holiday of holidays) {
      try {
        const result = await client.query(
          `INSERT INTO public_holidays
           (date, name, description, is_recurring, recurrence_month, recurrence_day, country_code, region, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (date) DO NOTHING
           RETURNING *`,
          [
            holiday.date,
            holiday.name,
            holiday.description || null,
            holiday.is_recurring || false,
            holiday.recurrence_month || null,
            holiday.recurrence_day || null,
            holiday.country_code || 'DE',
            holiday.region || null,
            req.user.id
          ]
        );

        if (result.rows.length > 0) {
          inserted.push(result.rows[0]);
        }
      } catch (err) {
        errors.push({ holiday, error: err.message });
      }
    }

    await client.query('COMMIT');

    logger.info('Bulk public holidays created', {
      count: inserted.length,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: `${inserted.length} Feiertage erfolgreich erstellt`,
      inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error bulk creating public holidays', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

module.exports = router;
