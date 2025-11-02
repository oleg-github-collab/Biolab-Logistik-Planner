const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../services/fileService');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================
// TASKS CRUD
// ============================================

// @route   GET /api/kanban/tasks
// @desc    Get all tasks with attachments and comments count
router.get('/tasks', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.*,
        u1.name as creator_name,
        u2.name as assignee_name,
        COUNT(DISTINCT ta.id) as attachments_count,
        COUNT(DISTINCT tc.id) as comments_count,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', ta.id,
          'file_type', ta.file_type,
          'file_url', ta.file_url,
          'file_name', ta.file_name,
          'mime_type', ta.mime_type
        )) FILTER (WHERE ta.id IS NOT NULL), '[]') as attachments
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN task_attachments ta ON t.id = ta.task_id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      GROUP BY t.id, u1.name, u2.name
      ORDER BY t.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Aufgaben' });
  }
});

// @route   GET /api/kanban/tasks/:id
// @desc    Get single task with full details
router.get('/tasks/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const taskResult = await pool.query(`
      SELECT
        t.*,
        u1.name as creator_name,
        u1.profile_photo as creator_photo,
        u2.name as assignee_name,
        u2.profile_photo as assignee_photo
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = $1
    `, [id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    // Get attachments
    const attachmentsResult = await pool.query(`
      SELECT ta.*, u.name as uploaded_by_name
      FROM task_attachments ta
      LEFT JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.task_id = $1
      ORDER BY ta.created_at DESC
    `, [id]);

    // Get comments with user info
    const commentsResult = await pool.query(`
      SELECT
        tc.*,
        u.name as user_name,
        u.profile_photo as user_photo
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at ASC
    `, [id]);

    const task = {
      ...taskResult.rows[0],
      attachments: attachmentsResult.rows,
      comments: commentsResult.rows
    };

    res.json(task);
  } catch (error) {
    logger.error('Error fetching task details:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/kanban/tasks
// @desc    Create new task
router.post('/tasks', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      assigned_to,
      due_date,
      estimated_hours,
      labels,
      checklist
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }

    const result = await client.query(`
      INSERT INTO tasks (
        title, description, status, priority, assigned_to, due_date,
        estimated_hours, labels, checklist, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title, description, status, priority, assigned_to, due_date,
      estimated_hours, labels, checklist, req.user.id
    ]);

    const task = result.rows[0];

    // Log activity
    await client.query(`
      INSERT INTO task_activity_log (task_id, user_id, action_type, new_value)
      VALUES ($1, $2, 'created', $3)
    `, [task.id, req.user.id, title]);

    await client.query('COMMIT');

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:created', {
        task: {
          ...task,
          creator_name: req.user.name,
          attachments: [],
          comments_count: 0,
          attachments_count: 0
        }
      });
    }

    logger.info('Task created', { taskId: task.id, userId: req.user.id });

    res.status(201).json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating task:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Aufgabe' });
  } finally {
    client.release();
  }
});

// @route   PUT /api/kanban/tasks/:id
// @desc    Update task
router.put('/tasks/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      title, description, status, priority, assigned_to, due_date,
      estimated_hours, actual_hours, labels, checklist, cover_image
    } = req.body;

    // Get old task for activity log
    const oldTask = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (oldTask.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const result = await client.query(`
      UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        assigned_to = COALESCE($5, assigned_to),
        due_date = COALESCE($6, due_date),
        estimated_hours = COALESCE($7, estimated_hours),
        actual_hours = COALESCE($8, actual_hours),
        labels = COALESCE($9, labels),
        checklist = COALESCE($10, checklist),
        cover_image = COALESCE($11, cover_image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [
      title, description, status, priority, assigned_to, due_date,
      estimated_hours, actual_hours, labels, checklist, cover_image, id
    ]);

    const task = result.rows[0];

    // Log activity for status change
    if (status && status !== oldTask.rows[0].status) {
      await client.query(`
        INSERT INTO task_activity_log (task_id, user_id, action_type, old_value, new_value)
        VALUES ($1, $2, 'status_changed', $3, $4)
      `, [id, req.user.id, oldTask.rows[0].status, status]);
    }

    await client.query('COMMIT');

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:updated', { task });
    }

    logger.info('Task updated', { taskId: id, userId: req.user.id });

    res.json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating task:', error);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren der Aufgabe' });
  } finally {
    client.release();
  }
});

// @route   DELETE /api/kanban/tasks/:id
// @desc    Delete task
router.delete('/tasks/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const result = await client.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    await client.query('COMMIT');

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:deleted', { taskId: parseInt(id) });
    }

    logger.info('Task deleted', { taskId: id, userId: req.user.id });

    res.json({ success: true, message: 'Aufgabe gelöscht' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting task:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Aufgabe' });
  } finally {
    client.release();
  }
});

// ============================================
// ATTACHMENTS
// ============================================

// @route   POST /api/kanban/tasks/:id/attachments
// @desc    Upload attachment to task
router.post('/tasks/:id/attachments', auth, uploadSingle('file'), async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    await client.query('BEGIN');

    const { id } = req.params;
    const { file_type = 'document', caption } = req.body;

    // Determine file type from mime type
    let detectedType = 'document';
    if (req.file.mimetype.startsWith('image/')) detectedType = 'image';
    else if (req.file.mimetype.startsWith('audio/')) detectedType = 'audio';
    else if (req.file.mimetype.startsWith('video/')) detectedType = 'video';

    const result = await client.query(`
      INSERT INTO task_attachments (
        task_id, file_type, file_url, file_name, file_size, mime_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      id,
      file_type || detectedType,
      req.file.path,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      req.user.id
    ]);

    // Log activity
    await client.query(`
      INSERT INTO task_activity_log (task_id, user_id, action_type, new_value)
      VALUES ($1, $2, 'attachment_added', $3)
    `, [id, req.user.id, req.file.originalname]);

    await client.query('COMMIT');

    const attachment = result.rows[0];

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:attachment_added', { taskId: parseInt(id), attachment });
    }

    logger.info('Attachment uploaded', { taskId: id, attachmentId: attachment.id });

    res.status(201).json(attachment);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Serverfehler beim Hochladen' });
  } finally {
    client.release();
  }
});

