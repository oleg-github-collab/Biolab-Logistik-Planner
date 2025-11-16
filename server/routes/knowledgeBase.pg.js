const express = require('express');
const fs = require('fs');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { uploadSingle } = require('../services/fileService');
const { transcribeAudio, createInstructionDraft, translateToGerman } = require('../services/openaiService');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const isMissingRelationError = (error) => error?.code === '42P01';

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
    if (isMissingRelationError(error)) {
      logger.warn('KB tables not available yet, returning empty categories list');
      return res.json([]);
    }
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
    
    const params = [status];
    const userVotePlaceholder = `$${params.length + 1}`;
    params.push(req.user.id);

    let query = `
      SELECT a.*, u.name as author_name, u.profile_photo as author_photo,
        c.name as category_name, c.color as category_color,
        COUNT(DISTINCT acm.id) as comments_count,
        COUNT(DISTINCT v.id) as version_count,
        MAX(user_votes.is_helpful) as user_vote
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN kb_article_comments acm ON a.id = acm.article_id
      LEFT JOIN kb_article_votes user_votes ON user_votes.article_id = a.id AND user_votes.user_id = ${userVotePlaceholder}
      LEFT JOIN kb_article_versions v ON v.article_id = a.id
      WHERE a.status = $1
    `;

    if (category_id) {
      query += ` AND a.category_id = $${params.length + 1}`;
      params.push(parseInt(category_id));
    }

    if (tag) {
      query += ` AND $${params.length + 1} = ANY(a.tags)`;
      params.push(tag);
    }

    if (search) {
      query += ` AND (a.search_vector @@ plainto_tsquery('german', $${params.length + 1}) OR LOWER(a.title) LIKE $${params.length + 2})`;
      params.push(search, `%${search.toLowerCase()}%`);
    }

    query += ' GROUP BY a.id, u.name, u.profile_photo, c.name, c.color, c.id';

    if (sort === 'popular') {
      query += ' ORDER BY a.view_count DESC';
    } else if (sort === 'helpful') {
      query += ' ORDER BY a.helpful_count DESC';
    } else {
      query += ' ORDER BY a.is_featured DESC, a.created_at DESC';
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('KB articles table not available yet, returning empty list');
      return res.json([]);
    }
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

    // Update view count (use view_count not views_count)
    await client.query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1', [id]);

    // Get comments
    const commentsResult = await client.query(`
      SELECT c.*, u.name as user_name, u.profile_photo as user_photo
      FROM kb_article_comments c LEFT JOIN users u ON c.user_id = u.id
      WHERE c.article_id = $1 ORDER BY c.created_at ASC
    `, [id]);

    const versionCountResult = await client.query(
      'SELECT COUNT(*) as version_count FROM kb_article_versions WHERE article_id = $1',
      [id]
    );

    const voteResult = await client.query(
      'SELECT is_helpful FROM kb_article_votes WHERE article_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    const versionCount = parseInt(versionCountResult.rows[0]?.version_count || '0', 10);
    const userVote = voteResult.rows.length > 0 ? voteResult.rows[0].is_helpful : null;

    res.json({
      ...articleResult.rows[0],
      media: [], // No media table yet
      comments: commentsResult.rows,
      user_vote: userVote,
      version_count: versionCount
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
    const { title, content, excerpt, summary, category_id, tags, status = 'draft', visibility = 'everyone' } = req.body;

    console.log('[POST /api/kb/articles] Request body:', JSON.stringify(req.body, null, 2));
    logger.info('Creating KB article', {
      title,
      category_id,
      tags,
      tagsType: typeof tags,
      status,
      visibility,
      userId: req.user?.id
    });

    if (!title || !content) {
      return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Kategorie ist erforderlich' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const articleExcerpt = excerpt || summary || null;
    const tagsArray = Array.isArray(tags)
      ? tags
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
      : [];

    const tagsJson = tagsArray.length > 0 ? JSON.stringify(tagsArray) : '[]';

    logger.info('KB article prepared', {
      slug,
      tagsArray,
      tagsArrayLength: tagsArray.length,
      tagsJson
    });

    const result = await client.query(`
      INSERT INTO kb_articles (title, slug, content, summary, category_id, author_id, status, visibility, tags, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING *
    `, [title, slug, content, articleExcerpt, category_id, req.user.id, status, visibility, tagsJson, status === 'published' ? new Date() : null]);

    // Handle tags - insert/update in kb_tags table
    if (tagsArray.length > 0) {
      for (const tag of tagsArray) {
        await client.query(`
          INSERT INTO kb_tags (name, usage_count)
          VALUES ($1, 1)
          ON CONFLICT (name) DO UPDATE SET usage_count = kb_tags.usage_count + 1
        `, [tag]);
      }
    }

    await client.query('COMMIT');

    if (status === 'published') {
      const io = getIO();
      if (io) io.emit('kb:article_published', { article: result.rows[0] });
    }

    logger.info('KB article created', { articleId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[POST /api/kb/articles] ERROR:', error);
    logger.error('Error creating article:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint
    });
    res.status(500).json({
      error: 'Serverfehler beim Erstellen des Artikels',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
    const { title, content, excerpt, summary, category_id, tags, status, visibility, featured, pinned } = req.body;

    const checkResult = await client.query('SELECT author_id FROM kb_articles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    const isOwner = checkResult.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' });

    const oldArticle = await client.query('SELECT title, content FROM kb_articles WHERE id = $1', [id]);
    await client.query(`
      INSERT INTO kb_article_versions (article_id, title, content, author_id)
      VALUES ($1, $2, $3, $4)
    `, [id, oldArticle.rows[0].title, oldArticle.rows[0].content, req.user.id]);

    const articleExcerpt = excerpt || summary || null;
    const tagsArray = Array.isArray(tags)
      ? tags
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
      : null;

    const result = await client.query(`
      UPDATE kb_articles SET
        title = COALESCE($1, title), content = COALESCE($2, content),
        summary = COALESCE($3, summary), category_id = COALESCE($4, category_id),
        tags = COALESCE($5::text[], tags), status = COALESCE($6, status),
        visibility = COALESCE($7, visibility), is_featured = COALESCE($8, is_featured),
        published_at = CASE WHEN $6 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 RETURNING *
    `, [title, content, articleExcerpt, category_id, tagsArray, status, visibility, featured, id]);

    // Handle tags - insert/update in kb_tags table
    if (Array.isArray(tagsArray) && tagsArray.length > 0) {
      for (const tag of tagsArray) {
        await client.query(`
          INSERT INTO kb_tags (name, usage_count)
          VALUES ($1, 1)
          ON CONFLICT (name) DO UPDATE SET usage_count = kb_tags.usage_count + 1
        `, [tag]);
      }
    }

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

// @route   GET /api/kb/tags
// @desc    Get all tags and popular tags
router.get('/tags', auth, async (req, res) => {
  try {
    const allTags = await pool.query(
      'SELECT * FROM kb_tags ORDER BY name ASC'
    );

    const popularTags = await pool.query(
      'SELECT * FROM kb_tags ORDER BY usage_count DESC LIMIT 10'
    );

    res.json({
      all: allTags.rows,
      popular: popularTags.rows
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/kb/articles/:id/versions
// @desc    Get version history for an article
router.get('/articles/:id/versions', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const versions = await pool.query(
      `SELECT v.*, u.name as author_name
       FROM kb_article_versions v
       LEFT JOIN users u ON v.author_id = u.id
       WHERE v.article_id = $1
       ORDER BY v.version_number DESC`,
      [id]
    );

    res.json(versions.rows);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/kb/articles/:id/versions/:versionId/restore
// @desc    Restore an article to a specific version
router.post('/articles/:id/versions/:versionId/restore', auth, async (req, res) => {
  const { id, versionId } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the version data
    const version = await client.query(
      'SELECT * FROM kb_article_versions WHERE id = $1 AND article_id = $2',
      [versionId, id]
    );

    if (version.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Version not found' });
    }

    const v = version.rows[0];

    // Update the article with version data
    await client.query(
      `UPDATE kb_articles
       SET title = $1, content = $2, excerpt = $3, category_id = $4,
           tags = $5, last_edited_by = $6, last_edited_at = NOW(), updated_at = NOW()
       WHERE id = $7`,
      [v.title, v.content, v.excerpt || v.summary, v.category_id, v.tags, req.user.id, id]
    );

    await client.query('COMMIT');

    // Return updated article
    const updated = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [id]);
    res.json(updated.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/kb/articles/:id/media - Upload media (image, video, audio)
router.post('/articles/:id/media', auth, uploadSingle('media'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    // Check if article exists
    const articleCheck = await pool.query(
      'SELECT id, author_id FROM kb_articles WHERE id = $1',
      [id]
    );

    if (articleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    const isOwner = articleCheck.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const file = req.file;
    const fileType = file.mimetype.startsWith('image/') ? 'image' :
                     file.mimetype.startsWith('video/') ? 'video' :
                     file.mimetype.startsWith('audio/') ? 'audio' : 'document';

    const result = await pool.query(`
      INSERT INTO kb_media (
        article_id, filename, original_filename, file_path,
        file_size, mime_type, file_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      id,
      file.filename,
      file.originalname,
      file.path.replace(/\\/g, '/'),
      file.size,
      file.mimetype,
      fileType,
      req.user.id
    ]);

    logger.info('KB media uploaded', { mediaId: result.rows[0].id, articleId: id });

    res.status(201).json({
      ...result.rows[0],
      url: `/uploads/${file.filename}`
    });
  } catch (error) {
    logger.error('Error uploading media:', error);
    res.status(500).json({ error: 'Serverfehler beim Hochladen' });
  }
});

// @route   POST /api/kb/articles/dictate
// @desc    Transcribe audio and generate KB instructions via OpenAI
router.post('/articles/dictate', auth, uploadSingle('audio'), async (req, res) => {
  const cleanupFile = async () => {
    if (req.file?.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (error) {
        logger.warn('Failed to remove dictation upload', { error: error.message });
      }
    }
  };

  if (!req.file) {
    await cleanupFile();
    return res.status(400).json({ error: 'Audiomaterial erforderlich' });
  }

  const languageHint = req.body.language || 'auto';
  try {
    const transcript = await transcribeAudio(req.file.path, languageHint);
    const instructions = await createInstructionDraft(transcript);
    res.json({
      transcript,
      instructions,
      language: languageHint
    });
  } catch (error) {
    logger.error('Error dictating KB article', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Aufnahme', details: error.message });
  } finally {
    await cleanupFile();
  }
});

// GET /api/kb/articles/:id/media - Get all media for an article
router.get('/articles/:id/media', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT m.*, u.name as uploader_name
      FROM kb_media m
      LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE m.article_id = $1
      ORDER BY m.display_order ASC, m.created_at DESC
    `, [id]);

    const media = result.rows.map(m => ({
      ...m,
      url: `/uploads/${m.filename}`
    }));

    res.json(media);
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/kb/media/:id - Delete media
router.delete('/media/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const mediaCheck = await pool.query(`
      SELECT m.*, a.author_id
      FROM kb_media m
      JOIN kb_articles a ON m.article_id = a.id
      WHERE m.id = $1
    `, [id]);

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mediadatei nicht gefunden' });
    }

    const isOwner = mediaCheck.rows[0].author_id === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    await pool.query('DELETE FROM kb_media WHERE id = $1', [id]);

    logger.info('KB media deleted', { mediaId: id });
    res.json({ message: 'Mediadatei erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Error deleting media:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ==================== ARTICLE VERSIONING ====================

/**
 * @route   GET /api/kb/articles/:id/versions
 * @desc    Get all versions of an article
 * @access  Private
 */
router.get('/articles/:id/versions', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        v.*,
        u.name as author_name
      FROM kb_article_versions v
      LEFT JOIN users u ON v.author_id = u.id
      WHERE v.article_id = $1
      ORDER BY v.version_number DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching article versions:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * @route   GET /api/kb/articles/:id/versions/:versionNumber
 * @desc    Get specific version of an article
 * @access  Private
 */
router.get('/articles/:id/versions/:versionNumber', auth, async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    const result = await pool.query(`
      SELECT
        v.*,
        u.name as author_name
      FROM kb_article_versions v
      LEFT JOIN users u ON v.author_id = u.id
      WHERE v.article_id = $1 AND v.version_number = $2
    `, [id, versionNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Version nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching article version:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * @route   POST /api/kb/articles/:id/versions/:versionNumber/restore
 * @desc    Restore article to a specific version
 * @access  Private (admin only)
 */
router.post('/articles/:id/versions/:versionNumber/restore', auth, async (req, res) => {
  try {
    const { id, versionNumber } = req.params;

    // Check admin permissions
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Get the version to restore
    const versionResult = await pool.query(
      'SELECT * FROM kb_article_versions WHERE article_id = $1 AND version_number = $2',
      [id, versionNumber]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Version nicht gefunden' });
    }

    const version = versionResult.rows[0];

    // Update article with version content (trigger will create new version)
    const updateResult = await pool.query(`
      UPDATE kb_articles
      SET
        title = $1,
        slug = $2,
        content = $3,
        excerpt = $4,
        category_id = $5,
        tags = $6,
        status = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      version.title,
      version.slug,
      version.content,
      version.excerpt,
      version.category_id,
      version.tags,
      version.status,
      id
    ]);

    // Update the change summary of the restored version
    await pool.query(`
      UPDATE kb_article_versions
      SET change_summary = $1
      WHERE article_id = $2 AND version_number = $3
    `, [`Wiederhergestellt von Version ${versionNumber}`, id, versionNumber]);

    logger.info('Article restored to version', { articleId: id, versionNumber, userId: req.user.id });

    res.json({
      message: `Artikel auf Version ${versionNumber} wiederhergestellt`,
      article: updateResult.rows[0]
    });
  } catch (error) {
    logger.error('Error restoring article version:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * @route   GET /api/kb/articles/:id/versions/compare/:v1/:v2
 * @desc    Compare two versions of an article
 * @access  Private
 */
router.get('/articles/:id/versions/compare/:v1/:v2', auth, async (req, res) => {
  try {
    const { id, v1, v2 } = req.params;

    const result = await pool.query(`
      SELECT
        v.*,
        u.name as author_name
      FROM kb_article_versions v
      LEFT JOIN users u ON v.author_id = u.id
      WHERE v.article_id = $1 AND v.version_number IN ($2, $3)
      ORDER BY v.version_number ASC
    `, [id, v1, v2]);

    if (result.rows.length !== 2) {
      return res.status(404).json({ error: 'Versionen nicht gefunden' });
    }

    res.json({
      version1: result.rows[0],
      version2: result.rows[1]
    });
  } catch (error) {
    logger.error('Error comparing versions:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/kb/translate - Translate and improve text to German
router.post('/translate', auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text ist erforderlich' });
    }

    const translatedText = await translateToGerman(text);

    res.json({
      original: text,
      translated: translatedText
    });
  } catch (error) {
    logger.error('Error translating text:', error);
    res.status(500).json({
      error: 'Übersetzungsfehler',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
