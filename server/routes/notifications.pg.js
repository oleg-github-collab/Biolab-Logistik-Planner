const express = require('express');
const { pool } = require('../config/database');
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
        u.name as related_user_name
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      WHERE n.user_id = $1
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

    // Handle localStorage-generated IDs (e.g., 'notif-1763341037144')
    if (typeof id === 'string' && id.startsWith('notif-')) {
      logger.debug('localStorage notification marked as read (client-side only)', { id, userId: req.user.id });
      return res.json({ success: true, id, is_read: true, read_at: new Date() });
    }

    // Validate integer ID
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      `UPDATE notifications SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [numericId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    logger.info('Notification marked as read', { notificationId: numericId, userId: req.user.id });

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

    // Handle localStorage-generated IDs (e.g., 'notif-1763341037144')
    if (typeof id === 'string' && id.startsWith('notif-')) {
      logger.debug('localStorage notification deleted (client-side only)', { id, userId: req.user.id });
      return res.json({ success: true, deleted_id: id });
    }

    // Validate integer ID
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [numericId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    logger.info('Notification deleted', { notificationId: numericId, userId: req.user.id });

    res.json({ success: true, deleted_id: numericId });

  } catch (error) {
    logger.error('Error deleting notification', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/notifications/clear-all
// @desc    Clear all read notifications
router.delete('/clear-all', auth, async (req, res) => {
  try {
    // Check if notifications table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notifications'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      logger.warn('Notifications table does not exist yet');
      return res.json({
        success: true,
        deleted_count: 0
      });
    }

    // Delete all read notifications for the user
    // Use COALESCE to handle null is_read values as false
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND COALESCE(is_read, false) = true RETURNING id',
      [req.user.id]
    );

    logger.info('Notifications cleared', { userId: req.user.id, count: result.rowCount });

    res.json({
      success: true,
      deleted_count: result.rowCount
    });

  } catch (error) {
    logger.error('Error clearing notifications', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    // If table doesn't exist, return success anyway
    if (error.code === '42P01') {
      return res.json({
        success: true,
        deleted_count: 0
      });
    }

    res.status(500).json({
      error: 'Serverfehler beim Löschen der Benachrichtigungen',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// ============================================================================
// SMART NOTIFICATIONS - AI Prioritization & Advanced Features
// ============================================================================

// @route   GET /api/notifications/smart
// @desc    Get smart notifications with AI prioritization and grouping
router.get('/smart', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, include_grouped = 'false' } = req.query;

    // Check if DND is active
    const dndResult = await pool.query(
      'SELECT is_dnd_active($1) as is_dnd',
      [req.user.id]
    );
    const isDnd = dndResult.rows[0]?.is_dnd || false;

    // Get notifications sorted by AI priority
    const query = `
      SELECT
        n.*,
        u.name as related_user_name,
        ng.notification_count as group_size,
        ng.summary as group_summary
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN notification_groups ng ON n.group_key = ng.group_key AND n.user_id = ng.user_id
      WHERE n.user_id = $1
        AND (n.snoozed_until IS NULL OR n.snoozed_until <= CURRENT_TIMESTAMP)
        AND n.dismissed_at IS NULL
        ${include_grouped === 'false' ? 'AND (n.is_grouped = FALSE OR n.parent_notification_id IS NULL)' : ''}
      ORDER BY n.ai_priority_score DESC, n.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [req.user.id, limit, offset]);

    // Get grouped notifications
    const groupsResult = await pool.query(
      `SELECT * FROM notification_groups
       WHERE user_id = $1 AND is_read = FALSE AND dismissed_at IS NULL
       ORDER BY last_updated_at DESC`,
      [req.user.id]
    );

    // Get unread count
    const countResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE AND dismissed_at IS NULL',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      groups: groupsResult.rows,
      unread_count: parseInt(countResult.rows[0].unread_count),
      is_dnd_active: isDnd,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching smart notifications', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/notifications/preferences
