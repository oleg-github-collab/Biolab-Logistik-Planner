const express = require('express');
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const { uploadMultiple } = require('../services/fileService');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/kb/categories
// @desc    Get all categories
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM kb_articles WHERE category_id = c.id AND status = 'published') as article_count
      FROM kb_categories c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.display_order, c.name
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching KB categories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/kb/categories
// @desc    Create category (admin only)
router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, description, icon, color, parent_id, display_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(`
      INSERT INTO kb_categories (name, description, icon, color, parent_id, display_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, icon || '📄', color || '#3B82F6', parent_id || null, display_order || 0, req.user.id]);

    logger.info('KB category created:', { categoryId: result.rows[0].id, userId: req.user.id });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating KB category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/kb/articles
// @desc    Get articles with filters
router.get('/articles', auth, async (req, res) => {
  try {
    const { category_id, status, search, featured, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.*,
        u.name as author_name,
        c.name as category_name,
        (SELECT COUNT(*) FROM kb_article_views WHERE article_id = a.id) as view_count,
        (SELECT COUNT(*) FROM kb_article_feedback WHERE article_id = a.id AND is_helpful = true) as helpful_count,
        (SELECT COUNT(*) FROM kb_bookmarks WHERE article_id = a.id) as bookmark_count
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (category_id) {
      query += ` AND a.category_id = $${paramIndex++}`;
      params.push(category_id);
    }

    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    } else {
      // Non-admins only see published articles
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        query += ` AND a.status = 'published'`;
      }
    }

    if (featured === 'true') {
      query += ` AND a.is_featured = true`;
    }

    if (search) {
      query += ` AND (a.title ILIKE $${paramIndex} OR a.content ILIKE $${paramIndex} OR a.summary ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY a.is_featured DESC, a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching KB articles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/kb/articles/:id
// @desc    Get single article
router.get('/articles/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT a.*,
        u.name as author_name,
        u.email as author_email,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = result.rows[0];

    // Track view
    await pool.query(`
      INSERT INTO kb_article_views (article_id, user_id, ip_address, user_agent)
      VALUES ($1, $2, $3, $4)
    `, [id, req.user.id, req.ip, req.get('user-agent')]);

    // Update view count
    await pool.query(`
      UPDATE kb_articles SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [id]);

    // Get media
    const mediaResult = await pool.query(`
      SELECT * FROM kb_media WHERE article_id = $1 ORDER BY display_order
    `, [id]);

    article.media = mediaResult.rows;

    // Get related articles
    const relatedResult = await pool.query(`
      SELECT r.relation_type, a.*
      FROM kb_article_relations r
      JOIN kb_articles a ON r.related_article_id = a.id
      WHERE r.article_id = $1 AND a.status = 'published'
      ORDER BY r.display_order
    `, [id]);

    article.related = relatedResult.rows;

    res.json(article);
  } catch (error) {
    logger.error('Error fetching KB article:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/kb/articles
// @desc    Create article
router.post('/articles', auth, uploadMultiple('media', 10), async (req, res) => {
  try {
    const { category_id, title, content, summary, tags, status, is_featured, visibility } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Generate slug
    const slug = title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      + `-${Date.now()}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert article
      const articleResult = await client.query(`
        INSERT INTO kb_articles (
          category_id, title, content, summary, author_id, status,
          is_featured, visibility, slug, tags, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        category_id || null,
        title,
        content,
        summary || null,
        req.user.id,
        status || 'draft',
        is_featured || false,
        visibility || 'all',
        slug,
        tags ? JSON.parse(tags) : [],
        status === 'published' ? new Date() : null
      ]);

      const article = articleResult.rows[0];

      // Handle uploaded media files
      if (req.files && req.files.length > 0) {
        const fileService = require('../services/fileService');

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const processedFile = await fileService.processUploadedFile(file, req.user.id);

          await client.query(`
            INSERT INTO kb_media (
              article_id, filename, original_filename, file_path, file_size,
              mime_type, file_type, width, height, thumbnail_path,
              uploaded_by, display_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            article.id,
            processedFile.filename,
            processedFile.originalFilename,
            processedFile.filePath,
            processedFile.fileSize,
            processedFile.mimeType,
            processedFile.fileType,
            processedFile.width,
            processedFile.height,
            processedFile.thumbnailPath,
            req.user.id,
            i
          ]);
        }
      }

      await client.query('COMMIT');

      logger.info('KB article created:', { articleId: article.id, userId: req.user.id });
      res.status(201).json(article);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error creating KB article:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/kb/articles/:id
// @desc    Update article
router.put('/articles/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, title, content, summary, tags, status, is_featured, visibility } = req.body;

    // Check if article exists and user has permission
    const checkResult = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = checkResult.rows[0];
    if (article.author_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(`
      UPDATE kb_articles SET
        category_id = COALESCE($1, category_id),
        title = COALESCE($2, title),
        content = COALESCE($3, content),
        summary = COALESCE($4, summary),
        tags = COALESCE($5, tags),
        status = COALESCE($6, status),
        is_featured = COALESCE($7, is_featured),
        visibility = COALESCE($8, visibility),
        updated_at = CURRENT_TIMESTAMP,
        published_at = CASE WHEN $6 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE id = $9
      RETURNING *
    `, [
      category_id,
      title,
      content,
      summary,
      tags ? JSON.stringify(tags) : null,
      status,
      is_featured,
      visibility,
      id
    ]);

    logger.info('KB article updated:', { articleId: id, userId: req.user.id });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating KB article:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/kb/articles/:id/feedback
// @desc    Submit feedback
router.post('/articles/:id/feedback', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_helpful, comment } = req.body;

    if (typeof is_helpful !== 'boolean') {
      return res.status(400).json({ error: 'is_helpful must be boolean' });
    }

    await pool.query(`
      INSERT INTO kb_article_feedback (article_id, user_id, is_helpful, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (article_id, user_id) DO UPDATE
      SET is_helpful = $3, comment = $4, created_at = CURRENT_TIMESTAMP
    `, [id, req.user.id, is_helpful, comment || null]);

    // Update counts
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_helpful = true) as helpful,
        COUNT(*) FILTER (WHERE is_helpful = false) as not_helpful
      FROM kb_article_feedback
      WHERE article_id = $1
    `, [id]);

    const counts = countsResult.rows[0];

    await pool.query(`
      UPDATE kb_articles
      SET helpful_count = $1, not_helpful_count = $2
      WHERE id = $3
    `, [parseInt(counts.helpful), parseInt(counts.not_helpful), id]);

    res.json({ message: 'Feedback submitted', counts });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/kb/articles/:id/bookmark
// @desc    Bookmark article
router.post('/articles/:id/bookmark', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { folder, notes } = req.body;

    await pool.query(`
      INSERT INTO kb_bookmarks (user_id, article_id, folder, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, article_id) DO UPDATE
      SET folder = $3, notes = $4
    `, [req.user.id, id, folder || null, notes || null]);

    res.json({ message: 'Article bookmarked' });
  } catch (error) {
    logger.error('Error bookmarking article:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/kb/articles/:id/bookmark
// @desc    Remove bookmark
router.delete('/articles/:id/bookmark', auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM kb_bookmarks WHERE user_id = $1 AND article_id = $2', [req.user.id, id]);

    res.json({ message: 'Bookmark removed' });
  } catch (error) {
    logger.error('Error removing bookmark:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/kb/search
// @desc    Full-text search
router.get('/search', auth, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query required' });
    }

    const result = await pool.query(`
      SELECT a.*,
        u.name as author_name,
        c.name as category_name,
        ts_rank(to_tsvector('english', a.title || ' ' || a.content), plainto_tsquery('english', $1)) as rank
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.status = 'published'
        AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, a.view_count DESC
      LIMIT $2
    `, [q, parseInt(limit)]);

    // Log search
    await pool.query(`
      INSERT INTO kb_search_history (user_id, query, results_count, ip_address)
      VALUES ($1, $2, $3, $4)
    `, [req.user.id, q, result.rows.length, req.ip]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error searching KB:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
