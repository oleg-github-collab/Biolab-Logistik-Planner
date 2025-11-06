const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const auditLogger = require('../utils/auditLog');
const logger = require('../utils/logger');
const { schemas, validate } = require('../validators');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks (shared for all users)
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT t.*,
        u.name as assignee_name,
        creator.name as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
    `;

    const params = [];
    if (status) {
      query += ' WHERE t.status = $1';
      params.push(status);
    }

    query += ' ORDER BY t.priority DESC, t.due_date ASC NULLS LAST';

    const result = await pool.query(query, params);

    const tasks = result.rows.map(row => ({
      ...row,
      tags: row.tags || [],
      priority: row.priority || 'medium'
    }));

    res.json(tasks);

  } catch (error) {
    logger.error('Error fetching tasks', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/tasks/board
// @desc    Unified data set for Kanban + Task Pool board
router.get('/board', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `
      SELECT
        t.*,
        task_assignee.name AS task_assignee_name,
        creator.name AS created_by_name,
        tp_data.task_pool_id,
        tp_data.pool_status,
        tp_data.pool_available_date,
        tp_data.estimated_duration,
        tp_data.claimed_by,
        claim_user.name AS pool_claimed_by_name,
        tp_data.assigned_to AS pool_assigned_to,
        pool_assignee.name AS pool_assigned_to_name,
        tp_data.help_request_status,
        tp_data.help_requested_from,
        help_user.name AS help_requested_from_name,
        tp_data.help_request_message,
        tp_data.help_requested_at,
        tp_data.created_at AS pool_created_at,
        tp_data.updated_at AS pool_updated_at,
        attachments_data.attachments_count,
        attachments_data.audio_attachment_count,
        comments_data.comments_count,
        comments_data.audio_comment_count
      FROM tasks t
      LEFT JOIN users task_assignee ON t.assigned_to = task_assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN LATERAL (
        SELECT
          tp.id AS task_pool_id,
          tp.status AS pool_status,
          tp.available_date AS pool_available_date,
          tp.estimated_duration,
          tp.claimed_by,
          tp.assigned_to,
          tp.help_request_status,
          tp.help_requested_from,
          tp.help_request_message,
          tp.help_requested_at,
          tp.created_at,
          tp.updated_at
        FROM task_pool tp
        WHERE tp.task_id = t.id
          AND tp.available_date = $1
        ORDER BY tp.updated_at DESC
        LIMIT 1
      ) tp_data ON TRUE
      LEFT JOIN users claim_user ON tp_data.claimed_by = claim_user.id
      LEFT JOIN users pool_assignee ON tp_data.assigned_to = pool_assignee.id
      LEFT JOIN users help_user ON tp_data.help_requested_from = help_user.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS attachments_count,
          COUNT(*) FILTER (WHERE file_type = 'audio' OR mime_type LIKE 'audio/%') AS audio_attachment_count
        FROM task_attachments ta
        WHERE ta.task_id = t.id
      ) attachments_data ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS comments_count,
          COUNT(*) FILTER (WHERE COALESCE(audio_url, '') <> '') AS audio_comment_count
        FROM task_comments tc
        WHERE tc.task_id = t.id
      ) comments_data ON TRUE
      ORDER BY
        CASE
          WHEN t.priority = 'urgent' THEN 1
          WHEN t.priority = 'high' THEN 2
          WHEN t.priority = 'medium' THEN 3
          ELSE 4
        END,
        t.due_date NULLS LAST,
        t.updated_at DESC
      `,
      [targetDate]
    );

    const counts = {
      backlog: 0,
      poolAvailable: 0,
      inProgress: 0,
      needsHelp: 0,
      completed: 0
    };

    const tasks = result.rows.map((row) => {
      const task = {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority || 'medium',
        category: row.category,
        dueDate: row.due_date,
        assigneeId: row.assigned_to,
        assigneeName: row.task_assignee_name,
        createdById: row.created_by,
        createdByName: row.created_by_name,
        estimatedHours: row.estimated_hours,
        tags: row.tags || [],
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
        attachmentsCount: Number(row.attachments_count) || 0,
        audioAttachmentCount: Number(row.audio_attachment_count) || 0,
        commentsCount: Number(row.comments_count) || 0,
        audioCommentCount: Number(row.audio_comment_count) || 0,
        pool: row.task_pool_id
          ? {
              id: row.task_pool_id,
              status: row.pool_status,
              availableDate: row.pool_available_date,
              estimatedDuration: row.estimated_duration,
              claimedBy: row.claimed_by,
              claimedByName: row.pool_claimed_by_name,
              assignedTo: row.pool_assigned_to,
              assignedToName: row.pool_assigned_to_name,
              helpStatus: row.help_request_status,
              helpRequestedFrom: row.help_requested_from,
              helpRequestedFromName: row.help_requested_from_name,
              helpMessage: row.help_request_message,
              helpRequestedAt: row.help_requested_at,
              createdAt: row.pool_created_at,
              updatedAt: row.pool_updated_at
            }
          : null
      };

      const poolStatus = task.pool?.status || null;
      const taskStatus = task.status;

      if (!poolStatus && (taskStatus === 'todo' || taskStatus === 'backlog')) {
        counts.backlog += 1;
      }

      if (poolStatus === 'available') {
        counts.poolAvailable += 1;
      }

      if (
        poolStatus === 'claimed' ||
        poolStatus === 'assigned' ||
        taskStatus === 'in_progress'
      ) {
        counts.inProgress += 1;
      }

      if (task.pool?.helpStatus === 'pending') {
        counts.needsHelp += 1;
      }

      if (poolStatus === 'completed' || taskStatus === 'done') {
        counts.completed += 1;
      }

      return task;
    });

    res.json({
      date: targetDate,
      counts,
      tasks
    });
  } catch (error) {
    logger.error('Error building unified task board', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      assigneeId,
      dueDate,
      tags = [],
      category
    } = req.body;

    // Validate inputs
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }

    // Validate status
    const validStatuses = ['todo', 'in_progress', 'done', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Ungültige Priorität' });
    }

    // Insert task
    const insertResult = await pool.query(
      `INSERT INTO tasks (
        title, description, status, priority, assigned_to, due_date, category, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id`,
      [
        title.trim(),
        description || null,
        status,
        priority,
        assigneeId || null,
        dueDate || null,
        category || null,
        req.user.id
      ]
    );

    const taskId = insertResult.rows[0].id;

    // Fetch created task with joined data
    const taskResult = await pool.query(
      `SELECT t.*,
        u.name as assignee_name,
        updater.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users updater ON t.created_by = updater.id
       WHERE t.id = $1`,
      [taskId]
    );

    const task = taskResult.rows[0];
    const formattedTask = {
      ...task,
      tags: task.tags || []
    };

    // Broadcast to all connected clients via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:created', {
        task: formattedTask,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    // Audit log
    auditLogger.logDataChange('create', req.user.id, 'task', taskId, {
      title,
      status,
      priority,
      assigneeId,
      ip: req.ip
    });

    logger.info('Task created', {
      taskId,
      userId: req.user.id,
      title
    });

    res.status(201).json(formattedTask);

  } catch (error) {
    logger.error('Error creating task', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate,
      tags
    } = req.body;

    // First, verify the task exists and get current status
    const existingResult = await pool.query(
      'SELECT id, status FROM tasks WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const previousStatus = existingResult.rows[0].status;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }

    if (status !== undefined) {
      const validStatuses = ['todo', 'inprogress', 'in_progress', 'review', 'done', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Ungültiger Status' });
      }
      // Normalize inprogress to in_progress for DB
      const normalizedStatus = status === 'inprogress' ? 'in_progress' : status;
      updates.push(`status = $${paramIndex++}`);
      values.push(normalizedStatus);
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Ungültige Priorität' });
      }
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }

    if (assigneeId !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(assigneeId || null);
    }

    if (dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(dueDate || null);
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    await pool.query(query, values);

    // Fetch updated task
    const taskResult = await pool.query(
      `SELECT t.*,
        u.name as assignee_name,
        updater.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users updater ON t.created_by = updater.id
       WHERE t.id = $1`,
      [id]
    );

    const updatedTask = taskResult.rows[0];
    const formattedTask = {
      ...updatedTask,
      tags: updatedTask.tags || []
    };

    // Broadcast to all connected clients via WebSocket
    const io = getIO();
    if (io) {
      // Determine the type of update
      let updateType = 'task:updated';
      if (status !== undefined && previousStatus !== status) {
        updateType = 'task:moved';
      }

      io.emit(updateType, {
        task: formattedTask,
        user: {
          id: req.user.id,
          name: req.user.name
        },
        previousStatus
      });
    }

    // Audit log
    const changes = {};
    if (title !== undefined) changes.title = title;
    if (status !== undefined) changes.status = status;
    if (priority !== undefined) changes.priority = priority;
    if (assigneeId !== undefined) changes.assigneeId = assigneeId;

    auditLogger.logDataChange('update', req.user.id, 'task', id, {
      changes,
      ip: req.ip
    });

    logger.info('Task updated', {
      taskId: id,
      userId: req.user.id,
      changes
    });

    res.json(formattedTask);

  } catch (error) {
    logger.error('Error updating task', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // First, verify the task exists and get its data
    const taskResult = await pool.query(
      `SELECT t.*,
        u.name as assignee_name,
        updater.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users updater ON t.created_by = updater.id
       WHERE t.id = $1`,
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const task = taskResult.rows[0];

    // Delete task
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);

    // Broadcast to all connected clients via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task:deleted', {
        taskId: id,
        task: {
          ...task,
          tags: task.tags || []
        },
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    // Audit log
    auditLogger.logDataChange('delete', req.user.id, 'task', id, {
      title: task.title,
      status: task.status,
      ip: req.ip
    });

    logger.info('Task deleted', {
      taskId: id,
      userId: req.user.id,
      taskTitle: task.title
    });

    res.json({ message: 'Task deleted successfully' });

  } catch (error) {
    logger.error('Error deleting task', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