// @desc    Get user notification preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.id]
    );

    // Return default preferences if none exist
    if (result.rows.length === 0) {
      const defaultPrefs = await pool.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json(defaultPrefs.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error fetching notification preferences', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const {
      dnd_enabled,
      dnd_start_time,
      dnd_end_time,
      dnd_days,
      auto_group_enabled,
      group_window_minutes,
      priority_weight_urgency,
      priority_weight_sender,
      priority_weight_content,
      notify_messages,
      notify_tasks,
      notify_events,
      notify_waste,
      notify_system,
      desktop_notifications,
      sound_enabled,
      vibration_enabled,
      vip_user_ids,
      muted_keywords
    } = req.body;

    const updates = [];
    const params = [req.user.id];
    let paramIndex = 2;

    const fields = {
      dnd_enabled, dnd_start_time, dnd_end_time, dnd_days,
      auto_group_enabled, group_window_minutes,
      priority_weight_urgency, priority_weight_sender, priority_weight_content,
      notify_messages, notify_tasks, notify_events, notify_waste, notify_system,
      desktop_notifications, sound_enabled, vibration_enabled,
      vip_user_ids, muted_keywords
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `
      INSERT INTO notification_preferences (user_id, ${Object.keys(fields).filter(k => fields[k] !== undefined).join(', ')})
      VALUES ($1, ${params.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updates.join(', ')},
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, params);

    logger.info('Notification preferences updated', { userId: req.user.id });
    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error updating notification preferences', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/snooze
// @desc    Snooze notification
router.put('/:id/snooze', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes = 60 } = req.body;

    // Handle localStorage-generated IDs (e.g., 'notif-1763341037144')
    if (typeof id === 'string' && id.startsWith('notif-')) {
      logger.debug('localStorage notification snoozed (client-side only)', { id, userId: req.user.id, minutes });
      const snoozedUntil = new Date(Date.now() + minutes * 60000);
      return res.json({ success: true, id, snoozed_until: snoozedUntil });
    }

    // Validate integer ID
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      `UPDATE notifications SET
        snoozed_until = CURRENT_TIMESTAMP + INTERVAL '${minutes} minutes'
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [numericId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Log action
    await pool.query(
      `INSERT INTO notification_actions (notification_id, user_id, action_type, action_metadata)
       VALUES ($1, $2, 'snooze', $3)`,
      [numericId, req.user.id, JSON.stringify({ minutes })]
    );

    logger.info('Notification snoozed', { notificationId: numericId, userId: req.user.id, minutes });
    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error snoozing notification', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/dismiss
// @desc    Dismiss notification
router.put('/:id/dismiss', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Handle localStorage-generated IDs (e.g., 'notif-1763341037144')
    if (typeof id === 'string' && id.startsWith('notif-')) {
      logger.debug('localStorage notification dismissed (client-side only)', { id, userId: req.user.id });
      return res.json({ success: true, id, dismissed_at: new Date() });
    }

    // Validate integer ID
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      `UPDATE notifications SET
        dismissed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [numericId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Log action
    await pool.query(
      `INSERT INTO notification_actions (notification_id, user_id, action_type)
       VALUES ($1, $2, 'dismiss')`,
      [numericId, req.user.id]
    );

    logger.info('Notification dismissed', { notificationId: numericId, userId: req.user.id });
    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error dismissing notification', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/action
// @desc    Mark notification action taken
router.put('/:id/action', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action_type, metadata = {} } = req.body;

    // Handle localStorage-generated IDs (e.g., 'notif-1763341037144')
    if (typeof id === 'string' && id.startsWith('notif-')) {
      logger.debug('localStorage notification action taken (client-side only)', { id, userId: req.user.id, action: action_type });
      return res.json({
        success: true,
        id,
        action_taken: action_type,
        action_taken_at: new Date(),
        is_read: true,
        read_at: new Date()
      });
    }

    // Validate integer ID
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      `UPDATE notifications SET
        action_taken = $3,
        action_taken_at = CURRENT_TIMESTAMP,
        is_read = TRUE,
        read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [numericId, req.user.id, action_type]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Log action
    await pool.query(
      `INSERT INTO notification_actions (notification_id, user_id, action_type, action_metadata)
       VALUES ($1, $2, $3, $4)`,
      [numericId, req.user.id, action_type, metadata]
    );

    logger.info('Notification action taken', { notificationId: numericId, userId: req.user.id, action: action_type });
    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error recording notification action', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/notifications/groups/:groupKey
// @desc    Get all notifications in a group
router.get('/groups/:groupKey', auth, async (req, res) => {
  try {
    const { groupKey } = req.params;

    const result = await pool.query(
      `SELECT n.*, u.name as related_user_name
       FROM notifications n
       LEFT JOIN users u ON n.related_user_id = u.id
       WHERE n.user_id = $1 AND n.group_key = $2
       ORDER BY n.created_at DESC`,
      [req.user.id, groupKey]
    );

    res.json({ notifications: result.rows });

  } catch (error) {
    logger.error('Error fetching group notifications', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/notifications/groups/:groupKey/read
// @desc    Mark all notifications in group as read
router.put('/groups/:groupKey/read', auth, async (req, res) => {
  try {
    const { groupKey } = req.params;

    // Update all notifications in group
    await pool.query(
      `UPDATE notifications SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND group_key = $2 AND is_read = FALSE`,
      [req.user.id, groupKey]
    );

    // Update group
    const result = await pool.query(
      `UPDATE notification_groups SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND group_key = $2
       RETURNING *`,
      [req.user.id, groupKey]
    );

    logger.info('Notification group marked as read', { groupKey, userId: req.user.id });
    res.json(result.rows[0] || { success: true });

  } catch (error) {
    logger.error('Error marking group as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/notifications/analytics
// @desc    Get notification analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Get notification stats
    const statsResult = await pool.query(
      `SELECT
        type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = TRUE) as read,
        COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL) as dismissed,
        COUNT(*) FILTER (WHERE action_taken IS NOT NULL) as acted_upon,
        AVG(ai_priority_score) as avg_priority,
        AVG(EXTRACT(EPOCH FROM (COALESCE(read_at, CURRENT_TIMESTAMP) - created_at))) as avg_time_to_read
       FROM notifications
       WHERE user_id = $1
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
       GROUP BY type`,
      [req.user.id]
    );

    // Get action distribution
    const actionsResult = await pool.query(
      `SELECT
        action_type,
        COUNT(*) as count
       FROM notification_actions
       WHERE user_id = $1
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
       GROUP BY action_type
       ORDER BY count DESC`,
      [req.user.id]
    );

    // Get daily trend
    const trendResult = await pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        AVG(ai_priority_score) as avg_priority
       FROM notifications
       WHERE user_id = $1
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [req.user.id]
    );

    res.json({
      stats_by_type: statsResult.rows,
      actions: actionsResult.rows,
      daily_trend: trendResult.rows
    });

  } catch (error) {
    logger.error('Error fetching notification analytics', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
