const express = require('express');
const { pool } = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================
// WASTE CATEGORIES CRUD - Based on exact DB schema
// ============================================
// waste_categories table columns: id, name, description, icon, color,
// instructions, safety_notes, image_url, disposal_frequency, created_at, updated_at

// @route   GET /api/waste-categories
// @desc    Get all waste categories
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM waste_categories ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching waste categories:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Kategorien' });
  }
});

// @route   GET /api/waste-categories/:id
// @desc    Get single waste category
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT * FROM waste_categories WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching waste category:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Kategorie' });
  }
});

// @route   POST /api/waste-categories
// @desc    Create new waste category (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      color,
      instructions,
      safety_notes,
      image_url,
      disposal_frequency
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO waste_categories (
        name, description, icon, color, instructions,
        safety_notes, image_url, disposal_frequency, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      name.trim(),
      description || null,
      icon || null,
      color || '#3B82F6',
      instructions || null,
      safety_notes || null,
      image_url || null,
      disposal_frequency || null
    ]);

    logger.info('Waste category created', { categoryId: result.rows[0].id, userId: req.user.id });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Eine Kategorie mit diesem Namen existiert bereits' });
    }
    logger.error('Error creating waste category:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Kategorie' });
  }
});

// @route   PUT /api/waste-categories/:id
// @desc    Update waste category (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      icon,
      color,
      instructions,
      safety_notes,
      image_url,
      disposal_frequency
    } = req.body;

    const result = await pool.query(`
      UPDATE waste_categories SET
        name = COALESCE($1, name),
        description = $2,
        icon = $3,
        color = COALESCE($4, color),
        instructions = $5,
        safety_notes = $6,
        image_url = $7,
        disposal_frequency = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      name,
      description,
      icon,
      color,
      instructions,
      safety_notes,
      image_url,
      disposal_frequency,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }

    logger.info('Waste category updated', { categoryId: id, userId: req.user.id });

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Eine Kategorie mit diesem Namen existiert bereits' });
    }
    logger.error('Error updating waste category:', error);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren der Kategorie' });
  }
});

// @route   DELETE /api/waste-categories/:id
// @desc    Delete waste category (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM waste_categories WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }

    logger.info('Waste category deleted', { categoryId: id, userId: req.user.id });

    res.json({ message: 'Kategorie erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Error deleting waste category:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Kategorie' });
  }
});

module.exports = router;
