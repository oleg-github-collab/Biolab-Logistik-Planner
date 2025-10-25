const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/task-pool/today
// @desc    Get available tasks for today
router.get('/today', auth, async (req, res) => {
  try {
    const { status, priority, unassigned_only } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = `
      SELECT
        tp.*,
        t.title, t.description, t.priority, t.status as task_status,
        t.category, t.due_date,
        assigned_user.name as assigned_to_name,
        assigned_user.profile_photo as assigned_to_photo,
        claimed_user.name as claimed_by_name,
        help_req_user.name as help_requested_from_name
      FROM task_pool tp
      LEFT JOIN tasks t ON tp.task_id = t.id
      LEFT JOIN users assigned_user ON tp.assigned_to = assigned_user.id
      LEFT JOIN users claimed_user ON tp.claimed_by = claimed_user.id
      LEFT JOIN users help_req_user ON tp.help_requested_from = help_req_user.id
      WHERE tp.available_date = $1
    `;

    const params = [today];
    let paramIndex = 2;

    if (unassigned_only === 'true') {
      query += ` AND tp.status = 'available' AND tp.assigned_to IS NULL`;
    } else if (status) {
      query += ` AND tp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ' ORDER BY t.priority DESC, tp.created_at ASC';

    const result = await pool.query(query, params);

    // Get task counts by status
    const counts = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM task_pool
       WHERE available_date = $1
       GROUP BY status`,
      [today]
    );

    res.json({
      tasks: result.rows,
      counts: counts.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {})
    });

  } catch (error) {
    logger.error('Error fetching task pool', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/task-pool/my-tasks
// @desc    Get tasks assigned to or claimed by current user
router.get('/my-tasks', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT
        tp.*,
        t.title, t.description, t.priority, t.status as task_status,
        t.category, t.due_date
      FROM task_pool tp
      LEFT JOIN tasks t ON tp.task_id = t.id
      WHERE tp.available_date = $1
        AND (tp.assigned_to = $2 OR tp.claimed_by = $2)
      ORDER BY t.priority DESC, tp.created_at ASC`,
      [targetDate, req.user.id]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching my tasks', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/task-pool/:taskPoolId/claim
// @desc    Claim an available task
router.post('/:taskPoolId/claim', auth, async (req, res) => {
  try {
    const { taskPoolId } = req.params;

    // Check if task is available
    const checkResult = await pool.query(
      'SELECT * FROM task_pool WHERE id = $1 AND status = $2',
      [taskPoolId, 'available']
    );

    if (checkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Aufgabe ist nicht zum Beanspruchen verfügbar' });
    }

    // Claim the task
    const result = await pool.query(
      `UPDATE task_pool SET
        status = 'claimed',
        claimed_by = $1,
        claimed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [req.user.id, taskPoolId]
    );

    // Update task status
    await pool.query(
      `UPDATE tasks SET
        status = 'in_progress',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [result.rows[0].task_id]
    );

    // Create notification for superadmin
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, content, task_id, priority)
       SELECT id, 'task_assigned', 'Task Claimed', $1, $2, 'normal'
       FROM users WHERE role = 'superadmin'`,
      [`${req.user.name} claimed task: ${result.rows[0].task_title}`, result.rows[0].task_id]
    );

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('task_pool:task_claimed', {
        taskPoolId,
        claimedBy: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Task claimed', { taskPoolId, userId: req.user.id });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error claiming task', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/task-pool/:taskPoolId/request-help
// @desc    Request help from another user for a task
router.post('/:taskPoolId/request-help', auth, async (req, res) => {
  try {
    const { taskPoolId } = req.params;
    const { userId, message } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Benutzer-ID ist erforderlich' });
    }

    const client = await pool.getClient();
    try {
      await client.query('BEGIN');

      // Update task pool
      const poolResult = await client.query(
        `UPDATE task_pool SET
          help_requested_from = $1,
          help_requested_by = $2,
          help_request_message = $3,
          help_requested_at = CURRENT_TIMESTAMP,
          help_request_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`,
        [userId, req.user.id, message, taskPoolId]
      );

      if (poolResult.rows.length === 0) {
        throw new Error('Task pool not found');
      }

      // Create help request record
      const helpRequestResult = await client.query(
        `INSERT INTO task_help_requests (
          task_pool_id, requested_by, requested_user_id, message, status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *`,
        [taskPoolId, req.user.id, userId, message]
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (
          user_id, type, title, content, related_user_id, task_id, priority
        ) VALUES ($1, 'task_assigned', 'Help Requested', $2, $3, $4, 'high')`,
        [
          userId,
          `${req.user.name} needs help with: ${poolResult.rows[0].task_title}`,
          req.user.id,
          poolResult.rows[0].task_id
        ]
      );

      await client.query('COMMIT');

      // Broadcast via WebSocket
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit('task_pool:help_requested', {
          taskPoolId,
          requestedBy: {
            id: req.user.id,
            name: req.user.name
          },
          helpRequest: helpRequestResult.rows[0]
        });
      }

      logger.info('Help requested for task', { taskPoolId, requestedFrom: userId, requestedBy: req.user.id });

      res.json({
        taskPool: poolResult.rows[0],
        helpRequest: helpRequestResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error requesting help', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/task-pool/help-requests/:requestId/respond
// @desc    Respond to help request (accept/decline)
router.post('/help-requests/:requestId/respond', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, message } = req.body; // action: 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Ungültige Aktion. Muss "accept" oder "decline" sein' });
    }

    // Check if request is for this user
    const requestCheck = await pool.query(
      'SELECT * FROM task_help_requests WHERE id = $1 AND requested_user_id = $2 AND status = $3',
      [requestId, req.user.id, 'pending']
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hilfeanfrage nicht gefunden oder bereits beantwortet' });
    }

    const helpRequest = requestCheck.rows[0];
    const client = await pool.getClient();

    try {
      await client.query('BEGIN');

      // Update help request - note: response_message column doesn't exist in schema
      await client.query(
        `UPDATE task_help_requests SET
          status = $1,
          responded_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [action === 'accept' ? 'accepted' : 'declined', requestId]
      );

      if (action === 'accept') {
        // Assign task to user who accepted
        await client.query(
          `UPDATE task_pool SET
            assigned_to = $1,
            assigned_by = $2,
            assigned_at = CURRENT_TIMESTAMP,
            status = 'assigned',
            help_request_status = 'accepted',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3`,
          [req.user.id, helpRequest.requested_by, helpRequest.task_pool_id]
        );

        // Update task status
        await client.query(
          'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT task_id FROM task_pool WHERE id = $2)',
          ['in_progress', helpRequest.task_pool_id]
        );
      } else {
        // Declined - reset help request fields
        await client.query(
          `UPDATE task_pool SET
            help_requested_from = NULL,
            help_requested_by = NULL,
            help_request_message = NULL,
            help_request_status = 'declined',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
          [helpRequest.task_pool_id]
        );
      }

      // Notify requester
      await client.query(
        `INSERT INTO notifications (
          user_id, type, title, content, related_user_id, priority
        ) VALUES ($1, 'task_assigned', $2, $3, $4, 'normal')`,
        [
          helpRequest.requested_by,
          action === 'accept' ? 'Help Request Accepted' : 'Help Request Declined',
          `${req.user.name} ${action === 'accept' ? 'accepted' : 'declined'} your help request`,
          req.user.id
        ]
      );

      await client.query('COMMIT');

      // Broadcast via WebSocket
      const io = getIO();
      if (io) {
        io.to(`user_${helpRequest.requested_by}`).emit('task_pool:help_response', {
          requestId,
          action,
          respondedBy: {
            id: req.user.id,
            name: req.user.name
          }
        });
      }

      logger.info('Help request responded', { requestId, action, userId: req.user.id });

      res.json({
        success: true,
        action,
        message: `Help request ${action}ed successfully`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error responding to help request', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/task-pool/help-requests/my
// @desc    Get help requests for current user
router.get('/help-requests/my', auth, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT
        thr.*,
        tp.task_title, tp.available_date,
        requester.name as requested_by_name,
        requester.profile_photo as requested_by_photo
      FROM task_help_requests thr
      LEFT JOIN task_pool tp ON thr.task_pool_id = tp.id
      LEFT JOIN users requester ON thr.requested_by = requester.id
      WHERE thr.requested_user_id = $1
    `;

    const params = [req.user.id];

    if (status) {
      query += ' AND thr.status = $2';
      params.push(status);
    }

    query += ' ORDER BY thr.created_at DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching help requests', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/task-pool/:taskPoolId/complete
// @desc    Mark task as completed
router.post('/:taskPoolId/complete', auth, async (req, res) => {
  try {
    const { taskPoolId } = req.params;
    const { notes } = req.body;

    // Check if user is assigned to task
    const checkResult = await pool.query(
      'SELECT * FROM task_pool WHERE id = $1 AND (assigned_to = $2 OR claimed_by = $2)',
      [taskPoolId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'Sie sind dieser Aufgabe nicht zugewiesen' });
    }

    const client = await pool.getClient();
    try {
      await client.query('BEGIN');

      // Update task pool
      await client.query(
        `UPDATE task_pool SET
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [taskPoolId]
      );

      // Update task
      await client.query(
        `UPDATE tasks SET
          status = 'done',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [checkResult.rows[0].task_id]
      );

      // Add completion note if provided
      if (notes) {
        await client.query(
          `INSERT INTO task_comments (task_id, user_id, comment, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [checkResult.rows[0].task_id, req.user.id, `Task completed. Notes: ${notes}`]
        );
      }

      await client.query('COMMIT');

      // Broadcast via WebSocket
      const io = getIO();
      if (io) {
        io.emit('task_pool:task_completed', {
          taskPoolId,
          completedBy: {
            id: req.user.id,
            name: req.user.name
          }
        });
      }

      logger.info('Task completed', { taskPoolId, userId: req.user.id });

      res.json({
        success: true,
        message: 'Aufgabe als abgeschlossen markiert'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error completing task', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/task-pool/create (admin/superadmin only)
// @desc    Add task to daily pool
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Administratorzugriff erforderlich' });
    }

    const {
      taskId, availableDate, priority, estimatedDuration,
      requiredSkills, isRecurring, recurrencePattern
    } = req.body;

    // Get task details
    const taskResult = await pool.query(
      'SELECT title FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    }

    const result = await pool.query(
      `INSERT INTO task_pool (
        task_id, available_date, task_title, task_priority,
        estimated_duration, required_skills, is_recurring, recurrence_pattern,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        taskId, availableDate, taskResult.rows[0].title, priority,
        estimatedDuration, requiredSkills, isRecurring, recurrencePattern
      ]
    );

    logger.info('Task added to pool', { taskPoolId: result.rows[0].id, taskId, addedBy: req.user.id });

    res.status(201).json(result.rows[0]);

  } catch (error) {
    logger.error('Error creating task pool entry', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
