const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { uploadSingle } = require('../services/fileService');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/kb/categories
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.name as creator_name, COUNT(a.id) as articles_count
      FROM kb_categories c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN kb_articles a ON a.category_id = c.id AND a.status = 'published'
      WHERE c.is_active = TRUE
      GROUP BY c.id, u.name
      ORDER BY c.display_order ASC, c.name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/kb/categories
router.post('/categories', auth, async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, description, icon, color, parent_category_id, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
    
    const result = await pool.query(`
      INSERT INTO kb_categories (name, description, icon, color, parent_category_id, display_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [name, description, icon, color, parent_category_id, display_order, req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/kb/articles
router.get('/articles', auth, async (req, res) => {
  try {
    const { category_id, tag, search, status = 'published', limit = 50, offset = 0, sort = 'recent' } = req.query;
    
    let query = `
      SELECT a.*, u.name as author_name, u.profile_photo as author_photo,
        c.name as category_name, c.color as category_color,
        COUNT(DISTINCT acm.id) as comments_count, COUNT(DISTINCT am.id) as media_count
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN kb_article_comments acm ON a.id = acm.article_id
      LEFT JOIN kb_article_media am ON a.id = am.article_id
      WHERE a.status = $1
    `;
    const params = [status];
    let paramIndex = 2;

    if (category_id) {
      query += ` AND a.category_id = $${paramIndex}`;
      params.push(parseInt(category_id));
      paramIndex++;
    }

    if (tag) {
      query += ` AND $${paramIndex} = ANY(a.tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (search) {
      query += ` AND (a.search_vector @@ plainto_tsquery('german', $${paramIndex}) OR LOWER(a.title) LIKE $${paramIndex + 1})`;
      params.push(search, `%${search.toLowerCase()}%`);
      paramIndex += 2;
    }

    query += ' GROUP BY a.id, u.name, u.profile_photo, c.name, c.color';
    
    if (sort === 'popular') query += ' ORDER BY a.views_count DESC';
    else if (sort === 'helpful') query += ' ORDER BY a.helpful_count DESC';
    else query += ' ORDER BY a.featured DESC, a.pinned DESC, a.created_at DESC';

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/kb/articles/:id
router.get('/articles/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    const articleResult = await client.query(`
      SELECT a.*, u.name as author_name, u.profile_photo as author_photo,
        c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [id]);

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    await client.query('UPDATE kb_articles SET views_count = views_count + 1 WHERE id = $1', [id]);

    const mediaResult = await client.query(`
      SELECT m.*, u.name as uploaded_by_name
      FROM kb_article_media m LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE m.article_id = $1 ORDER BY m.display_order ASC, m.created_at DESC
    `, [id]);

    const commentsResult = await client.query(`
      SELECT c.*, u.name as user_name, u.profile_photo as user_photo
      FROM kb_article_comments c LEFT JOIN users u ON c.user_id = u.id
      WHERE c.article_id = $1 ORDER BY c.created_at ASC
    `, [id]);

    const voteResult = await client.query(
      'SELECT is_helpful FROM kb_article_votes WHERE article_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({
      ...articleResult.rows[0],
      media: mediaResult.rows,
      comments: commentsResult.rows,
      user_vote: voteResult.rows[0]?.is_helpful ?? null
    });
  } catch (error) {
    logger.error('Error fetching article:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// POST /api/kb/articles
router.post('/articles', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, content, excerpt, category_id, tags, status = 'draft', visibility = 'everyone' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

    const result = await client.query(`
      INSERT INTO kb_articles (title, slug, content, excerpt, category_id, author_id, status, visibility, tags, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [title, slug, content, excerpt, category_id, req.user.id, status, visibility, tags, status === 'published' ? new Date() : null]);

    await client.query('COMMIT');

    if (status === 'published') {
      const io = getIO();
      if (io) io.emit('kb:article_published', { article: result.rows[0] });
    }

    logger.info('KB article created', { articleId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating article:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// PUT /api/kb/articles/:id
router.put('/articles/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { title, content, excerpt, category_id, tags, status, visibility, featured, pinned } = req.body;

    const checkResult = await client.query('SELECT author_id FROM kb_articles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    const isOwner = checkResult.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' });

    const oldArticle = await client.query('SELECT title, content FROM kb_articles WHERE id = $1', [id]);
    await client.query(`
      INSERT INTO kb_article_revisions (article_id, title, content, edited_by)
      VALUES ($1, $2, $3, $4)
    `, [id, oldArticle.rows[0].title, oldArticle.rows[0].content, req.user.id]);

    const result = await client.query(`
      UPDATE kb_articles SET
        title = COALESCE($1, title), content = COALESCE($2, content),
        excerpt = COALESCE($3, excerpt), category_id = COALESCE($4, category_id),
        tags = COALESCE($5, tags), status = COALESCE($6, status),
        visibility = COALESCE($7, visibility), featured = COALESCE($8, featured),
        pinned = COALESCE($9, pinned),
        published_at = CASE WHEN $6 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 RETURNING *
    `, [title, content, excerpt, category_id, tags, status, visibility, featured, pinned, id]);

    await client.query('COMMIT');

    const io = getIO();
    if (io) io.emit('kb:article_updated', { article: result.rows[0] });

    logger.info('KB article updated', { articleId: id });
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating article:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// DELETE /api/kb/articles/:id
router.delete('/articles/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const checkResult = await pool.query('SELECT author_id FROM kb_articles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    const isOwner = checkResult.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' });

    await pool.query('DELETE FROM kb_articles WHERE id = $1', [id]);

    const io = getIO();
    if (io) io.emit('kb:article_deleted', { articleId: parseInt(id) });

    res.json({ success: true, message: 'Artikel gelöscht' });
  } catch (error) {
    logger.error('Error deleting article:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/kb/articles/:id/media
router.post('/articles/:id/media', auth, uploadSingle('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

    const { id } = req.params;
    const { caption, display_order } = req.body;

    let media_type = 'document';
    if (req.file.mimetype.startsWith('image/')) media_type = 'image';
    else if (req.file.mimetype.startsWith('audio/')) media_type = 'audio';
    else if (req.file.mimetype.startsWith('video/')) media_type = 'video';

    const result = await pool.query(`
      INSERT INTO kb_article_media (article_id, media_type, file_url, file_name, file_size, mime_type, caption, display_order, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [id, media_type, req.file.path, req.file.originalname, req.file.size, req.file.mimetype, caption, display_order, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error uploading media:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/kb/articles/:id/comments
router.post('/articles/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text, parent_comment_id } = req.body;
    if (!comment_text) return res.status(400).json({ error: 'Kommentartext ist erforderlich' });

    const result = await pool.query(`
      INSERT INTO kb_article_comments (article_id, user_id, comment_text, parent_comment_id)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id, req.user.id, comment_text, parent_comment_id]);

    const comment = { ...result.rows[0], user_name: req.user.name, user_photo: req.user.profile_photo };

    const io = getIO();
    if (io) io.emit('kb:comment_added', { articleId: parseInt(id), comment });

    res.status(201).json(comment);
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/kb/articles/:id/vote
router.post('/articles/:id/vote', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { is_helpful } = req.body;
    if (typeof is_helpful !== 'boolean') return res.status(400).json({ error: 'is_helpful muss Boolean sein' });

    await client.query(`
      INSERT INTO kb_article_votes (article_id, user_id, is_helpful)
      VALUES ($1, $2, $3) ON CONFLICT (article_id, user_id) DO UPDATE SET is_helpful = $3
    `, [id, req.user.id, is_helpful]);

    const countsResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_helpful = true) as helpful_count,
        COUNT(*) FILTER (WHERE is_helpful = false) as not_helpful_count
      FROM kb_article_votes WHERE article_id = $1
    `, [id]);

    await client.query(`
      UPDATE kb_articles SET helpful_count = $1, not_helpful_count = $2 WHERE id = $3
    `, [countsResult.rows[0].helpful_count, countsResult.rows[0].not_helpful_count, id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      helpful_count: parseInt(countsResult.rows[0].helpful_count),
      not_helpful_count: parseInt(countsResult.rows[0].not_helpful_count)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error voting:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// GET /api/kb/search
router.get('/search', auth, async (req, res) => {
  try {
    const { q, category, tag, sort = 'relevance' } = req.query;
    if (!q) return res.status(400).json({ error: 'Suchbegriff erforderlich' });

    let query = `
      SELECT a.*, c.name as category_name, c.color as category_color, u.name as author_name,
        ts_rank(a.search_vector, plainto_tsquery('german', $1)) as rank
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND a.search_vector @@ plainto_tsquery('german', $1)
    `;
    const params = [q];
    let paramIndex = 2;

    if (category) {
      query += ` AND a.category_id = $${paramIndex}`;
      params.push(parseInt(category));
      paramIndex++;
    }
    if (tag) {
      query += ` AND $${paramIndex} = ANY(a.tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (sort === 'relevance') query += ' ORDER BY rank DESC, a.views_count DESC';
    else if (sort === 'recent') query += ' ORDER BY a.published_at DESC';
    else if (sort === 'popular') query += ' ORDER BY a.views_count DESC';

    query += ' LIMIT 50';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error searching KB:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
