const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware to ensure user is member of general chat
 * Automatically adds user to general chat if they aren't already a member
 */
const ensureGeneralChatMembership = async (req, res, next) => {
  // Only run for authenticated users
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    const userId = req.user.id;

    // Find general chat
    const generalChatResult = await pool.query(`
      SELECT id, name FROM message_conversations
      WHERE LOWER(name) LIKE '%allgemein%'
         OR LOWER(name) LIKE '%general%'
      ORDER BY created_at ASC
      LIMIT 1
    `);

    // If no general chat exists yet, skip (it will be created later)
    if (generalChatResult.rows.length === 0) {
      return next();
    }

    const generalChatId = generalChatResult.rows[0].id;
    const generalChatName = generalChatResult.rows[0].name;

    // Check if user is already a member
    const membershipResult = await pool.query(`
      SELECT 1 FROM message_conversation_members
      WHERE conversation_id = $1 AND user_id = $2
    `, [generalChatId, userId]);

    // If not a member, add them
    if (membershipResult.rows.length === 0) {
      await pool.query(`
        INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        ON CONFLICT (conversation_id, user_id) DO NOTHING
      `, [generalChatId, userId]);

      logger.info('User auto-added to general chat', {
        userId,
        userName: req.user.name,
        generalChatId,
        generalChatName
      });
    }

    next();
  } catch (error) {
    // Don't fail the request if adding to general chat fails
    logger.warn('Failed to ensure general chat membership', {
      userId: req.user.id,
      error: error.message
    });
    next();
  }
};

module.exports = ensureGeneralChatMembership;
