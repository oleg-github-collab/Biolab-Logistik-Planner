const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');
const { ensureDirectConversation } = require('./conversationService');

const BOT_NAME = 'EntsorgungBot';
const BOT_EMAIL = 'entsorgungbot@system.local';
const BOT_DEFAULT_PASSWORD = 'EntsorgungBot!123';

let cachedBotUser = null;

const ensureBotUser = async () => {
  if (cachedBotUser) return cachedBotUser;

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id, name FROM users WHERE email = $1 LIMIT 1', [BOT_EMAIL]);
    if (existing.rows.length > 0) {
      cachedBotUser = existing.rows[0];
      return cachedBotUser;
    }

    const hashed = await bcrypt.hash(BOT_DEFAULT_PASSWORD, 10);
    const result = await client.query(
      `INSERT INTO users (name, email, password, role, employment_type, weekly_hours_quota, is_active)
       VALUES ($1, $2, $3, 'system', 'Werkstudent', 0, TRUE)
       RETURNING id, name`,
      [BOT_NAME, BOT_EMAIL, hashed]
    );

    cachedBotUser = result.rows[0];
    logger.info('EntsorgungBot user created', { userId: cachedBotUser.id });
    return cachedBotUser;
  } finally {
    client.release();
  }
};

const ensureBotConversation = async (client, userId) => {
  const bot = await ensureBotUser();
  const conversation = await ensureDirectConversation(client, bot.id, userId);
  return { bot, conversation };
};

const sendBotMessage = async (client, userId, message) => {
  if (!message) return null;
  const { bot, conversation } = await ensureBotConversation(client, userId);
  const result = await client.query(
    `INSERT INTO messages (conversation_id, sender_id, receiver_id, message, message_type, is_group, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'text', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [conversation.id, bot.id, userId, message]
  );

  const io = getIO();
  if (io) {
    io.to(`user_${userId}`).emit('message:new', {
      conversationId: conversation.id,
      message: result.rows[0]
    });
  }

  return result.rows[0];
};

const createNotification = async (client, userId, payload = {}) => {
  const { title, content, taskId = null, eventId = null, metadata = {}, type = 'system' } = payload;
  const notification = await client.query(
    `INSERT INTO notifications (user_id, type, title, content, task_id, event_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, type, title, content, taskId, eventId, JSON.stringify(metadata || {})]
  );

  const io = getIO();
  if (io) {
    io.to(`user_${userId}`).emit('notification:new', notification.rows[0]);
  }

  return notification.rows[0];
};

module.exports = {
  ensureBotUser,
  ensureBotConversation,
  sendBotMessage,
  createNotification
};
