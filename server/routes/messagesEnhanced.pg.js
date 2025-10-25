const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();

// @route   POST /api/messages/:messageId/react
// @desc    Add reaction to message
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    // Check if message exists
    const messageCheck = await pool.query(
      'SELECT id, sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Add or remove reaction (toggle)
    const existing = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, req.user.id, emoji]
    );

    let result;
    let action;

    if (existing.rows.length > 0) {
      // Remove reaction
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, req.user.id, emoji]
      );
      action = 'removed';
      result = { emoji, user_id: req.user.id, action };
    } else {
      // Add reaction
      const insertResult = await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [messageId, req.user.id, emoji]
      );
      action = 'added';
      result = insertResult.rows[0];
    }

    // Get all reactions for this message
    const reactions = await pool.query(
      `SELECT emoji, COUNT(*) as count, array_agg(user_id) as user_ids
       FROM message_reactions
       WHERE message_id = $1
       GROUP BY emoji`,
      [messageId]
    );

    // Broadcast via WebSocket
    const io = getIO();
    if (io) {
      io.emit('message:reaction', {
        messageId,
        reactions: reactions.rows,
        action,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Message reaction toggled', { messageId, emoji, action, userId: req.user.id });

    res.json({
      success: true,
      action,
      reactions: reactions.rows
    });

  } catch (error) {
    logger.error('Error adding reaction', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/:messageId/reactions
// @desc    Get all reactions for a message
router.get('/:messageId/reactions', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await pool.query(
      `SELECT
        mr.emoji,
        COUNT(*) as count,
        json_agg(json_build_object(
          'user_id', u.id,
          'user_name', u.name,
          'user_photo', u.profile_photo,
          'created_at', mr.created_at
        )) as users
       FROM message_reactions mr
       LEFT JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1
       GROUP BY mr.emoji
       ORDER BY COUNT(*) DESC`,
      [messageId]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching reactions', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/:messageId/quote
// @desc    Quote/reply to a message
router.post('/:messageId/quote', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, receiverId, conversationId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Get original message
    const originalMsg = await pool.query(
      'SELECT id, content, sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (originalMsg.rows.length === 0) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    const client = await pool.getClient();
    try {
      await client.query('BEGIN');

      // Create new message
      const messageResult = await client.query(
        `INSERT INTO messages (sender_id, receiver_id, conversation_id, content, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [req.user.id, receiverId, conversationId, content]
      );

      const newMessage = messageResult.rows[0];

      // Create quote reference
      await client.query(
        `INSERT INTO message_quotes (message_id, quoted_message_id, quoted_by, quoted_text)
         VALUES ($1, $2, $3, $4)`,
        [newMessage.id, messageId, req.user.id, originalMsg.rows[0].content]
      );

      await client.query('COMMIT');

      // Fetch with full details
      const fullMessage = await pool.query(
        `SELECT
          m.*,
          sender.name as sender_name,
          sender.profile_photo as sender_photo,
          receiver.name as receiver_name,
          mq.quoted_message_id,
          mq.quoted_text,
          quoted_sender.name as quoted_sender_name
         FROM messages m
         LEFT JOIN users sender ON m.sender_id = sender.id
         LEFT JOIN users receiver ON m.receiver_id = receiver.id
         LEFT JOIN message_quotes mq ON m.id = mq.message_id
         LEFT JOIN messages quoted_msg ON mq.quoted_message_id = quoted_msg.id
         LEFT JOIN users quoted_sender ON quoted_msg.sender_id = quoted_sender.id
         WHERE m.id = $1`,
        [newMessage.id]
      );

      // Broadcast via WebSocket
      const io = getIO();
      if (io) {
        io.to(`user_${receiverId}`).emit('message:new', fullMessage.rows[0]);
      }

      logger.info('Message quote created', { messageId: newMessage.id, quotedMessageId: messageId });

      res.status(201).json(fullMessage.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error creating quote message', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/:messageId/mention
// @desc    Create mention in message (called when @username is used)
router.post('/:messageId/mention', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { mentionedUserIds } = req.body; // Array of user IDs

    if (!Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
      return res.status(400).json({ error: 'Mentioned user IDs required' });
    }

    // Check if message exists
    const messageCheck = await pool.query(
      'SELECT id FROM messages WHERE id = $1 AND sender_id = $2',
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    const mentions = [];

    for (const userId of mentionedUserIds) {
      const result = await pool.query(
        `INSERT INTO message_mentions (message_id, mentioned_user_id, mentioned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, mentioned_user_id) DO NOTHING
         RETURNING *`,
        [messageId, userId, req.user.id]
      );

      if (result.rows.length > 0) {
        mentions.push(result.rows[0]);

        // WebSocket notification
        const io = getIO();
        if (io) {
          io.to(`user_${userId}`).emit('message:mentioned', {
            messageId,
            mentionedBy: {
              id: req.user.id,
              name: req.user.name
            }
          });
        }
      }
    }

    logger.info('Message mentions created', { messageId, count: mentions.length });

    res.json({
      success: true,
      mentions
    });

  } catch (error) {
    logger.error('Error creating mentions', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/mentions/my
// @desc    Get messages where user was mentioned
router.get('/mentions/my', auth, async (req, res) => {
  try {
    const { is_read, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT
        m.*,
        sender.name as sender_name,
        sender.profile_photo as sender_photo,
        mm.is_read as mention_read,
        mm.created_at as mentioned_at
      FROM message_mentions mm
      JOIN messages m ON mm.message_id = m.id
      JOIN users sender ON m.sender_id = sender.id
      WHERE mm.mentioned_user_id = $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (is_read !== undefined) {
      query += ` AND mm.is_read = $${paramIndex}`;
      params.push(is_read === 'true');
      paramIndex++;
    }

    query += ` ORDER BY mm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching mentions', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/messages/mentions/:mentionId/read
// @desc    Mark mention as read
router.put('/mentions/:mentionId/read', auth, async (req, res) => {
  try {
    const { mentionId } = req.params;

    const result = await pool.query(
      `UPDATE message_mentions SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND mentioned_user_id = $2
      RETURNING *`,
      [mentionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error marking mention as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/:messageId/calendar-ref
// @desc    Link calendar event to message
router.post('/:messageId/calendar-ref', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { eventId, refType = 'mention' } = req.body;

    const result = await pool.query(
      `INSERT INTO message_calendar_refs (message_id, event_id, ref_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [messageId, eventId, refType]
    );

    logger.info('Calendar reference created', { messageId, eventId });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error creating calendar reference', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/:messageId/task-ref
// @desc    Link task to message
router.post('/:messageId/task-ref', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { taskId, refType = 'mention' } = req.body;

    const result = await pool.query(
      `INSERT INTO message_task_refs (message_id, task_id, ref_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [messageId, taskId, refType]
    );

    logger.info('Task reference created', { messageId, taskId });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error creating task reference', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/:messageId/full
// @desc    Get message with all related data (quotes, reactions, mentions, refs)
router.get('/:messageId/full', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await pool.query(
      `SELECT
        m.*,
        sender.name as sender_name,
        sender.profile_photo as sender_photo,
        receiver.name as receiver_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Get reactions
    const reactions = await pool.query(
      `SELECT emoji, COUNT(*) as count, array_agg(user_id) as user_ids
       FROM message_reactions
       WHERE message_id = $1
       GROUP BY emoji`,
      [messageId]
    );

    // Get mentions
    const mentions = await pool.query(
      `SELECT mm.*, u.name as user_name
       FROM message_mentions mm
       LEFT JOIN users u ON mm.mentioned_user_id = u.id
       WHERE mm.message_id = $1`,
      [messageId]
    );

    // Get quote reference
    const quote = await pool.query(
      `SELECT mq.*, m.content as quoted_content, u.name as quoted_sender_name
       FROM message_quotes mq
       LEFT JOIN messages m ON mq.quoted_message_id = m.id
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE mq.message_id = $1`,
      [messageId]
    );

    // Get calendar references
    const calendarRefs = await pool.query(
      `SELECT mcr.*, ce.title as event_title, ce.event_date
       FROM message_calendar_refs mcr
       LEFT JOIN calendar_events ce ON mcr.event_id = ce.id
       WHERE mcr.message_id = $1`,
      [messageId]
    );

    // Get task references
    const taskRefs = await pool.query(
      `SELECT mtr.*, t.title as task_title, t.status as task_status
       FROM message_task_refs mtr
       LEFT JOIN tasks t ON mtr.task_id = t.id
       WHERE mtr.message_id = $1`,
      [messageId]
    );

    const fullMessage = {
      ...message.rows[0],
      reactions: reactions.rows,
      mentions: mentions.rows,
      quoted_message: quote.rows[0] || null,
      calendar_refs: calendarRefs.rows,
      task_refs: taskRefs.rows
    };

    res.json(fullMessage);

  } catch (error) {
    logger.error('Error fetching full message', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
