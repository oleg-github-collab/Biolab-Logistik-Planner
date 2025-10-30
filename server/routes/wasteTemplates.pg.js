const express = require('express');
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const auditLogger = require('../utils/auditLog');
const logger = require('../utils/logger');
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
      'SELECT * FROM waste_templates ORDER BY name'
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to fetch waste templates', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/waste/templates/:id
// @desc    Get a single waste template by ID
router.get('/templates/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // Validate ID
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
    logger.error('Failed to fetch waste template by id', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/waste/templates
// @desc    Create a new waste template (admin only)
router.post('/templates', [auth, adminAuth], async (req, res) => {
  try {
    const {
      name,
      category,
      hazard_level,
      disposal_frequency_days,
      color = '#A9D08E',
      icon = 'trash',
      description,
      safety_instructions
    } = req.body;

    // Validate inputs
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Kategorie ist erforderlich' });
    }

    // XSS Protection
    const sanitizedName = sanitizeInput(name);
    const sanitizedCategory = sanitizeInput(category);
    const sanitizedDescription = sanitizeInput(description);
    const sanitizedSafetyInstructions = sanitizeInput(safety_instructions);

    // Validate hazard_level
    if (hazard_level) {
      const validHazardLevels = ['low', 'medium', 'high', 'critical'];
      if (!validHazardLevels.includes(hazard_level)) {
        return res.status(400).json({ error: 'Ungültiger Gefahrenlevel. Erlaubt sind: low, medium, high, critical' });
      }
    }

    // Validate disposal_frequency_days
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
        sanitizedName,
        sanitizedCategory,
        hazard_level || null,
        disposal_frequency_days || null,
        color,
        icon,
        sanitizedDescription || null,
        sanitizedSafetyInstructions || null
      ]
    );

    const createdTemplate = result.rows[0];

    auditLogger.logDataChange('create', req.user.id, 'waste_template', createdTemplate.id, {
      name: createdTemplate.name,
      category: createdTemplate.category,
      hazard_level: createdTemplate.hazard_level
    });

    res.status(201).json(createdTemplate);
  } catch (error) {
    logger.error('Failed to fetch waste templates by category', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/waste/templates/:id
// @desc    Update a waste template (admin only)
router.put('/templates/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      hazard_level,
      disposal_frequency_days,
      color,
      icon,
      description,
      safety_instructions
    } = req.body;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    // Check if template exists
    const templateCheck = await pool.query(
      'SELECT id FROM waste_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template nicht gefunden' });
    }

    // Build update query dynamically
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

    const updatedTemplate = result.rows[0];

    auditLogger.logDataChange('update', req.user.id, 'waste_template', parseInt(id, 10), {
      name: updatedTemplate.name,
      category: updatedTemplate.category
    });

    res.json(updatedTemplate);
  } catch (error) {
    logger.error('Failed to update waste template', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/waste/templates/:id
// @desc    Delete a waste template (admin only)
router.delete('/templates/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }

    // Check if template is in use
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

    auditLogger.logDataChange('delete', req.user.id, 'waste_template', parseInt(id, 10), {});

    res.json({ message: 'Template erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Failed to delete waste template', { error: error.message });
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
    logger.error('Failed to create waste template', { error: error.message });
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
    logger.error('Failed to fetch waste templates by hazard level', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
