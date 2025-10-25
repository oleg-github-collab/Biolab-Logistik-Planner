const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const { type, is_read, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        n.*,
        u.name as related_user_name,
        u.profile_photo as related_user_photo
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      WHERE n.user_id = $1
        AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (type) {
      query += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (is_read !== undefined) {
      query += ` AND n.is_read = $${paramIndex}`;
      params.push(is_read === 'true');
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get unread count
    const countResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(countResult.rows[0].unread_count),
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching notifications', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE type = 'message') as messages,
        COUNT(*) FILTER (WHERE type = 'mention') as mentions,
        COUNT(*) FILTER (WHERE type = 'reaction') as reactions,
        COUNT(*) FILTER (WHERE type = 'task_assigned') as tasks,
        COUNT(*) FILTER (WHERE type = 'calendar_event') as events,
        COUNT(*) as total
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error fetching unread count', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    logger.info('Notification marked as read', { notificationId: id, userId: req.user.id });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error marking notification as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const { type } = req.body;

    let query = 'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = FALSE';
    const params = [req.user.id];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }

    const result = await pool.query(query, params);

    logger.info('All notifications marked as read', { userId: req.user.id, type });

    res.json({
      success: true,
      updated_count: result.rowCount
    });

  } catch (error) {
    logger.error('Error marking all notifications as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    logger.info('Notification deleted', { notificationId: id, userId: req.user.id });

    res.json({ success: true, deleted_id: id });

  } catch (error) {
    logger.error('Error deleting notification', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/notifications/clear-all
// @desc    Clear all read notifications
router.delete('/clear-all', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE RETURNING id',
      [req.user.id]
    );

    logger.info('All read notifications cleared', { userId: req.user.id, count: result.rowCount });

    res.json({
      success: true,
      deleted_count: result.rowCount
    });

  } catch (error) {
    logger.error('Error clearing notifications', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/notifications/test
// @desc    Create test notification (dev only)
router.post('/test', auth, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }

    const { type = 'system', title = 'Test Notification', content = 'This is a test' } = req.body;

    const result = await pool.query(
      `INSERT INTO notifications (
        user_id, type, title, content, priority
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [req.user.id, type, title, content, 'normal']
    );

    // Emit via WebSocket
    const io = getIO();
    if (io) {
      io.to(`user_${req.user.id}`).emit('notification:new', result.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error creating test notification', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
