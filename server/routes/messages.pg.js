const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const ensureGeneralChatMembership = require('../middleware/ensureGeneralChatMembership');
const { getIO, sendNotificationToUser } = require('../websocket');
const logger = require('../utils/logger');
const blBot = require('../services/blBot');
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
// UUID handled by PostgreSQL uuid_generate_v4()

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

const storyUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for stories
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/ogg'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ungültiger Dateityp. Nur Bilder und Videos sind erlaubt.'));
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
router.get('/threads', auth, ensureGeneralChatMembership, async (req, res) => {
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

// @route   PUT /api/messages/conversations/:conversationId
// @desc    Update conversation details (name/description)
router.put('/conversations/:conversationId', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);
  const { name, description } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const cleanedName = typeof name === 'string' ? name.trim() : null;
  const cleanedDescription = typeof description === 'string' ? description.trim() : null;

  if (!cleanedName && !cleanedDescription) {
    return res.status(400).json({ error: 'Keine Aktualisierungen angegeben' });
  }

  const client = await pool.connect();

  try {
    const conversation = await fetchConversationById(client, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    if (conversation.conversation_type === CONVERSATION_TYPES.DIRECT) {
      return res.status(400).json({ error: 'Direkte Konversationen können nicht umbenannt werden' });
    }

    const membership = await client.query(
      `SELECT role
         FROM message_conversation_members
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const myRole = membership.rows[0].role;
    const canEdit =
      myRole === 'owner' ||
      myRole === 'moderator' ||
      ['admin', 'superadmin'].includes(req.user.role);

    if (!canEdit) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten der Konversation' });
    }

    const updateResult = await client.query(
      `UPDATE message_conversations
          SET name = COALESCE($1, name),
              description = COALESCE($2, description),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *`,
      [cleanedName || null, cleanedDescription || null, conversationId]
    );

    const updated = updateResult.rows[0];
    const members = await getConversationMembers(client, conversationId);

    const io = getIO();
    if (io) {
      const payload = {
        conversationId,
        conversation: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          type: updated.conversation_type,
          updatedAt: updated.updated_at
        },
        members
      };

      members.forEach((member) => {
        io.to(`user_${member.user_id}`).emit('conversation:updated', payload);
      });
    }

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      type: updated.conversation_type,
      updatedAt: updated.updated_at,
      members
    });
  } catch (error) {
    logger.error('Error updating conversation', error);
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

    const messages = await enrichMessages(client, messagesResult.rows);

    // DON'T auto-mark as read on load - let user explicitly mark as read
    // This keeps unread counters accurate

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

    // Emit WebSocket event to update unread counts in real-time
    const io = getIO();
    if (io) {
      io.to(`user_${req.user.id}`).emit('message:read', {
        conversationId,
        userId: req.user.id
      });
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
      `SELECT COALESCE(SUM(count), 0) AS count
         FROM (
           SELECT COUNT(*)::INT AS count
             FROM messages m
            WHERE m.conversation_id IS NULL
              AND m.receiver_id = $1
              AND m.read_status = false
           UNION ALL
           SELECT COUNT(*)::INT AS count
             FROM message_conversation_members mcm
             JOIN messages m ON m.conversation_id = mcm.conversation_id
            WHERE mcm.user_id = $1
              AND m.sender_id <> $1
              AND m.created_at > COALESCE(mcm.last_read_at, '1970-01-01'::timestamp)
         ) unread`,
      [req.user.id]
    );

    const unreadCount = parseInt(result.rows[0]?.count || 0, 10);

    // Return both formats for compatibility
    res.json({
      count: unreadCount,
      unreadCount: unreadCount
    });

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

  // Parse @mentions from message content
  let parsedMentionedUserIds = [...mentionedUserIds];
  if (messageContent && typeof messageContent === 'string') {
    // Support @Name and @{Full Name With Spaces}
    const mentionRegex = /@(\{[^}]+\}|[^\s@]+)/g;
    const matches = Array.from(messageContent.matchAll(mentionRegex));
    const mentionedNames = matches
      .map((match) => {
        let raw = match[1] || '';
        if (raw.startsWith('{') && raw.endsWith('}')) {
          raw = raw.slice(1, -1);
        }
        raw = raw.replace(/[.,!?;:]+$/, '').trim();
        return raw;
      })
      .filter(Boolean);

    const normalizedNames = Array.from(
      new Set(mentionedNames.map((name) => name.toLowerCase()))
    );

    console.log('📝 Parsing @mentions from message:', {
      messageContent,
      mentionedNames: normalizedNames,
      hasMatches: normalizedNames.length > 0
    });

    if (normalizedNames.length > 0) {
      // Fetch user IDs for mentioned names (case-insensitive)
      const { rows: mentionedUsers } = await pool.query(
        `SELECT id, name FROM users WHERE LOWER(name) = ANY($1::text[])`,
        [normalizedNames]
      );

      console.log('👥 Found mentioned users in database:', {
        mentionedUsers,
        foundCount: mentionedUsers.length
      });

      parsedMentionedUserIds.push(...mentionedUsers.map(u => u.id));
      parsedMentionedUserIds = [...new Set(parsedMentionedUserIds)]; // Remove duplicates
    }
  }

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
      mentionedUserIds: parsedMentionedUserIds
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

    // Check if message is sent to BL_Bot and process it
    if (blBot.initialized && blBot.botUser) {
      const botId = blBot.botUser.id;
      const isSentToBot = resolvedRecipientId === botId || memberIds.includes(botId);
      const isFromBot = req.user.id === botId;

      // In group conversations: only respond if @mentioned
      // In direct conversations: always respond
      const shouldRespond = !isFromBot && (
        (resolvedRecipientId === botId) || // Direct message to bot
        (conversation?.conversation_type === 'direct') || // Direct conversation
        (parsedMentionedUserIds && parsedMentionedUserIds.includes(botId)) // @mentioned in group
      );

      console.log('🤖 BL_Bot message check:', {
        botId,
        isSentToBot,
        isFromBot,
        shouldRespond,
        conversationType: conversation?.conversation_type,
        resolvedRecipientId,
        parsedMentionedUserIds,
        messageContent
      });

      if (isSentToBot && shouldRespond) {
        console.log('✅ BL_Bot will respond to this message');

        // Show typing indicator immediately
        io.to(`conversation_${targetConversationId}`).emit('typing:start', {
          conversationId: targetConversationId,
          userId: 1, // BL_Bot user ID
          userName: 'BL_Bot'
        });

        // Process message with BL_Bot in background
        setImmediate(async () => {
          try {
            console.log('🤖 Calling blBot.processIncomingMessage with conversationId:', targetConversationId);
            const response = await blBot.processIncomingMessage(req.user.id, messageContent, targetConversationId);
            console.log('🤖 BL_Bot response received:', response ? 'YES' : 'NO');

            // Stop typing indicator
            io.to(`conversation_${targetConversationId}`).emit('typing:stop', {
              conversationId: targetConversationId,
              userId: 1
            });

            if (response) {
              // For group conversations, send to conversation
              // For direct conversations, send to user
              if (targetConversationId && conversation?.conversation_type !== 'direct') {
                console.log('🤖 Sending to conversation:', targetConversationId);
                await blBot.sendMessageToConversation(targetConversationId, response);
              } else {
                console.log('🤖 Sending to user:', req.user.id);
                await blBot.sendMessage(req.user.id, response);
              }
              console.log('✅ BL_Bot message sent successfully');
            }
          } catch (error) {
            console.error('❌ Error processing BL_Bot message:', error);
            logger.error('Error processing BL_Bot message:', error);

            // Stop typing indicator on error
            io.to(`conversation_${targetConversationId}`).emit('typing:stop', {
              conversationId: targetConversationId,
              userId: 1
            });
          }
        });
      } else {
        console.log('❌ BL_Bot will NOT respond (isSentToBot:', isSentToBot, 'shouldRespond:', shouldRespond, ')');
      }
    }

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

// @route   POST /api/messages/:messageId/pin
// @desc    Pin a message in a conversation
router.post('/:messageId/pin', auth, async (req, res) => {
  const messageId = parseInt(req.params.messageId, 10);

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const messageResult = await client.query(
      `SELECT id, sender_id, receiver_id, conversation_id FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const message = messageResult.rows[0];

    if (!message.conversation_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nur Nachrichten in Konversationen können angepinnt werden' });
    }

    // Check if user is member of conversation
    const membership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [message.conversation_id, req.user.id]
    );

    if (membership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    // Check if already pinned
    const existingPin = await client.query(
      `SELECT id FROM message_pins WHERE message_id = $1 AND conversation_id = $2`,
      [messageId, message.conversation_id]
    );

    let action;

    if (existingPin.rows.length > 0) {
      // Unpin
      await client.query(
        `DELETE FROM message_pins WHERE id = $1`,
        [existingPin.rows[0].id]
      );
      action = 'unpinned';
    } else {
      // Pin
      await client.query(
        `INSERT INTO message_pins (message_id, conversation_id, pinned_by, pinned_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [messageId, message.conversation_id, req.user.id]
      );
      action = 'pinned';
    }

    await client.query('COMMIT');

    // Emit WebSocket event
    const io = getIO();
    if (io) {
      io.to(`conversation_${message.conversation_id}`).emit('message:pin', {
        messageId,
        conversationId: message.conversation_id,
        action,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info(`Message ${action}`, { messageId, userId: req.user.id, conversationId: message.conversation_id });

    res.json({ success: true, action });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error toggling message pin:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// @route   GET /api/messages/conversations/:conversationId/pins
// @desc    Get all pinned messages for a conversation
router.get('/conversations/:conversationId/pins', auth, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId, 10);

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ error: 'Ungültige Konversations-ID' });
  }

  const client = await pool.connect();

  try {
    // Check if user is member
    const membership = await client.query(
      `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Zugriff auf diese Konversation' });
    }

    const result = await client.query(
      `SELECT
        mp.*,
        m.message,
        m.message_type,
        m.created_at as message_created_at,
        sender.name as sender_name,
        sender.profile_photo as sender_photo,
        pinner.name as pinned_by_name
       FROM message_pins mp
       INNER JOIN messages m ON mp.message_id = m.id
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users pinner ON mp.pinned_by = pinner.id
       WHERE mp.conversation_id = $1
       ORDER BY mp.pinned_at DESC`,
      [conversationId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching pinned messages:', error);
    res.status(500).json({ error: 'Serverfehler' });
  } finally {
    client.release();
  }
});

// ============================================
// QUICK REPLY TEMPLATES
// ============================================

// @route   GET /api/messages/quick-replies
// @desc    Get user's quick reply templates
router.get('/quick-replies', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM quick_reply_templates WHERE user_id = $1';
    const params = [req.user.id];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY usage_count DESC, title ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching quick replies:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/quick-replies
// @desc    Create quick reply template
router.post('/quick-replies', auth, async (req, res) => {
  try {
    const { title, content, shortcut, category = 'general' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Inhalt zu lang (max 5000 Zeichen)' });
    }

    const result = await pool.query(
      `INSERT INTO quick_reply_templates (user_id, title, content, shortcut, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, content, shortcut || null, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating quick reply:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/messages/quick-replies/:id
// @desc    Update quick reply template
router.put('/quick-replies/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, shortcut, category } = req.body;

    // Verify ownership
    const checkResult = await pool.query(
      'SELECT id FROM quick_reply_templates WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (content !== undefined) {
      if (content.length > 5000) {
        return res.status(400).json({ error: 'Inhalt zu lang (max 5000 Zeichen)' });
      }
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }
    if (shortcut !== undefined) {
      updates.push(`shortcut = $${paramIndex++}`);
      values.push(shortcut);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Aktualisierungen angegeben' });
    }

    values.push(id, req.user.id);

    const result = await pool.query(
      `UPDATE quick_reply_templates
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating quick reply:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/messages/quick-replies/:id
// @desc    Delete quick reply template
router.delete('/quick-replies/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM quick_reply_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting quick reply:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/messages/quick-replies/:id/use
// @desc    Increment usage count
router.post('/quick-replies/:id/use', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE quick_reply_templates
       SET usage_count = usage_count + 1
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error incrementing usage count:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// CONTACT NOTES
// ============================================

// @route   GET /api/messages/contacts/:contactId/notes
// @desc    Get note for contact
router.get('/contacts/:contactId/notes', auth, async (req, res) => {
  try {
    const { contactId } = req.params;

    const result = await pool.query(
      'SELECT * FROM contact_notes WHERE user_id = $1 AND contact_id = $2',
      [req.user.id, contactId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching contact note:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/messages/contacts/:contactId/notes
// @desc    Create or update contact note
router.put('/contacts/:contactId/notes', auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { note, tags = [] } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Notiz darf nicht leer sein' });
    }

    // Verify contact exists
    const contactCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [contactId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Kontakt nicht gefunden' });
    }

    const result = await pool.query(
      `INSERT INTO contact_notes (user_id, contact_id, note, tags)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, contact_id)
       DO UPDATE SET note = EXCLUDED.note, tags = EXCLUDED.tags, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, contactId, note, tags]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error saving contact note:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/messages/contacts/:contactId/notes
// @desc    Delete contact note
router.delete('/contacts/:contactId/notes', auth, async (req, res) => {
  try {
    const { contactId } = req.params;

    const result = await pool.query(
      'DELETE FROM contact_notes WHERE user_id = $1 AND contact_id = $2 RETURNING id',
      [req.user.id, contactId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notiz nicht gefunden' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting contact note:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// MESSAGE SEARCH
// ============================================

// @route   GET /api/messages/search
// @desc    Full-text search messages
router.get('/search', auth, async (req, res) => {
  try {
    const { q, from, date, type = 'all', limit = 50, offset = 0, conversationId } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Suchanfrage muss mindestens 2 Zeichen lang sein' });
    }

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // User must be sender/receiver or a member of the conversation
    params.push(req.user.id);
    conditions.push(`(m.sender_id = $${paramIndex} OR m.receiver_id = $${paramIndex} OR mcm.user_id IS NOT NULL)`);
    paramIndex++;

    // Full-text search (German)
    const searchTerm = q.trim();
    conditions.push(
      `(to_tsvector('german', COALESCE(m.message, '')) @@ websearch_to_tsquery('german', $${paramIndex}) OR
        to_tsvector('german', COALESCE(m.transcription, '')) @@ websearch_to_tsquery('german', $${paramIndex}))`
    );
    params.push(searchTerm);
    paramIndex++;

    // Filter by sender
    if (from) {
      conditions.push(`m.sender_id = $${paramIndex}`);
      params.push(parseInt(from, 10));
      paramIndex++;
    }

    if (conversationId) {
      conditions.push(`m.conversation_id = $${paramIndex}`);
      params.push(parseInt(conversationId, 10));
      paramIndex++;
    }

    // Filter by date
    if (date) {
      conditions.push(`DATE(m.created_at) = $${paramIndex}`);
      params.push(date);
      paramIndex++;
    }

    // Filter by type
    if (type && type !== 'all') {
      conditions.push(`m.message_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);

    const query = `
      SELECT
        m.*,
        sender.name AS sender_name,
        sender.profile_photo AS sender_photo,
        receiver.name AS receiver_name,
        mc.name AS conversation_name,
        mc.conversation_type AS conversation_type,
        ts_rank_cd(
          to_tsvector('german', COALESCE(m.message, '') || ' ' || COALESCE(m.transcription, '')),
          websearch_to_tsquery('german', $2)
        ) AS rank
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      LEFT JOIN message_conversations mc ON m.conversation_id = mc.id
      LEFT JOIN message_conversation_members mcm
        ON m.conversation_id = mcm.conversation_id AND mcm.user_id = $1
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      LEFT JOIN message_conversation_members mcm
        ON m.conversation_id = mcm.conversation_id AND mcm.user_id = $1
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      results: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// MESSAGE FORWARDING
// ============================================

// @route   POST /api/messages/:messageId/forward
// @desc    Forward message to multiple recipients
router.post('/:messageId/forward', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { recipientIds = [], comment } = req.body;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: 'Mindestens ein Empfänger erforderlich' });
    }

    // Get original message
    const originalResult = await pool.query(
      `SELECT m.*, sender.name as sender_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE m.id = $1 AND (m.sender_id = $2 OR m.receiver_id = $2)`,
      [messageId, req.user.id]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    const original = originalResult.rows[0];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const forwardedMessages = [];

      for (const recipientId of recipientIds) {
        const parsedRecipientId = parseInt(recipientId, 10);

        // Ensure conversation exists
        const conversation = await ensureDirectConversation(client, req.user.id, parsedRecipientId);

        // Create forwarded message
        let messageContent = original.message;
        if (comment) {
          messageContent = `${comment}\n\n--- Weitergeleitete Nachricht ---\n${original.message}`;
        }

        const result = await createMessageRecord(client, {
          senderId: req.user.id,
          conversationId: conversation.id,
          receiverId: parsedRecipientId,
          messageContent,
          messageType: original.message_type,
          attachments: original.attachments || [],
          metadata: {
            is_forwarded: true,
            forwarded_from_id: original.id,
            forwarded_from_name: original.sender_name,
            forwarded_comment: comment || null
          }
        });

        // Update the message with forwarding info
        await client.query(
          `UPDATE messages
           SET is_forwarded = true,
               forwarded_from_id = $1,
               forwarded_from_name = $2
           WHERE id = $3`,
          [original.id, original.sender_name, result.id]
        );

        forwardedMessages.push(result);

        // Emit WebSocket event
        const io = getIO();
        if (io) {
          io.to(`user_${parsedRecipientId}`).emit('conversation:new_message', {
            conversationId: conversation.id,
            message: result
          });
        }

        // Send notification
        sendNotificationToUser(parsedRecipientId, {
          type: 'message',
          title: `${req.user.name} hat eine Nachricht weitergeleitet`,
          message: messageContent.substring(0, 100),
          data: {
            url: '/messages',
            conversationId: conversation.id,
            messageId: result.id
          }
        });
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        forwardedCount: forwardedMessages.length,
        messages: forwardedMessages
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error forwarding message:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ==================== BULK OPERATIONS ====================

/**
 * @route   POST /api/messages/bulk/delete
 * @desc    Bulk delete messages
 * @access  Private
 */
router.post('/bulk/delete', auth, async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Message IDs array is required' });
    }

    // Verify user owns the messages
    const checkResult = await pool.query(
      'SELECT id FROM messages WHERE id = ANY($1) AND sender_id = $2',
      [messageIds, req.user.id]
    );

    if (checkResult.rowCount !== messageIds.length) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Delete messages
    const result = await pool.query(
      `UPDATE messages SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) RETURNING id`,
      [messageIds]
    );

    // Emit WebSocket events
    const io = getIO();
    if (io) {
      result.rows.forEach(msg => {
        io.emit('message:deleted', { id: msg.id });
      });
    }

    // Audit log
    auditLogger.log({
      action: 'bulk_delete_messages',
      userId: req.user.id,
      resource: 'messages',
      details: {
        messageIds,
        deletedCount: result.rowCount
      }
    });

    res.json({
      success: true,
      deletedCount: result.rowCount
    });

  } catch (error) {
    logger.error('Error bulk deleting messages', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/messages/bulk/mark-read
 * @desc    Bulk mark messages as read
 * @access  Private
 */
router.post('/bulk/mark-read', auth, async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Message IDs array is required' });
    }

    // Mark as read (only for receiver)
    const result = await pool.query(
      `UPDATE messages
       SET read_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND receiver_id = $2 AND read_at IS NULL
       RETURNING id`,
      [messageIds, req.user.id]
    );

    // Emit WebSocket events
    const io = getIO();
    if (io) {
      result.rows.forEach(msg => {
        io.emit('message:read', {
          id: msg.id,
          readBy: req.user.id
        });
      });
    }

    res.json({
      success: true,
      markedCount: result.rowCount
    });

  } catch (error) {
    logger.error('Error bulk marking messages as read', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/stories
// @desc    Get all active stories for the current user
router.get('/stories', auth, async (req, res) => {
  try {
    // Спрощений запит - показуємо всі активні stories від усіх користувачів
    const result = await pool.query(
      `SELECT
        us.id,
        us.user_id,
        us.media_url,
        us.media_type,
        us.caption,
        us.created_at,
        us.expires_at,
        u.name as user_name,
        u.profile_photo as profile_photo_url,
        (SELECT COUNT(*) FROM user_story_views WHERE story_id = us.id) as view_count,
        (SELECT COUNT(*) > 0 FROM user_story_views WHERE story_id = us.id AND viewer_id = $1) as viewed_by_me
       FROM user_stories us
       JOIN users u ON u.id = us.user_id
       WHERE us.expires_at > NOW()
       ORDER BY us.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Serverfehler beim Laden der Stories' });
  }
});

// @route   POST /api/messages/stories
// @desc    Create a new story
router.post('/stories', auth, upload.single('file'), async (req, res) => {
  try {
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    // Determine media type
    const mediaType = req.file.mimetype.startsWith('image/') ? 'image' :
                     req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Store paths (both absolute and relative for compatibility)
    const mediaPath = req.file.path;
    const mediaUrl = `/uploads/${req.file.filename}`;

    // Create story with 24-hour expiration and explicit UUID generation
    const result = await pool.query(
      `INSERT INTO user_stories (id, user_id, media_path, media_url, media_type, caption, expires_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [req.user.id, mediaPath, mediaUrl, mediaType, caption || '']
    );

    const story = result.rows[0];

    // Get user info
    const userResult = await pool.query(
      `SELECT name, profile_photo FROM users WHERE id = $1`,
      [req.user.id]
    );

    const storyWithUser = {
      ...story,
      user_name: userResult.rows[0]?.name || 'Unknown',
      profile_photo_url: userResult.rows[0]?.profile_photo || null,
      view_count: 0,
      viewed_by_me: false
    };

    // Notify via WebSocket
    const io = getIO();
    if (io) {
      io.emit('story:new', storyWithUser);
    }

    res.status(201).json(storyWithUser);
  } catch (error) {
    logger.error('Error creating story:', error);
    logger.error('Error details:', error.message, error.stack);
    res.status(500).json({
      error: 'Serverfehler beim Erstellen der Story',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/messages/stories/:storyId/view
// @desc    Mark a story as viewed
router.post('/stories/:storyId/view', auth, async (req, res) => {
  const storyId = req.params.storyId; // UUID, not integer

  try {
    // Insert view record (ignore if already exists)
    await pool.query(
      `INSERT INTO user_story_views (story_id, viewer_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [storyId, req.user.id]
    );

    // Get updated view count
    const result = await pool.query(
      `SELECT COUNT(*) as view_count FROM user_story_views WHERE story_id = $1`,
      [storyId]
    );

    res.json({ view_count: parseInt(result.rows[0].view_count, 10) });
  } catch (error) {
    logger.error('Error marking story as viewed', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/messages/stories/:storyId
// @desc    Delete a story (owner only)
router.delete('/stories/:storyId', auth, async (req, res) => {
  const storyId = req.params.storyId; // UUID, not integer

  try {
    const result = await pool.query(
      `DELETE FROM user_stories WHERE id = $1 AND user_id = $2 RETURNING *`,
      [storyId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story nicht gefunden oder keine Berechtigung' });
    }

    // Delete file from uploads folder
    const story = result.rows[0];
    if (story.media_url && story.media_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', story.media_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Notify via WebSocket
    const io = getIO();
    if (io) {
      io.emit('story:deleted', { storyId });
    }

    res.json({ message: 'Story gelöscht' });
  } catch (error) {
    logger.error('Error deleting story', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/messages/conversations/:conversationId/clear - Clear all messages in a group chat (superadmin only)
router.delete('/conversations/:conversationId/clear', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Only superadmin can clear entire chats
    if (req.user.role !== 'superadmin') {
      logger.warn('Unauthorized chat clear attempt', { userId, conversationId, role: req.user.role });
      return res.status(403).json({ error: 'Nur Superadmin kann Chats vollständig löschen' });
    }

    // Verify conversation exists and is a group chat
    const convResult = await pool.query(
      'SELECT id, name, type FROM message_conversations WHERE id = $1',
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Unterhaltung nicht gefunden' });
    }

    const conversation = convResult.rows[0];

    if (conversation.type !== 'group') {
      return res.status(400).json({ error: 'Nur Gruppenchats können vollständig gelöscht werden' });
    }

    // Delete all messages in the conversation
    const deleteResult = await pool.query(
      'DELETE FROM messages WHERE conversation_id = $1 RETURNING id',
      [conversationId]
    );

    const deletedCount = deleteResult.rowCount;

    logger.info('Chat cleared by superadmin', {
      userId,
      conversationId,
      conversationName: conversation.name,
      deletedMessages: deletedCount
    });

    // Notify all members via WebSocket
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation:cleared', {
        conversationId,
        clearedBy: userId,
        clearedAt: new Date().toISOString(),
        deletedCount
      });
    }

    res.json({
      success: true,
      message: `${deletedCount} Nachrichten gelöscht`,
      conversationId,
      conversationName: conversation.name,
      deletedCount
    });

  } catch (error) {
    logger.error('Error clearing conversation', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Nachrichten' });
  }
});

module.exports = router;