// @route   DELETE /api/kanban/attachments/:id
// @desc    Delete attachment
router.delete('/attachments/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM task_attachments WHERE id = $1 RETURNING task_id, file_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anhang nicht gefunden' });
    }

    const { task_id, file_name } = result.rows[0];

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:attachment_removed', { taskId: task_id, attachmentId: parseInt(id) });
    }

    logger.info('Attachment deleted', { attachmentId: id, taskId: task_id });

    res.json({ success: true, message: 'Anhang gelöscht' });
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// COMMENTS
// ============================================

// @route   POST /api/kanban/tasks/:id/comments
// @desc    Add comment to task (text, images, audio)
router.post('/tasks/:id/comments', auth, uploadMultiple('attachments', 5), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { comment_text, parent_comment_id } = req.body;

    // Process uploaded attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        file_url: `/uploads/${file.filename}`,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size
      }));
    }

    if (!comment_text && attachments.length === 0) {
      return res.status(400).json({ error: 'Kommentar oder Anhänge erforderlich' });
    }

    const result = await client.query(`
      INSERT INTO task_comments (
        task_id, user_id, comment_text, attachments, parent_comment_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, req.user.id, comment_text, JSON.stringify(attachments), parent_comment_id]);

    // Log activity
    await client.query(`
      INSERT INTO task_activity_log (task_id, user_id, action_type, new_value)
      VALUES ($1, $2, 'comment_added', $3)
    `, [id, req.user.id, comment_text || `[${attachments.length} Anhang/Anhänge]`]);

    await client.query('COMMIT');

    const comment = {
      ...result.rows[0],
      user_name: req.user.name,
      user_photo: req.user.profile_photo
    };

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:comment_added', { taskId: parseInt(id), comment });
    }

    logger.info('Comment added', { taskId: id, commentId: comment.id });

    res.status(201).json(comment);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Serverfehler beim Hinzufügen des Kommentars' });
  } finally {
    client.release();
  }
});

// @route   GET /api/kanban/tasks/:id/comments
// @desc    Get comments for a task
router.get('/tasks/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        tc.*,
        u.name as user_name,
        u.profile_photo as user_photo
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at ASC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Kommentare' });
  }
});

// @route   DELETE /api/kanban/comments/:id
// @desc    Delete comment
router.delete('/comments/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM task_comments WHERE id = $1 AND user_id = $2 RETURNING task_id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kommentar nicht gefunden oder keine Berechtigung' });
    }

    const { task_id } = result.rows[0];

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:comment_removed', { taskId: task_id, commentId: parseInt(id) });
    }

    logger.info('Comment deleted', { commentId: id, taskId: task_id });

    res.json({ success: true, message: 'Kommentar gelöscht' });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/kanban/tasks/:id/activity
// @desc    Get task activity log
router.get('/tasks/:id/activity', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        tal.*,
        u.name as user_name,
        u.profile_photo as user_photo
      FROM task_activity_log tal
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE tal.task_id = $1
      ORDER BY tal.created_at DESC
      LIMIT 50
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching task activity:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
