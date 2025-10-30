const express = require('express');
const pool = require('../config/database');
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
      const validStatuses = ['todo', 'in_progress', 'done', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Ungültiger Status' });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
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
