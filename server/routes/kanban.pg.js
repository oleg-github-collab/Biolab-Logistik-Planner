const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');
const { uploadMultiple } = require('../services/fileService');

const router = express.Router();

// ============================================
// TASKS CRUD - Based on exact DB schema
// ============================================
// Tasks table columns: id, title, description, status, priority, due_date,
// category, assigned_to, created_by, created_at, updated_at, tags

// @route   GET /api/kanban/tasks
// @desc    Get all tasks with user info and counts
router.get('/tasks', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.*,
        u1.name as creator_name,
        u2.name as assignee_name,
        u2.profile_photo as assignee_photo,
        COUNT(DISTINCT ta.id) as attachments_count,
        COUNT(DISTINCT tc.id) as comments_count
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN task_attachments ta ON t.id = ta.task_id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      GROUP BY t.id, u1.name, u2.name, u2.profile_photo
      ORDER BY t.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Aufgaben' });
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
      SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC
    `, [id]);

    // Get comments with user info
    const commentsResult = await pool.query(`
      SELECT tc.*, u.name as user_name, u.profile_photo as user_photo
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
    logger.error('Error fetching task:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Aufgabe' });
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
      category,
      tags
    } = req.body;

    logger.info('Creating task', {
      title,
      status,
      priority,
      assigned_to,
      due_date,
      category,
      tags,
      tagsType: typeof tags,
      userId: req.user?.id
    });

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }

    const tagsJson = tags ? JSON.stringify(tags) : '[]';
    logger.info('Tags JSON', { tagsJson });

    const result = await client.query(`
      INSERT INTO tasks (
        title, description, status, priority, assigned_to, due_date,
        category, tags, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW(), NOW())
      RETURNING *
    `, [
      title.trim(),
      description || null,
      status,
      priority,
      assigned_to || null,
      due_date || null,
      category || null,
      tagsJson,
      req.user.id
    ]);

    const task = result.rows[0];

    await client.query('COMMIT');

    // Audit log
    auditLogger.logDataChange('create', req.user.id, 'kanban_task', task.id, {
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      category: task.category,
      due_date: task.due_date
    });

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:created', { task });
    }

    logger.info('Task created', { taskId: task.id, userId: req.user.id });

    res.status(201).json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating task:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      error: 'Serverfehler beim Erstellen der Aufgabe',
      details: error.message
    });
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
      title,
      description,
      status,
      priority,
      assigned_to,
      due_date,
      category,
      tags
    } = req.body;

    logger.info('Updating task', {
      taskId: id,
      title,
      status,
      priority,
      assigned_to,
      due_date,
      category,
      tags,
      tagsType: typeof tags,
      userId: req.user?.id
    });

    // Get old task for comparison
    const oldTask = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (oldTask.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const tagsJson = tags ? JSON.stringify(tags) : null;
    logger.info('Update tags JSON', { tagsJson });

    const result = await client.query(`
      UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        assigned_to = $5,
        due_date = $6,
        category = COALESCE($7, category),
        tags = COALESCE($8::jsonb, tags),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      title,
      description,
      status,
      priority,
      assigned_to,
      due_date,
      category,
      tagsJson,
      id
    ]);

    const task = result.rows[0];

    // Prepare audit log changes
    const changes = {};
    if (title !== undefined && title !== oldTask.rows[0].title) changes.title = { old: oldTask.rows[0].title, new: title };
    if (status !== undefined && status !== oldTask.rows[0].status) changes.status = { old: oldTask.rows[0].status, new: status };
    if (priority !== undefined && priority !== oldTask.rows[0].priority) changes.priority = { old: oldTask.rows[0].priority, new: priority };
    if (assigned_to !== undefined && assigned_to !== oldTask.rows[0].assigned_to) changes.assigned_to = { old: oldTask.rows[0].assigned_to, new: assigned_to };
    if (category !== undefined && category !== oldTask.rows[0].category) changes.category = { old: oldTask.rows[0].category, new: category };
    if (due_date !== undefined && due_date !== oldTask.rows[0].due_date) changes.due_date = { old: oldTask.rows[0].due_date, new: due_date };

    // Handle waste items status sync if status changed
    if (status && status !== oldTask.rows[0].status) {
      if (status === 'done') {
        await client.query(`
          UPDATE waste_items
          SET status = 'disposed',
              last_disposal_date = COALESCE(last_disposal_date, NOW()),
              updated_at = NOW()
          WHERE kanban_task_id = $1
        `, [id]);
      } else if (['todo', 'in_progress', 'backlog', 'review'].includes(status)) {
        await client.query(`
          UPDATE waste_items
          SET status = 'active',
              last_disposal_date = NULL,
              updated_at = NOW()
          WHERE kanban_task_id = $1
        `, [id]);
      }
    }

    await client.query('COMMIT');

    // Audit log only if there were actual changes
    if (Object.keys(changes).length > 0) {
      auditLogger.logDataChange('update', req.user.id, 'kanban_task', parseInt(id), changes);
    }

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:updated', { task });
    }

    logger.info('Task updated', { taskId: id, userId: req.user.id });

    res.json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating task:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      error: 'Serverfehler beim Aktualisieren der Aufgabe',
      details: error.message
    });
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
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const deletedTask = result.rows[0];

    await client.query('COMMIT');

    // Audit log
    auditLogger.logDataChange('delete', req.user.id, 'kanban_task', parseInt(id), {
      title: deletedTask.title,
      status: deletedTask.status,
      assigned_to: deletedTask.assigned_to
    });

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:deleted', { taskId: id });
    }

    logger.info('Task deleted', { taskId: id, userId: req.user.id });

    res.json({ message: 'Aufgabe erfolgreich gelöscht' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting task:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Aufgabe' });
  } finally {
    client.release();
  }
});

// @route   GET /api/kanban/tasks/:id/comments
// @desc    Get all comments for a task
router.get('/tasks/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT tc.*, u.name as user_name, u.profile_photo as user_photo
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at DESC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching task comments:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Kommentare' });
  }
});

// @route   POST /api/kanban/tasks/:id/comments
// @desc    Add comment to task with attachments
router.post('/tasks/:id/comments', auth, uploadMultiple('attachments', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const commentText = req.body.comment_text || req.body.comment || '';

    logger.info('Received comment request', {
      taskId: id,
      userId: req.user.id,
      commentText: commentText,
      hasFiles: req.files && req.files.length > 0,
      fileCount: req.files ? req.files.length : 0,
      bodyKeys: Object.keys(req.body)
    });

    if (!commentText.trim() && (!req.files || req.files.length === 0)) {
      logger.warn('Comment rejected: no text and no files', { taskId: id });
      return res.status(400).json({ error: 'Kommentar oder Anhänge erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO task_comments (task_id, user_id, comment, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [id, req.user.id, commentText.trim()]);

    const commentId = result.rows[0].id;

    // Handle attachments if any
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        file_name: file.originalname,
        file_url: `/uploads/${file.filename}`,
        mime_type: file.mimetype,
        file_size: file.size
      }));

      await pool.query(`
        UPDATE task_comments
        SET attachments = $1
        WHERE id = $2
      `, [JSON.stringify(attachments), commentId]);
    }

    const commentWithUser = await pool.query(`
      SELECT tc.*, u.name as user_name, u.profile_photo as user_photo
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.id = $1
    `, [commentId]);

    // Audit log
    auditLogger.logDataChange('create', req.user.id, 'kanban_comment', commentId, {
      task_id: parseInt(id),
      has_attachments: (req.files && req.files.length > 0)
    });

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:comment', { taskId: id, comment: commentWithUser.rows[0] });
    }

    logger.info('Task comment added', { taskId: id, commentId, userId: req.user.id });

    res.status(201).json(commentWithUser.rows[0]);
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Serverfehler beim Hinzufügen des Kommentars' });
  }
});

// @route   GET /api/kanban/tasks/:id/activity
// @desc    Get task activity log entries
router.get('/tasks/:id/activity', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT tal.*, u.name as user_name, u.profile_photo as user_photo
      FROM task_activity_log tal
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE tal.task_id = $1
      ORDER BY tal.created_at DESC
      `,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching task activity log:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Aktivität' });
  }
});

module.exports = router;
