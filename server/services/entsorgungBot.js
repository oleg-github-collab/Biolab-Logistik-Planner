const bcrypt = require('bcryptjs');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { pool } = require('../config/database');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');
const { ensureDirectConversation } = require('./conversationService');

const BOT_NAME = 'EntsorgungBot';
const BOT_EMAIL = 'entsorgungbot@system.local';
const BOT_DEFAULT_PASSWORD = 'EntsorgungBot!123';
const DEFAULT_EVENT_DURATION_MINUTES = 60;

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
    io.to(`user_${userId}`).emit('conversation:new_message', {
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

const toDateSafe = (value) => {
  if (!value && value !== 0) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDateSafe(value);
  if (!date) return null;
  return format(date, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de });
};

const buildDisposalDescription = (schedule) => {
  const {
    waste_name,
    waste_location,
    waste_notes,
    template_name,
    template_category,
    hazard_level,
    disposal_method,
    quantity,
    unit,
    notes
  } = schedule;

  return [
    waste_name ? `Material: ${waste_name}` : null,
    template_name ? `Kategorie: ${template_name}` : null,
    template_category ? `Bereich: ${template_category}` : null,
    hazard_level ? `Gefahrenstufe: ${hazard_level}` : null,
    waste_location ? `Ort: ${waste_location}` : null,
    disposal_method ? `Methode: ${disposal_method}` : null,
    quantity ? `Menge: ${quantity}${unit ? ` ${unit}` : ''}` : null,
    waste_notes || notes ? `Hinweise: ${waste_notes || notes}` : null
  ]
    .filter(Boolean)
    .join('\n');
};

const ensureDisposalCalendarEvent = async (client, schedule, options = {}) => {
  if (!schedule) return null;

  const bot = await ensureBotUser();
  const startTime = toDateSafe(schedule.scheduled_date) || new Date();
  const durationMinutes = options.durationMinutes || DEFAULT_EVENT_DURATION_MINUTES;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const title =
    options.title ||
    `Entsorgung: ${schedule.waste_name || schedule.template_name || 'Material'}`;

  const tags = new Set(['entsorgung', 'waste']);

  if (schedule.id) tags.add(`schedule:${schedule.id}`);
  if (schedule.waste_item_id) tags.add(`waste-item:${schedule.waste_item_id}`);
  if (schedule.template_name) tags.add(`template:${schedule.template_name}`);
  if (schedule.template_category) tags.add(`category:${schedule.template_category}`);
  if (schedule.hazard_level) tags.add(`hazard:${schedule.hazard_level}`);

  const description = buildDisposalDescription(schedule);
  const createdBy = schedule.assigned_to || options.createdBy || bot.id;
  const location = schedule.waste_location || schedule.location || null;

  const startISO = startTime.toISOString();
  const endISO = endTime.toISOString();
  const tagsJson = JSON.stringify(Array.from(tags));
  const notesValue = schedule.notes || schedule.waste_notes || null;

  let event = null;

  if (schedule.calendar_event_id) {
    const update = await client.query(
      `UPDATE calendar_events
          SET title = $1,
              description = $2,
              start_time = $3,
              end_time = $4,
              location = COALESCE($5, location),
              notes = COALESCE($6, notes),
              event_type = 'disposal',
              category = 'logistics',
              status = 'confirmed',
              reminder = 120,
              tags = $7,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *`,
      [title, description, startISO, endISO, location, notesValue, tagsJson, schedule.calendar_event_id]
    );

    if (update.rows.length > 0) {
      event = update.rows[0];
    }
  }

  if (!event) {
    const insert = await client.query(
      `INSERT INTO calendar_events (
         title, description, start_time, end_time, all_day,
         event_type, category, status, reminder, tags,
         created_by, location, notes
       ) VALUES ($1, $2, $3, $4, FALSE, 'disposal', 'logistics', 'confirmed', 120, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, startISO, endISO, tagsJson, createdBy, location, notesValue]
    );
    event = insert.rows[0];
  }

  return event;
};

const buildDisposalReminderMessage = (schedule, event) => {
  const lines = [
    '♻️ Entsorgungs-Erinnerung',
    `• Material: ${schedule.waste_name || schedule.template_name || 'Unbekannt'}`,
    event?.start_time
      ? `• Termin: ${formatDateTime(event.start_time)}`
      : formatDateTime(schedule.scheduled_date)
      ? `• Termin: ${formatDateTime(schedule.scheduled_date)}`
      : null,
    schedule.waste_location ? `• Ort: ${schedule.waste_location}` : null,
    schedule.disposal_method ? `• Methode: ${schedule.disposal_method}` : null,
    schedule.quantity ? `• Menge: ${schedule.quantity}${schedule.unit ? ` ${schedule.unit}` : ''}` : null,
    schedule.hazard_level ? `• Gefahrenstufe: ${schedule.hazard_level}` : null,
    schedule.notes || schedule.waste_notes ? `• Hinweis: ${schedule.notes || schedule.waste_notes}` : null,
    '',
    'Der Termin wurde im Kalender vermerkt. Bitte bestätige die Entsorgung zeitnah im Kisten- oder Abfall-Modul.'
  ];

  return lines.filter(Boolean).join('\n');
};

module.exports = {
  ensureBotUser,
  ensureBotConversation,
  sendBotMessage,
  createNotification,
  ensureDisposalCalendarEvent,
  buildDisposalReminderMessage
};
