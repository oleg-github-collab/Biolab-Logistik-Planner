const schedule = require('node-schedule');
const { isBefore } = require('date-fns');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { getAdminUserIds } = require('./kistenService');
const {
  ensureBotUser,
  ensureDisposalCalendarEvent,
  sendBotMessage,
  createNotification,
  buildDisposalReminderMessage
} = require('./entsorgungBot');

const REMINDER_LOOKAHEAD_DAYS = 2;

const fetchDueSchedules = async (client) => {
  const result = await client.query(
    `SELECT
       wds.*,
       wi.name AS waste_name,
       wi.location AS waste_location,
       wi.notification_users,
       wi.notes AS waste_notes,
       wt.name AS template_name,
       wt.category AS template_category,
       wt.hazard_level,
       wt.color,
       wt.icon,
       wt.disposal_frequency_days,
       u.name AS assigned_to_name,
       u.email AS assigned_to_email
     FROM waste_disposal_schedule wds
     LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
     LEFT JOIN waste_templates wt ON wi.template_id = wt.id
     LEFT JOIN users u ON wds.assigned_to = u.id
     WHERE wds.status IN ('scheduled', 'rescheduled')
       AND (wds.last_bot_notification_at IS NULL OR DATE(wds.last_bot_notification_at) < CURRENT_DATE)
       AND wds.scheduled_date <= CURRENT_DATE + INTERVAL '${REMINDER_LOOKAHEAD_DAYS} days'
     ORDER BY wds.scheduled_date ASC`
  );

  return result.rows;
};

const resolveRecipients = async (client, scheduleRow) => {
  const recipients = new Set();

  if (scheduleRow.assigned_to) {
    recipients.add(Number(scheduleRow.assigned_to));
  }

  if (scheduleRow.notification_users) {
    try {
      const parsed = Array.isArray(scheduleRow.notification_users)
        ? scheduleRow.notification_users
        : JSON.parse(scheduleRow.notification_users);
      parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
        .forEach((value) => recipients.add(value));
    } catch (error) {
      logger.warn('Entsorgung reminder: konnte notification_users nicht parsen', {
        scheduleId: scheduleRow.id,
        error: error.message
      });
    }
  }

  const adminIds = await getAdminUserIds(client);
  adminIds.forEach((value) => recipients.add(value));

  return Array.from(recipients);
};

const markScheduleProcessed = async (client, scheduleRow, event) => {
  const newStatus =
    scheduleRow.status === 'scheduled' || scheduleRow.status === 'rescheduled'
      ? isBefore(new Date(scheduleRow.scheduled_date), new Date())
        ? 'overdue'
        : scheduleRow.status
      : scheduleRow.status;

  await client.query(
    `UPDATE waste_disposal_schedule
        SET last_bot_notification_at = CURRENT_TIMESTAMP,
            calendar_event_id = $1,
            status = $2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $3`,
    [event ? event.id : scheduleRow.calendar_event_id, newStatus, scheduleRow.id]
  );
};

const runEntsorgungReminderJob = async ({ triggeredByScheduler = false } = {}) => {
  const client = await pool.connect();
  try {
    const bot = await ensureBotUser();
    const schedules = await fetchDueSchedules(client);

    if (!schedules.length) {
      logger.debug('Entsorgung reminder: keine fälligen Entsorgungen gefunden');
      return;
    }

    for (const scheduleRow of schedules) {
      try {
        const event = await ensureDisposalCalendarEvent(client, scheduleRow, {
          createdBy: scheduleRow.assigned_to || bot.id
        });

        const recipients = await resolveRecipients(client, scheduleRow);
        if (!recipients.length) {
          logger.warn('Entsorgung reminder: keine Empfänger gefunden', { scheduleId: scheduleRow.id });
          await markScheduleProcessed(client, scheduleRow, event);
          continue;
        }

        const message = buildDisposalReminderMessage(scheduleRow, event);

        for (const recipientId of recipients) {
          try {
            await sendBotMessage(client, recipientId, message);
            await createNotification(client, recipientId, {
              title: scheduleRow.waste_name
                ? `Entsorgung: ${scheduleRow.waste_name}`
                : 'Entsorgungs-Erinnerung',
              content: message,
              eventId: event?.id || null,
              type: 'waste',
              metadata: {
                scheduleId: scheduleRow.id,
                wasteItemId: scheduleRow.waste_item_id,
                triggeredByScheduler,
                hazardLevel: scheduleRow.hazard_level
              }
            });
          } catch (notifyError) {
            logger.error('Entsorgung reminder: Benachrichtigung fehlgeschlagen', {
              recipientId,
              scheduleId: scheduleRow.id,
              error: notifyError.message
            });
          }
        }

        await markScheduleProcessed(client, scheduleRow, event);
      } catch (jobError) {
        logger.error('Entsorgung reminder: Verarbeitung fehlgeschlagen', {
          scheduleId: scheduleRow.id,
          error: jobError.message
        });
      }
    }

    logger.info('Entsorgung reminder abgeschlossen', {
      count: schedules.length,
      triggeredByScheduler
    });
  } catch (error) {
    logger.error('Entsorgung reminder fehlgeschlagen', { error: error.message });
  } finally {
    client.release();
  }
};

let entsorgungReminderJob = null;

const scheduleEntsorgungReminders = () => {
  if (entsorgungReminderJob) {
    entsorgungReminderJob.cancel();
  }

  entsorgungReminderJob = schedule.scheduleJob(
    { tz: 'Europe/Berlin', hour: 9, minute: 30 },
    () => {
      runEntsorgungReminderJob({ triggeredByScheduler: true }).catch((error) =>
        logger.error('Entsorgung reminder job execution failed', { error: error.message })
      );
    }
  );

  logger.info('Entsorgung reminder job geplant', { time: '09:30', timezone: 'Europe/Berlin' });
};

module.exports = {
  scheduleEntsorgungReminders,
  runEntsorgungReminderJob
};
