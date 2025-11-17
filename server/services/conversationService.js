const { pool } = require('../config/database');
const logger = require('../utils/logger');

const CONVERSATION_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
  TOPIC: 'topic'
};

const MEMBER_ROLES = {
  OWNER: 'owner',
  MODERATOR: 'moderator',
  MEMBER: 'member'
};

const buildDirectKey = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).join(':');

const upsertConversationMember = async (client, conversationId, userId, role = MEMBER_ROLES.MEMBER) => {
  await client.query(
    `INSERT INTO message_conversation_members (conversation_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET role = EXCLUDED.role`,
    [conversationId, userId, role]
  );
};

const ensureDirectConversation = async (client, userId, otherUserId) => {
  const directKey = buildDirectKey(userId, otherUserId);

  const existing = await client.query(
    `SELECT id
       FROM message_conversations
      WHERE conversation_type = $1
        AND settings ->> 'direct_key' = $2
      LIMIT 1`,
    [CONVERSATION_TYPES.DIRECT, directKey]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const conversationResult = await client.query(
    `INSERT INTO message_conversations (name, conversation_type, created_by, settings)
     VALUES ($1, $2, $3, jsonb_build_object('direct_key', $4))
     RETURNING *`,
    [null, CONVERSATION_TYPES.DIRECT, userId, directKey]
  );

  const conversation = conversationResult.rows[0];

  await upsertConversationMember(client, conversation.id, userId, MEMBER_ROLES.OWNER);
  await upsertConversationMember(client, conversation.id, otherUserId, MEMBER_ROLES.MEMBER);

  return conversation;
};

const createConversation = async (client, {
  name,
  description = null,
  type = CONVERSATION_TYPES.GROUP,
  createdBy,
  memberIds = [],
  isTemporary = false,
  expiresAt = null,
  settings = {}
}) => {
  const conversationResult = await client.query(
    `INSERT INTO message_conversations (
       name, description, conversation_type, created_by,
       is_temporary, expires_at, settings
     ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{}'::jsonb))
     RETURNING *`,
    [
      name || null,
      description,
      type,
      createdBy,
      isTemporary,
      expiresAt,
      Object.keys(settings || {}).length ? settings : null
    ]
  );

  const conversation = conversationResult.rows[0];

  const uniqueMembers = Array.from(new Set([createdBy, ...memberIds]));

  await Promise.all(
    uniqueMembers.map((memberId) =>
      upsertConversationMember(
        client,
        conversation.id,
        memberId,
        memberId === createdBy ? MEMBER_ROLES.OWNER : MEMBER_ROLES.MEMBER
      )
    )
  );

  return conversation;
};

const addMembersToConversation = async (client, conversationId, memberIds = [], role = MEMBER_ROLES.MEMBER) => {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return;
  }

  await Promise.all(
    memberIds.map((memberId) => upsertConversationMember(client, conversationId, memberId, role))
  );
};

const removeMemberFromConversation = async (client, conversationId, memberId) => {
  await client.query(
    `DELETE FROM message_conversation_members
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, memberId]
  );
};

const getConversationMembers = async (client, conversationId) => {
  const result = await client.query(
    `SELECT
        m.user_id,
        m.role,
        m.joined_at,
        m.is_muted,
        m.last_read_at,
        u.name,
        u.email,
        u.profile_photo,
        u.role AS user_role
      FROM message_conversation_members m
      LEFT JOIN users u ON m.user_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.role = 'owner' DESC, u.name ASC`,
    [conversationId]
  );

  return result.rows;
};

const fetchConversationById = async (client, conversationId) => {
  const result = await client.query(
    `SELECT * FROM message_conversations WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0] || null;
};

const listUserConversations = async (userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         mc.*,
         my_members.role AS my_role,
         my_members.last_read_at AS my_last_read_at,
         my_members.is_muted AS my_muted,
         COUNT(DISTINCT CASE WHEN other_members.user_id <> $1 THEN other_members.user_id END) AS participant_count,
         json_agg(json_build_object(
             'user_id', other_members.user_id,
             'role', other_members.role,
             'name', member_user.name,
             'profile_photo', member_user.profile_photo
           ))
           FILTER (WHERE other_members.user_id IS NOT NULL AND other_members.user_id <> $1) AS member_snapshot,
         last_message.id AS last_message_id,
         last_message.message AS last_message,
         last_message.message_type AS last_message_type,
         last_message.created_at AS last_message_at,
         last_message.sender_id AS last_message_sender,
         unread.count AS unread_count
       FROM message_conversations mc
       INNER JOIN message_conversation_members my_members
         ON mc.id = my_members.conversation_id AND my_members.user_id = $1
       LEFT JOIN message_conversation_members other_members
         ON mc.id = other_members.conversation_id
       LEFT JOIN users member_user ON other_members.user_id = member_user.id
       LEFT JOIN LATERAL (
         SELECT m.id, m.message, m.message_type, m.created_at, m.sender_id
           FROM messages m
          WHERE m.conversation_id = mc.id
          ORDER BY m.created_at DESC
          LIMIT 1
       ) last_message ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count
           FROM messages m
          WHERE m.conversation_id = mc.id
            AND m.sender_id <> $1
            AND m.created_at > COALESCE(my_members.last_read_at, '1970-01-01'::timestamp)
       ) unread ON TRUE
       GROUP BY mc.id, my_members.role, my_members.last_read_at, my_members.is_muted,
                last_message.id, last_message.message, last_message.message_type,
                last_message.created_at, last_message.sender_id, unread.count
       ORDER BY COALESCE(last_message.created_at, mc.updated_at) DESC NULLS LAST`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to list conversations for user', { userId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  CONVERSATION_TYPES,
  MEMBER_ROLES,
  ensureDirectConversation,
  createConversation,
  addMembersToConversation,
  removeMemberFromConversation,
  getConversationMembers,
  fetchConversationById,
  listUserConversations
};
