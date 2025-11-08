const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

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

    // Get old task for comparison
    const oldTask = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (oldTask.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

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
      tags ? JSON.stringify(tags) : null,
      id
    ]);

    const task = result.rows[0];

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
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    await client.query('COMMIT');

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

// @route   POST /api/kanban/tasks/:id/comments
// @desc    Add comment to task
router.post('/tasks/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Kommentar ist erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO task_comments (task_id, user_id, comment, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [id, req.user.id, comment.trim()]);

    const commentWithUser = await pool.query(`
      SELECT tc.*, u.name as user_name, u.profile_photo as user_photo
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.id = $1
    `, [result.rows[0].id]);

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:comment', { taskId: id, comment: commentWithUser.rows[0] });
    }

    res.status(201).json(commentWithUser.rows[0]);
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Serverfehler beim Hinzufügen des Kommentars' });
  }
});

// @route   GET /api/kanban/tasks/:id/activity
// @desc    Get task activity log (placeholder - table doesn't exist)
router.get('/tasks/:id/activity', auth, async (req, res) => {
  // Activity log table doesn't exist, return empty array
  res.json([]);
});

module.exports = router;
