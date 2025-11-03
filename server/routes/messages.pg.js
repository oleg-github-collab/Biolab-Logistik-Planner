const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO, sendNotificationToUser } = require('../websocket');
const logger = require('../utils/logger');
const { getOnlineUsers } = require('../services/redisService');
const { schemas, validate } = require('../validators');
const {
  ensureDirectConversation,
  createConversation,
  addMembersToConversation,
  removeMemberFromConversation,
  getConversationMembers,
  fetchConversationById,
  listUserConversations,
  CONVERSATION_TYPES
} = require('../services/conversationService');
const {
  normalizeMessageRow,
  enrichMessages,
  createMessageRecord
} = require('../services/messageService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Stelle sicher, dass uploads-Ordner existiert
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer-Konfiguration für File-Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ungültiger Dateityp. Nur Bilder und Audio-Dateien sind erlaubt.'));
    }
  }
});


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
      LEFT JOIN users recipient ON m.receiver_id = recipient.id
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by conversation if userId provided
    if (userId) {
      query += ` WHERE (m.sender_id = $${paramIndex} AND m.receiver_id = $${paramIndex + 1})
                 OR (m.sender_id = $${paramIndex + 1} AND m.receiver_id = $${paramIndex})`;
      params.push(req.user.id, parseInt(userId));
      paramIndex += 2;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json(result.rows.reverse()); // Reverse to show oldest first

  } catch (error) {
    logger.error('Error fetching messages', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get list of conversations for current user
router.get('/contacts', auth, async (req, res) => {
  try {
    const { search = '', includeSelf = 'false', limit } = req.query;
    const conditions = [];
    const params = [];

    if (includeSelf !== 'true') {
      params.push(req.user.id);
      conditions.push(`id <> $${params.length}`);
    }

    if (search) {
      const searchParam = `%${search.toLowerCase()}%`;
      const nameIndex = params.push(searchParam);
      const emailIndex = params.push(searchParam);
      conditions.push(`(LOWER(name) LIKE $${nameIndex} OR LOWER(email) LIKE $${emailIndex})`);
    }

    let query = `
      SELECT id, name, email, role, profile_photo, status, status_message, last_seen_at
      FROM users
    `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY name ASC';

    if (limit) {
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);

    let onlineSet = new Set();
    try {
      const onlineUsers = await getOnlineUsers();
      if (Array.isArray(onlineUsers) && onlineUsers.length > 0) {
        onlineSet = new Set(onlineUsers.map(user => parseInt(user.userId, 10)));
      }
    } catch (redisError) {
      logger.warn('Konnte Online-Status aus Redis nicht laden', { error: redisError.message });
    }

    const contacts = result.rows.map((user) => ({
      ...user,
      is_online: onlineSet.has(user.id)
    }));

    res.json(contacts);
  } catch (error) {
    logger.error('Error fetching contacts list', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get list of conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_user_id)
         other_user_id as id,
         other_user_name as name,
         other_user_email as email,
         other_user_role as role,
         last_message as lastMessage,
         last_message_time as lastMessageTime,
         unread_count as unreadCount
       FROM (
         SELECT
           CASE
             WHEN m.sender_id = $1 THEN m.receiver_id
             ELSE m.sender_id
           END as other_user_id,
           CASE
             WHEN m.sender_id = $1 THEN recipient.name
             ELSE sender.name
           END as other_user_name,
           CASE
             WHEN m.sender_id = $1 THEN recipient.email
             ELSE sender.email
           END as other_user_email,
           CASE
             WHEN m.sender_id = $1 THEN recipient.role
             ELSE sender.role
           END as other_user_role,
           m.message as last_message,
           m.created_at as last_message_time,
           COUNT(*) FILTER (WHERE m.receiver_id = $1 AND m.read_status = false) OVER (PARTITION BY
             CASE
               WHEN m.sender_id = $1 THEN m.receiver_id
               ELSE m.sender_id
             END
           ) as unread_count,
           ROW_NUMBER() OVER (
             PARTITION BY
               CASE
                 WHEN m.sender_id = $1 THEN m.receiver_id
                 ELSE m.sender_id
               END
             ORDER BY m.created_at DESC
           ) as rn
         FROM messages m
         LEFT JOIN users sender ON m.sender_id = sender.id
         LEFT JOIN users recipient ON m.receiver_id = recipient.id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
       ) conversations
       WHERE rn = 1
       ORDER BY other_user_id, last_message_time DESC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/messages/threads
// @desc    Get unified conversations (direct, groups, topics) for current user
router.get('/threads', auth, async (req, res) => {
  try {
    const conversations = await listUserConversations(req.user.id);

    const formatted = conversations.map((conversation) => ({
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      type: conversation.conversation_type,
      isTemporary: conversation.is_temporary,
      expiresAt: conversation.expires_at,
      updatedAt: conversation.updated_at,
      participantCount: Number(conversation.participant_count) || 0,
      unreadCount: Number(conversation.unread_count) || 0,
      lastMessage: conversation.last_message_id
        ? {
            id: conversation.last_message_id,
            content: conversation.last_message,
            messageType: conversation.last_message_type,
            createdAt: conversation.last_message_at,
            senderId: conversation.last_message_sender
          }
        : null,
      myRole: conversation.my_role,
      myLastReadAt: conversation.my_last_read_at,
      isMuted: conversation.my_muted,
      members: conversation.member_snapshot || []
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('Error fetching unified conversation threads', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/conversations
// @desc    Create a new group/topic conversation
router.post('/conversations', auth, async (req, res) => {
  const {
    name,
    description,
    memberIds = [],
    type = CONVERSATION_TYPES.GROUP,
    isTemporary = false,
    expiresAt = null
  } = req.body;

  if (![CONVERSATION_TYPES.GROUP, CONVERSATION_TYPES.TOPIC, CONVERSATION_TYPES.DIRECT].includes(type)) {
    return res.status(400).json({ error: 'Ungültiger Konversationstyp' });
  }

  const cleanedMemberIds = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id !== req.user.id)))
    : [];

  // For DIRECT conversations, exactly 1 other member is required
  if (type === CONVERSATION_TYPES.DIRECT) {
    if (cleanedMemberIds.length !== 1) {
      return res.status(400).json({ error: 'Direkte Konversationen benötigen genau einen anderen Teilnehmer' });
    }
  } else {
    // For GROUP/TOPIC, at least 1 other member is required
    if (cleanedMemberIds.length === 0) {
      return res.status(400).json({ error: 'Mindestens ein weiterer Teilnehmer ist erforderlich' });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const conversation = await createConversation(client, {
      name,
      description,
      type,
      createdBy: req.user.id,
      memberIds: cleanedMemberIds,
      isTemporary,
      expiresAt,
      settings: {}
    });

    const members = await getConversationMembers(client, conversation.id);

    await client.query('COMMIT');

    const io = getIO();
    if (io) {
      const payload = {
        conversation: {
          id: conversation.id,
          name: conversation.name,
          description: conversation.description,
          type: conversation.conversation_type,
          isTemporary: conversation.is_temporary,
          expiresAt: conversation.expires_at,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at
        },
        members
      };

      members.forEach((member) => {
        io.to(`user_${member.user_id}`).emit('conversation:created', payload);
      });
    }

    res.status(201).json({
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      type: conversation.conversation_type,
      isTemporary: conversation.is_temporary,
      expiresAt: conversation.expires_at,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      members
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating conversation', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/conversations/:conversationId
// @desc    Fetch conversation details with members
router.get('/conversations/:conversationId', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);

  if (!conversationId) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const membership = await client.query(
      `SELECT role, last_read_at, is_muted
         FROM message_conversation_members
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const members = await getConversationMembers(client, conversationId);

    res.json({
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      type: conversation.conversation_type,
      isTemporary: conversation.is_temporary,
      expiresAt: conversation.expires_at,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      myRole: membership.rows[0].role,
      myLastReadAt: membership.rows[0].last_read_at,
      isMuted: membership.rows[0].is_muted,
      members
    });
  } catch (error) {
    logger.error('Error fetching conversation detail', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/conversations/:conversationId/messages
// @desc    Fetch messages for a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);

  if (!conversationId) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const membership = await client.query(
      `SELECT role, last_read_at
         FROM message_conversation_members
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const messagesResult = await client.query(
      `SELECT
          m.*,
          sender.name AS sender_name,
          sender.profile_photo AS sender_photo
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    await client.query(
      `UPDATE message_conversation_members
          SET last_read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (conversation.conversation_type === CONVERSATION_TYPES.DIRECT) {
      await client.query(
        `UPDATE messages
            SET read_status = true, read_at = CURRENT_TIMESTAMP
          WHERE conversation_id = $1 AND receiver_id = $2 AND read_status = false`,
        [conversationId, req.user.id]
      );
    }

    const messages = await enrichMessages(client, messagesResult.rows);

    res.json(messages);
  } catch (error) {
    logger.error('Error fetching conversation messages', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   POST /api/messages/conversations/:conversationId/members
// @desc    Add members to a conversation
router.post('/conversations/:conversationId/members', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);
  const { memberIds = [] } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const cleanedMemberIds = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id !== req.user.id)))
    : [];

  if (cleanedMemberIds.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Teilnehmer erforderlich' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const membership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const myRole = membership.rows[0].role;
    if (myRole !== 'owner' && myRole !== 'moderator' && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Hinzufügen von Teilnehmern' });
    }

    await addMembersToConversation(client, conversationId, cleanedMemberIds);

    const members = await getConversationMembers(client, conversationId);

    const io = getIO();
    if (io) {
      const payload = {
        conversationId,
        members,
        addedMemberIds: cleanedMemberIds
      };

      members.forEach((member) => {
        io.to(`user_${member.user_id}`).emit('conversation:members_updated', payload);
      });
    }

    res.json({
      conversationId,
      members
    });
  } catch (error) {
    logger.error('Error adding members to conversation', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   DELETE /api/messages/conversations/:conversationId/members/:userId
// @desc    Remove a member or leave a conversation
router.delete('/conversations/:conversationId/members/:userId', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);
  const memberId = parseInt(req.params.userId, 10);

  if (!conversationId || !memberId) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const membership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const targetMembership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, memberId]
    );

    if (targetMembership.rows.length === 0) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
    }

    const actingRole = membership.rows[0].role;
    const targetRole = targetMembership.rows[0].role;

    const isSelf = memberId === req.user.id;
    const hasAdminPrivileges = actingRole === 'owner' || actingRole === 'moderator' || ['admin', 'superadmin'].includes(req.user.role);

    if (!isSelf && !hasAdminPrivileges) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Entfernen von Teilnehmern' });
    }

    if (!isSelf && targetRole === 'owner' && actingRole !== 'owner') {
      return res.status(403).json({ error: 'Der Besitzer der Konversation kann nicht entfernt werden' });
    }

    await removeMemberFromConversation(client, conversationId, memberId);

    const members = await getConversationMembers(client, conversationId);

    const io = getIO();
    if (io) {
      const payload = {
        conversationId,
        members,
        removedMemberId: memberId
      };

      members.forEach((member) => {
        io.to(`user_${member.user_id}`).emit('conversation:members_updated', payload);
      });

      io.to(`user_${memberId}`).emit('conversation:removed', {
        conversationId
      });
    }

    res.json({
      conversationId,
      members
    });
  } catch (error) {
    logger.error('Error removing conversation member', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   POST /api/messages/conversations/:conversationId/read
// @desc    Mark conversation as read for the current user
router.post('/conversations/:conversationId/read', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);

  if (!conversationId) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const membership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    await client.query(
      `UPDATE message_conversation_members
          SET last_read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (conversation.conversation_type === CONVERSATION_TYPES.DIRECT) {
      await client.query(
        `UPDATE messages
            SET read_status = true, read_at = CURRENT_TIMESTAMP
          WHERE conversation_id = $1 AND receiver_id = $2 AND read_status = false`,
        [conversationId, req.user.id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking conversation as read', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/conversation/:userId
// @desc    Get all messages in a conversation with a specific user
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const otherUserId = parseInt(userId);

    const result = await pool.query(
      `SELECT m.*,
         sender.name as sender_name,
         sender.role as sender_role,
         recipient.name as recipient_name,
         COALESCE(
           (SELECT json_agg(json_build_object('emoji', emoji, 'count', count, 'user_ids', user_ids))
            FROM (
              SELECT emoji, COUNT(*) as count, array_agg(user_id) as user_ids
              FROM message_reactions
              WHERE message_id = m.id
              GROUP BY emoji
            ) reactions),
           '[]'::json
         ) as reactions
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.receiver_id = recipient.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [req.user.id, otherUserId]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages
       SET read_status = true, read_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1 AND receiver_id = $2 AND read_status = false`,
      [otherUserId, req.user.id]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching conversation messages', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get count of unread messages
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND read_status = false',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });

  } catch (error) {
    logger.error('Error fetching unread count', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/start
// @desc    Start a conversation with a user
router.post('/start', auth, async (req, res) => {
  try {
    const { receiver_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ error: 'Empfänger-ID ist erforderlich' });
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [receiver_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];

    // Return conversation object
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

  } catch (error) {
    logger.error('Error starting conversation', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages
// @desc    Send a new message
const sendMessageHandler = async (req, res) => {
  const {
    recipientId: bodyRecipientId,
    receiverId,
    conversationId,
    content: bodyContent,
    message: bodyMessage,
    gif,
    attachments = [],
    messageType,
    quotedMessageId,
    mentionedUserIds = [],
    metadata = {}
  } = req.body;

  const recipientId = bodyRecipientId ?? receiverId;
  const content = bodyContent ?? bodyMessage;

  if (!recipientId && !conversationId) {
    return res.status(400).json({ error: 'Empfänger oder Konversation ist erforderlich' });
  }

  if (!content && !gif && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Nachrichteninhalt erforderlich' });
  }

  if (content && content.length > 5000) {
    return res.status(400).json({ error: 'Nachricht zu lang (max 5000 Zeichen)' });
  }

  const sanitizedContent = content ? content.replace(/<script[^>]*>.*?<\/script>/gi, '').trim() : null;
  const attachmentPayload = Array.isArray(attachments) ? attachments : [];
  const messageContent = sanitizedContent || gif || (attachmentPayload.length ? '[attachment]' : null);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let targetConversationId = conversationId ? parseInt(conversationId, 10) : null;
    let resolvedRecipientId = recipientId ? parseInt(recipientId, 10) : null;
    let conversation;

    if (targetConversationId) {
      conversation = await fetchConversationById(client, targetConversationId);
      if (!conversation) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Konversation nicht gefunden' });
      }

      const memberCheck = await client.query(
        `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
        [targetConversationId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
      }

      if (conversation.conversation_type === 'direct' && !resolvedRecipientId) {
        const otherMember = await client.query(
          `SELECT user_id FROM message_conversation_members WHERE conversation_id = $1 AND user_id <> $2 LIMIT 1`,
          [targetConversationId, req.user.id]
        );
        resolvedRecipientId = otherMember.rows[0]?.user_id || null;
      }
    } else {
      if (!resolvedRecipientId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Empfänger ist erforderlich' });
      }

      const recipientCheck = await client.query(
        'SELECT id, name FROM users WHERE id = $1',
        [resolvedRecipientId]
      );

      if (recipientCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Empfänger nicht gefunden' });
      }

      conversation = await ensureDirectConversation(client, req.user.id, resolvedRecipientId);
      targetConversationId = conversation.id;
    }

    const normalizedQuotedId = quotedMessageId ? parseInt(quotedMessageId, 10) : null;
    const rawMessage = await createMessageRecord(client, {
      senderId: req.user.id,
      conversationId: targetConversationId,
      receiverId: resolvedRecipientId,
      messageContent,
      messageType: gif ? 'gif' : (messageType || 'text'),
      attachments: attachmentPayload,
      metadata,
      quotedMessageId: Number.isInteger(normalizedQuotedId) ? normalizedQuotedId : null,
      mentionedUserIds
    });

    await client.query(
      'UPDATE message_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetConversationId]
    );
    if (conversation) {
      conversation.updated_at = new Date().toISOString();
    }

    await client.query(
      `UPDATE message_conversation_members
         SET last_read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1 AND user_id = $2`,
      [targetConversationId, req.user.id]
    );

    const enriched = await enrichMessages(client, [rawMessage]);
    const enrichedMessage = enriched[0] || normalizeMessageRow(rawMessage);

    await client.query('COMMIT');

    const membersResult = await pool.query(
      `SELECT user_id FROM message_conversation_members WHERE conversation_id = $1`,
      [targetConversationId]
    );
    const memberIds = membersResult.rows.map((row) => row.user_id);

    const payloadMessage = {
      ...enrichedMessage,
      conversation_name: conversation?.name || null,
      conversation_type: conversation?.conversation_type || (resolvedRecipientId ? 'direct' : 'group'),
      conversation_is_temporary: conversation?.is_temporary || false,
      conversation_updated_at: conversation?.updated_at || new Date().toISOString()
    };

    const io = getIO();
    if (io) {
      const payload = {
        conversationId: targetConversationId,
        message: payloadMessage
      };

      io.to(`conversation_${targetConversationId}`).emit('conversation:new_message', payload);

      memberIds.forEach((memberId) => {
        if (memberId !== req.user.id) {
          io.to(`user_${memberId}`).emit('conversation:new_message', payload);
        }
      });
    }

    memberIds
      .filter((memberId) => memberId !== req.user.id)
      .forEach((memberId) => {
        sendNotificationToUser(memberId, {
          type: 'message',
          title: `${req.user.name} hat eine neue Nachricht gesendet`,
          message: messageContent || 'Neue Aktivität in der Konversation',
          data: {
            url: '/messages',
            conversationId: targetConversationId,
            messageId: payloadMessage.id
          }
        });
      });

    logger.info('Message sent', {
      messageId: payloadMessage.id,
      senderId: req.user.id,
      conversationId: targetConversationId,
      recipientId: resolvedRecipientId
    });

    res.status(201).json({
      conversationId: targetConversationId,
      message: payloadMessage,
      conversation,
      members: memberIds
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error sending message', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
};

router.post('/', auth, sendMessageHandler);

router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  req.body.conversationId = req.params.conversationId;
  return sendMessageHandler(req, res);
});

// @route   POST /api/messages/:messageId/react
// @desc    Add or remove a reaction on a message
router.post('/:messageId/react', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);
  const { emoji } = req.body;

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
    return res.status(400).json({ error: 'Emoji ist erforderlich' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const messageCheck = await client.query(
      `SELECT id, sender_id, receiver_id, conversation_id
         FROM messages
        WHERE id = $1`,
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const messageRow = messageCheck.rows[0];
    let memberIds = [];

    if (messageRow.conversation_id) {
      const membership = await client.query(
        `SELECT user_id
           FROM message_conversation_members
          WHERE conversation_id = $1`,
        [messageRow.conversation_id]
      );

      memberIds = membership.rows.map((row) => row.user_id);

      if (!memberIds.includes(req.user.id) && !['admin', 'superadmin'].includes(req.user.role)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
      }
    } else {
      const participants = [messageRow.sender_id, messageRow.receiver_id].filter(Boolean);
      if (!participants.includes(req.user.id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Keine Berechtigung für diese Nachricht' });
      }
      memberIds = participants;
    }

    const existing = await client.query(
      `SELECT id
         FROM message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, req.user.id, emoji]
    );

    let action;

    if (existing.rows.length > 0) {
      await client.query(
        'DELETE FROM message_reactions WHERE id = $1',
        [existing.rows[0].id]
      );
      action = 'removed';
    } else {
      await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, req.user.id, emoji]
      );
      action = 'added';
    }

    const messageDetail = await client.query(
      `SELECT
          m.*,
          sender.name AS sender_name,
          sender.profile_photo AS sender_photo
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE m.id = $1`,
      [messageId]
    );

    const enriched = await enrichMessages(client, messageDetail.rows);
    const enrichedMessage = enriched[0] || normalizeMessageRow(messageDetail.rows[0]);
    const reactions = enrichedMessage?.reactions || [];

    await client.query('COMMIT');

    const io = getIO();
    if (io) {
      const payload = {
        messageId,
        conversationId: messageRow.conversation_id || null,
        reactions,
        action,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      };

      if (messageRow.conversation_id) {
        io.to(`conversation_${messageRow.conversation_id}`).emit('message:reaction', payload);
        memberIds
          .filter((memberId) => memberId !== req.user.id)
          .forEach((memberId) => io.to(`user_${memberId}`).emit('message:reaction', payload));
      } else {
        memberIds.forEach((memberId) => {
          io.to(`user_${memberId}`).emit('message:reaction', payload);
        });
      }
    }

    res.json({
      success: true,
      action,
      reactions
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error toggling message reaction', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/:messageId/reactions
// @desc    Retrieve aggregated reactions for a message
router.get('/:messageId/reactions', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  const client = await pool.connect();

  try {
    const messageResult = await client.query(
      `SELECT
          m.*,
          sender.name AS sender_name,
          sender.profile_photo AS sender_photo
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const hydrated = await enrichMessages(client, messageResult.rows);
    const message = hydrated[0] || normalizeMessageRow(messageResult.rows[0]);

    res.json(message.reactions || []);
  } catch (error) {
    logger.error('Error fetching message reactions', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   POST /api/messages/:messageId/quote
// @desc    Create a reply that quotes an existing message
router.post('/:messageId/quote', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);
  const { content, conversationId, receiverId, attachments = [], metadata = {}, mentionedUserIds = [] } = req.body;

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Inhalt ist erforderlich' });
  }

  try {
    const originalResult = await pool.query(
      `SELECT id, sender_id, receiver_id, conversation_id
         FROM messages
        WHERE id = $1`,
      [messageId]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Originalnachricht nicht gefunden' });
    }

    const original = originalResult.rows[0];
    const fallbackRecipient = original.sender_id === req.user.id ? original.receiver_id : original.sender_id;

    req.body = {
      recipientId: receiverId || fallbackRecipient,
      conversationId: conversationId || original.conversation_id || null,
      content,
      attachments,
      metadata,
      mentionedUserIds,
      quotedMessageId: messageId
    };

    return sendMessageHandler(req, res);
  } catch (error) {
    logger.error('Error creating quoted message', error);
    return res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/:messageId/mention
// @desc    Attach mention metadata to a message
router.post('/:messageId/mention', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);
  const { mentionedUserIds } = req.body;

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  if (!Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
    return res.status(400).json({ error: 'mentionedUserIds ist erforderlich' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const messageResult = await client.query(
      `SELECT id, sender_id, receiver_id, conversation_id
         FROM messages
        WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const message = messageResult.rows[0];

    if (message.conversation_id) {
      const membership = await client.query(
        `SELECT user_id
           FROM message_conversation_members
          WHERE conversation_id = $1`,
        [message.conversation_id]
      );

      const memberIds = membership.rows.map((row) => row.user_id);
      if (!memberIds.includes(req.user.id) && !['admin', 'superadmin'].includes(req.user.role)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Keine Berechtigung zum Markieren' });
      }
    } else if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Keine Berechtigung zum Markieren' });
    }

    const uniqueMentions = Array.from(new Set(
      mentionedUserIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id !== req.user.id)
    ));

    const createdMentions = [];

    for (const mentionedId of uniqueMentions) {
      const result = await client.query(
        `INSERT INTO message_mentions (message_id, mentioned_user_id, mentioned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, mentioned_user_id) DO NOTHING
         RETURNING *`,
        [messageId, mentionedId, req.user.id]
      );
      if (result.rows.length > 0) {
        createdMentions.push(result.rows[0]);
      }
    }

    const mentionDetails = await client.query(
      `SELECT
         mm.*,
         mentioned.name AS mentioned_user_name,
         mentioned.profile_photo AS mentioned_user_photo,
         author.name AS mentioned_by_name
       FROM message_mentions mm
       LEFT JOIN users mentioned ON mm.mentioned_user_id = mentioned.id
       LEFT JOIN users author ON mm.mentioned_by = author.id
       WHERE mm.message_id = $1
       ORDER BY mm.created_at ASC`,
      [messageId]
    );

    await client.query('COMMIT');

    const io = getIO();
    if (io) {
      createdMentions.forEach((mention) => {
        io.to(`user_${mention.mentioned_user_id}`).emit('message:mentioned', {
          messageId,
          mentionedBy: {
            id: req.user.id,
            name: req.user.name
          }
        });
      });
    }

    res.json({
      success: true,
      mentions: mentionDetails.rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating mentions', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/mentions/my
// @desc    Fetch mentions for the current user
router.get('/mentions/my', auth, async (req, res) => {
  const { is_read, limit = 20, offset = 0 } = req.query;

  const params = [req.user.id];
  const conditions = ['mm.mentioned_user_id = $1'];

  if (is_read !== undefined) {
    params.push(is_read === 'true');
    conditions.push(`mm.is_read = $${params.length}`);
  }

  params.push(parseInt(limit, 10) || 20);
  params.push(parseInt(offset, 10) || 0);

  try {
    const { rows } = await pool.query(
      `SELECT
         mm.*,
         mentioned.name AS mentioned_user_name,
         mentioned.profile_photo AS mentioned_user_photo,
         author.name AS mentioned_by_name,
         m.id AS message_id,
         m.message,
         m.message_type,
         m.conversation_id,
         sender.name AS sender_name,
         sender.profile_photo AS sender_photo,
         m.created_at AS message_created_at
       FROM message_mentions mm
       LEFT JOIN users mentioned ON mm.mentioned_user_id = mentioned.id
       LEFT JOIN users author ON mm.mentioned_by = author.id
       LEFT JOIN messages m ON mm.message_id = m.id
       LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY mm.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    res.json(rows);
  } catch (error) {
    logger.error('Error fetching mentions', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/messages/mentions/:mentionId/read
// @desc    Mark a mention as read
router.put('/mentions/:mentionId/read', auth, async (req, res) => {
  const mentionId = parseInt(req.params.mentionId, 10);

  if (!Number.isInteger(mentionId)) {
    return res.status(400).json({ error: 'Ungültige Mention-ID' });
  }

  try {
    const result = await pool.query(
      `UPDATE message_mentions
          SET is_read = TRUE,
              read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND mentioned_user_id = $2
        RETURNING *`,
      [mentionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mention nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error marking mention as read', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/:messageId/calendar-ref
// @desc    Link a calendar event to a message
router.post('/:messageId/calendar-ref', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);
  const { eventId, refType = 'mention' } = req.body;

  if (!Number.isInteger(messageId) || !Number.isInteger(eventId)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO message_calendar_refs (message_id, event_id, ref_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, event_id) DO UPDATE SET ref_type = EXCLUDED.ref_type
       RETURNING *`,
      [messageId, eventId, refType]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating calendar reference', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/:messageId/task-ref
// @desc    Link a task to a message
router.post('/:messageId/task-ref', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);
  const { taskId, refType = 'mention' } = req.body;

  if (!Number.isInteger(messageId) || !Number.isInteger(taskId)) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO message_task_refs (message_id, task_id, ref_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, task_id) DO UPDATE SET ref_type = EXCLUDED.ref_type
       RETURNING *`,
      [messageId, taskId, refType]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating task reference', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/messages/:messageId/full
// @desc    Retrieve message with all related metadata
router.get('/:messageId/full', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  const client = await pool.connect();

  try {
    const messageResult = await client.query(
      `SELECT
          m.*,
          sender.name AS sender_name,
          sender.profile_photo AS sender_photo,
          receiver.name AS receiver_name
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
        LEFT JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const enriched = await enrichMessages(client, messageResult.rows);
    const message = enriched[0] || normalizeMessageRow(messageResult.rows[0]);

    res.json(message);
  } catch (error) {
    logger.error('Error fetching full message', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify message exists and user is recipient
    const messageResult = await pool.query(
      'SELECT id, receiver_id FROM messages WHERE id = $1',
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const message = messageResult.rows[0];

    if (message.receiver_id !== req.user.id) {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    // Mark as read
    await pool.query(
      'UPDATE messages SET read_status = true, read_at = CURRENT_TIMESTAMP WHERE id = $1',
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

    res.json({ message: 'Nachricht als gelesen markiert' });

  } catch (error) {
    logger.error('Error marking message as read', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/messages/conversation/:userId/read-all
// @desc    Mark all messages in conversation as read
router.put('/conversation/:userId/read-all', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `UPDATE messages
       SET read_status = true, read_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1 AND receiver_id = $2 AND read_status = false
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
      message: 'Alle Nachrichten als gelesen markiert',
      count: markedCount
    });

  } catch (error) {
    logger.error('Error marking all messages as read', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify message exists and user is sender
    const messageResult = await pool.query(
      'SELECT id, sender_id, receiver_id FROM messages WHERE id = $1',
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const message = messageResult.rows[0];

    // Only sender or admin can delete
    if (message.sender_id !== req.user.id &&
        req.user.role !== 'admin' &&
        req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    // Delete message
    await pool.query('DELETE FROM messages WHERE id = $1', [id]);

    // Broadcast deletion
    const io = getIO();
    if (io) {
      io.emit('message:deleted', {
        messageId: id,
        senderId: message.sender_id,
        recipientId: message.receiver_id
      });
    }

    logger.info('Message deleted', {
      messageId: id,
      deletedBy: req.user.id
    });

    res.json({ message: 'Nachricht erfolgreich gelöscht' });

  } catch (error) {
    logger.error('Error deleting message', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/typing
// @desc    Broadcast typing indicator
router.post('/typing', auth, async (req, res) => {
  try {
    const { recipientId, isTyping } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Empfänger ist erforderlich' });
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
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/upload
// @desc    Upload file and send as message
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const { receiverId, messageType } = req.body;

    if (!receiverId || receiverId == req.user.id) {
      // Lösche hochgeladene Datei bei Fehler
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Ungültiger Empfänger' });
    }

    // Erstelle öffentliche URL für die Datei
    const fileUrl = `/uploads/${req.file.filename}`;

    // Speichere Nachricht in DB
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message, message_type, is_group, read_status, created_at)
       VALUES ($1, $2, $3, $4, false, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.user.id, parseInt(receiverId), fileUrl, messageType]
    );

    const message = result.rows[0];

    // Hole Sender-Info
    const senderResult = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [req.user.id]
    );

    // Sende via WebSocket
    const io = getIO();
    if (io) {
      io.emit('new_message', {
        ...message,
        sender_name: senderResult.rows[0].name
      });
    }

    res.json({
      ...message,
      fileUrl: fileUrl
    });

  } catch (error) {
    logger.error('Upload error:', error);
    // Lösche hochgeladene Datei bei Fehler
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

module.exports = router;
