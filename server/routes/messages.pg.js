const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO, sendNotificationToUser } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/messages
// @desc    Get all messages
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId } = req.query;

    let query = `
      SELECT m.*,
        sender.name as sender_name,
        sender.role as sender_role,
        recipient.name as recipient_name
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by conversation if userId provided
    if (userId) {
      query += ` WHERE (m.sender_id = $${paramIndex} AND m.recipient_id = $${paramIndex + 1})
                 OR (m.sender_id = $${paramIndex + 1} AND m.recipient_id = $${paramIndex})`;
      params.push(req.user.id, parseInt(userId));
      paramIndex += 2;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json(result.rows.reverse()); // Reverse to show oldest first

  } catch (error) {
    logger.error('Error fetching messages', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get list of conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_user_id)
         other_user_id as user_id,
         other_user_name as name,
         other_user_role as role,
         last_message,
         last_message_time,
         unread_count
       FROM (
         SELECT
           CASE
             WHEN m.sender_id = $1 THEN m.recipient_id
             ELSE m.sender_id
           END as other_user_id,
           CASE
             WHEN m.sender_id = $1 THEN recipient.name
             ELSE sender.name
           END as other_user_name,
           CASE
             WHEN m.sender_id = $1 THEN recipient.role
             ELSE sender.role
           END as other_user_role,
           m.content as last_message,
           m.created_at as last_message_time,
           COUNT(*) FILTER (WHERE m.recipient_id = $1 AND m.read = false) OVER (PARTITION BY
             CASE
               WHEN m.sender_id = $1 THEN m.recipient_id
               ELSE m.sender_id
             END
           ) as unread_count,
           ROW_NUMBER() OVER (
             PARTITION BY
               CASE
                 WHEN m.sender_id = $1 THEN m.recipient_id
                 ELSE m.sender_id
               END
             ORDER BY m.created_at DESC
           ) as rn
         FROM messages m
         LEFT JOIN users sender ON m.sender_id = sender.id
         LEFT JOIN users recipient ON m.recipient_id = recipient.id
         WHERE m.sender_id = $1 OR m.recipient_id = $1
       ) conversations
       WHERE rn = 1
       ORDER BY other_user_id, last_message_time DESC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get count of unread messages
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE recipient_id = $1 AND read = false',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });

  } catch (error) {
    logger.error('Error fetching unread count', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send a new message
router.post('/', auth, async (req, res) => {
  try {
    const { recipientId, content, gif } = req.body;

    // Validate
    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    if (!content && !gif) {
      return res.status(400).json({ error: 'Message content or GIF is required' });
    }

    // Check if recipient exists
    const recipientResult = await pool.query(
      'SELECT id, name FROM users WHERE id = $1',
      [recipientId]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const recipient = recipientResult.rows[0];

    // Insert message
    const insertResult = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, content, gif, read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.user.id, recipientId, content || null, gif || null]
    );

    const message = insertResult.rows[0];

    // Fetch with joined data
    const messageResult = await pool.query(
      `SELECT m.*,
         sender.name as sender_name,
         sender.role as sender_role,
         recipient.name as recipient_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.recipient_id = recipient.id
       WHERE m.id = $1`,
      [message.id]
    );

    const formattedMessage = messageResult.rows[0];

    // Broadcast to WebSocket
    const io = getIO();
    if (io) {
      io.emit('message:new', {
        message: formattedMessage,
        sender: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    // Send notification to recipient
    sendNotificationToUser(recipientId, {
      title: `New message from ${req.user.name}`,
      body: content || 'Sent a GIF',
      icon: '/favicon.ico',
      tag: `message_${message.id}`,
      data: {
        url: '/messenger',
        messageId: message.id,
        senderId: req.user.id
      }
    });

    logger.info('Message sent', {
      messageId: message.id,
      senderId: req.user.id,
      recipientId
    });

    res.status(201).json(formattedMessage);

  } catch (error) {
    logger.error('Error sending message', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify message exists and user is recipient
    const messageResult = await pool.query(
      'SELECT id, recipient_id FROM messages WHERE id = $1',
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];

    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as read
    await pool.query(
      'UPDATE messages SET read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // Broadcast read receipt
    const io = getIO();
    if (io) {
      io.emit('message:read', {
        messageId: id,
        userId: req.user.id
      });
    }

    res.json({ message: 'Message marked as read' });

  } catch (error) {
    logger.error('Error marking message as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/messages/conversation/:userId/read-all
// @desc    Mark all messages in conversation as read
router.put('/conversation/:userId/read-all', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `UPDATE messages
       SET read = true, updated_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1 AND recipient_id = $2 AND read = false
       RETURNING id`,
      [parseInt(userId), req.user.id]
    );

    const markedCount = result.rowCount;

    // Broadcast read receipts
    if (markedCount > 0) {
      const io = getIO();
      if (io) {
        io.emit('message:read_all', {
          senderId: parseInt(userId),
          recipientId: req.user.id,
          messageIds: result.rows.map(r => r.id)
        });
      }
    }

    logger.info('Marked all messages as read', {
      userId: req.user.id,
      senderId: userId,
      count: markedCount
    });

    res.json({
      message: 'All messages marked as read',
      count: markedCount
    });

  } catch (error) {
    logger.error('Error marking all messages as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify message exists and user is sender
    const messageResult = await pool.query(
      'SELECT id, sender_id, recipient_id FROM messages WHERE id = $1',
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];

    // Only sender or admin can delete
    if (message.sender_id !== req.user.id &&
        req.user.role !== 'admin' &&
        req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete message
    await pool.query('DELETE FROM messages WHERE id = $1', [id]);

    // Broadcast deletion
    const io = getIO();
    if (io) {
      io.emit('message:deleted', {
        messageId: id,
        senderId: message.sender_id,
        recipientId: message.recipient_id
      });
    }

    logger.info('Message deleted', {
      messageId: id,
      deletedBy: req.user.id
    });

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    logger.error('Error deleting message', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/typing
// @desc    Broadcast typing indicator
router.post('/typing', auth, async (req, res) => {
  try {
    const { recipientId, isTyping } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    const io = getIO();
    if (io) {
      io.emit('user:typing', {
        userId: req.user.id,
        userName: req.user.name,
        recipientId: parseInt(recipientId),
        isTyping: !!isTyping
      });
    }

    res.json({ success: true });

  } catch (error) {
    logger.error('Error broadcasting typing indicator', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
