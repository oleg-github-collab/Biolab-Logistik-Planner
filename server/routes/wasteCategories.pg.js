const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/waste';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Get all waste categories
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM waste_categories ORDER BY name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new category
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, icon, color, instructions, safety_notes, disposal_frequency } = req.body;
    const image_url = req.file ? `/uploads/waste/${req.file.filename}` : null;

    const result = await pool.query(`
      INSERT INTO waste_categories 
      (name, description, icon, color, instructions, safety_notes, image_url, disposal_frequency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, description, icon, color, instructions, safety_notes, image_url, disposal_frequency]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, instructions, safety_notes, disposal_frequency } = req.body;
    const image_url = req.file ? `/uploads/waste/${req.file.filename}` : undefined;

    let query = `
      UPDATE waste_categories 
      SET name = $1, description = $2, icon = $3, color = $4, 
          instructions = $5, safety_notes = $6, disposal_frequency = $7, updated_at = NOW()
    `;
    let params = [name, description, icon, color, instructions, safety_notes, disposal_frequency];

    if (image_url) {
      query += `, image_url = $8 WHERE id = $9 RETURNING *`;
      params.push(image_url, id);
    } else {
      query += ` WHERE id = $8 RETURNING *`;
      params.push(id);
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete category
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM waste_categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
