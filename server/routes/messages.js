const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const ApiController = require('../controllers/apiController');

const router = express.Router();
const apiController = new ApiController();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const parseLimit = (limit) => {
  const parsed = parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const parseDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`Invalid ${fieldName} parameter`);
    error.statusCode = 400;
    throw error;
  }

  return parsed.toISOString();
};

const normalizeMessage = (message, currentUserId) => {
  if (!message) {
    return null;
  }

  const isReceiver = message.receiver_id === currentUserId;

  return {
    ...message,
    read_status: Boolean(message.read_status || (isReceiver ? 1 : 0)),
    delivered_status: Boolean(message.delivered_status ?? (isReceiver ? 1 : 0))
  };
};

// @route   GET /api/messages
// @desc    Get message history for user or a specific conversation
router.get('/', auth, async (req, res) => {
  const { with: conversationWith, limit, before, after } = req.query;

  try {
    const safeLimit = parseLimit(limit);
    const conversationId = conversationWith ? parseInt(conversationWith, 10) : null;

    if (conversationWith && (Number.isNaN(conversationId) || conversationId <= 0)) {
      return apiController.sendError(res, 'Invalid conversation target', 400);
    }

    const beforeDate = parseDate(before, 'before');
    const afterDate = parseDate(after, 'after');

    const params = [req.user.id, req.user.id];
    const conditions = [];

    if (conversationId) {
      conditions.push(`((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`);
      params.push(req.user.id, conversationId, conversationId, req.user.id);
    }

    if (afterDate) {
      conditions.push('datetime(m.created_at) > datetime(?)');
      params.push(afterDate);
    }

    if (beforeDate) {
      conditions.push('datetime(m.created_at) < datetime(?)');
      params.push(beforeDate);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = ` AND ${conditions.join(' AND ')}`;
    }

    const query = `
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.is_group,
        m.read_status,
        m.delivered_status,
        m.created_at,
        sender.name AS sender_name,
        receiver.name AS receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE (m.sender_id = ? OR m.receiver_id = ?)
      ${whereClause}
      ORDER BY datetime(m.created_at) DESC
      LIMIT ?
    `;

    params.push(safeLimit);

    const rows = await apiController.executeQuery(db, query, params, 'all');
    const normalizedRows = rows
      .map((row) => normalizeMessage(row, req.user.id))
      .filter(Boolean)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (conversationId) {
      await apiController.executeQuery(
        db,
        `UPDATE messages SET read_status = 1, delivered_status = 1 WHERE sender_id = ? AND receiver_id = ? AND read_status = 0`,
        [conversationId, req.user.id],
        'run'
      );
    } else {
      await apiController.executeQuery(
        db,
        'UPDATE messages SET read_status = 1, delivered_status = 1 WHERE receiver_id = ? AND read_status = 0',
        [req.user.id],
        'run'
      );
    }

    const hasMore = rows.length === safeLimit;
    const nextCursor = hasMore && normalizedRows.length > 0 ? normalizedRows[0].created_at : null;
    const latestCursor = normalizedRows.length > 0 ? normalizedRows[normalizedRows.length - 1].created_at : afterDate || null;

    return apiController.sendResponse(
      res,
      normalizedRows,
      'Messages retrieved successfully',
      200,
      {
        meta: {
          hasMore,
          nextCursor,
          latestCursor,
          count: normalizedRows.length
        }
      }
    );
  } catch (error) {
    console.error('Error loading messages:', error);
    return apiController.sendError(res, error.message || 'Unable to load messages', error.statusCode || 500);
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get count of unread messages (optionally from a specific user)
router.get('/unread-count', auth, async (req, res) => {
  const { from } = req.query;

  try {
    const senderId = from ? parseInt(from, 10) : null;

    if (from && (Number.isNaN(senderId) || senderId <= 0)) {
      return apiController.sendError(res, 'Invalid sender parameter', 400);
    }

    const params = [req.user.id];
    let query = 'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read_status = 0';

    if (senderId) {
      query += ' AND sender_id = ?';
      params.push(senderId);
    }

    const row = await apiController.executeQuery(db, query, params, 'get');

    return apiController.sendResponse(
      res,
      { unreadCount: row?.count || 0 },
      'Unread count retrieved successfully'
    );
  } catch (error) {
    console.error('Error loading unread count:', error);
    return apiController.sendError(res, error.message || 'Unable to load unread count', error.statusCode || 500);
  }
});

// @route   POST /api/messages
// @desc    Send a message
router.post('/', auth, async (req, res) => {
  const { receiverId, message, isGroup } = req.body;

  try {
    const isGroupMessage = Boolean(isGroup);
    const sanitizedMessage = apiController.sanitizeInput(message);
    const trimmedMessage = typeof sanitizedMessage === 'string' ? sanitizedMessage.trim() : '';

    if (!trimmedMessage) {
      return apiController.sendError(res, 'Message cannot be empty', 400);
    }

    if (trimmedMessage.length > 5000) {
      return apiController.sendError(res, 'Message is too long. Maximum length is 5000 characters.', 400);
    }

    let targetUserId = null;

    if (!isGroupMessage) {
      const parsedReceiverId = parseInt(receiverId, 10);

      if (Number.isNaN(parsedReceiverId) || parsedReceiverId <= 0) {
        return apiController.sendError(res, 'Invalid receiver specified', 400);
      }

      if (parsedReceiverId === req.user.id) {
        return apiController.sendError(res, 'You cannot send a private message to yourself', 400);
      }

      const receiver = await apiController.executeQuery(
        db,
        'SELECT id, name FROM users WHERE id = ?',
        [parsedReceiverId],
        'get'
      );

      if (!receiver) {
        return apiController.sendError(res, 'Receiver not found', 404);
      }

      targetUserId = parsedReceiverId;
    }

    const result = await apiController.executeQuery(
      db,
      `INSERT INTO messages (sender_id, receiver_id, message, is_group, read_status, delivered_status, created_at)
       VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`,
      [
        req.user.id,
        isGroupMessage ? null : targetUserId,
        trimmedMessage,
        isGroupMessage ? 1 : 0,
        isGroupMessage ? 1 : 0
      ],
      'run'
    );

    const insertedMessage = await apiController.executeQuery(
      db,
      `SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.is_group,
        m.read_status,
        m.delivered_status,
        m.created_at,
        sender.name AS sender_name,
        receiver.name AS receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE m.id = ?`,
      [result.id],
      'get'
    );

    return apiController.sendResponse(
      res,
      normalizeMessage(insertedMessage, req.user.id),
      'Message sent successfully',
      201
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return apiController.sendError(res, error.message || 'Unable to send message', error.statusCode || 500);
  }
});

// @route   GET /api/messages/users
// @desc    Get all users for messaging with conversation metadata
router.get('/users', auth, async (req, res) => {
  try {
    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        (
          SELECT message
          FROM messages
          WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
          ORDER BY datetime(created_at) DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT created_at
          FROM messages
          WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
          ORDER BY datetime(created_at) DESC
          LIMIT 1
        ) AS last_message_at,
        (
          SELECT COUNT(*)
          FROM messages
          WHERE sender_id = u.id AND receiver_id = ? AND read_status = 0
        ) AS unread_count
      FROM users u
      WHERE u.id != ?
      ORDER BY (last_message_at IS NULL), datetime(last_message_at) DESC, u.name COLLATE NOCASE ASC
    `;

    const users = await apiController.executeQuery(
      db,
      query,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
      'all'
    );

    const normalizedUsers = users.map((user) => ({
      ...user,
      unread_count: Number(user.unread_count) || 0
    }));

    return apiController.sendResponse(
      res,
      normalizedUsers,
      'Messaging users retrieved successfully',
      200,
      {
        meta: {
          count: normalizedUsers.length
        }
      }
    );
  } catch (error) {
    console.error('Error loading messaging users:', error);
    return apiController.sendError(res, error.message || 'Unable to load messaging users', error.statusCode || 500);
  }
});

module.exports = router;