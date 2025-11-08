/**
 * Deadline Reminders Service
 * Sends automatic notifications for upcoming and overdue tasks
 */

const { pool } = require('../config/database');
const logger = require('./logger');
const { getIO } = require('../websocket');

/**
 * Check for upcoming deadlines and send reminders
 * Should be run periodically (e.g., every hour via cron)
 */
async function checkDeadlineReminders() {
  try {
    logger.info('Running deadline reminder check...');

    // Get tasks with deadlines in the next 24 hours (not yet reminded)
    const upcomingResult = await pool.query(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date IS NOT NULL
        AND t.status NOT IN ('done', 'cancelled')
        AND t.due_date > CURRENT_TIMESTAMP
        AND t.due_date <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id
            AND n.type = 'task_deadline_upcoming'
            AND n.created_at > CURRENT_TIMESTAMP - INTERVAL '23 hours'
        )
    `);

    // Get overdue tasks (not yet reminded today)
    const overdueResult = await pool.query(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date IS NOT NULL
        AND t.status NOT IN ('done', 'cancelled')
        AND t.due_date < CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id
            AND n.type = 'task_overdue'
            AND n.created_at::date = CURRENT_DATE
        )
    `);

    const io = getIO();
    let upcomingCount = 0;
    let overdueCount = 0;

    // Send reminders for upcoming deadlines
    for (const task of upcomingResult.rows) {
      if (task.assigned_to) {
        const hoursUntil = Math.ceil(
          (new Date(task.due_date) - new Date()) / (1000 * 60 * 60)
        );

        await pool.query(
          `INSERT INTO notifications (
            user_id, type, title, content, priority, task_id, action_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            task.assigned_to,
            'task_deadline_upcoming',
            `Deadline in ${hoursUntil}h`,
            `Die Aufgabe "${task.title}" ist in ${hoursUntil} Stunden fällig`,
            'high',
            task.id,
            '/dashboard'
          ]
        ).then(result => {
          if (io && result.rows[0]) {
            io.to(`user_${task.assigned_to}`).emit('notification:new', result.rows[0]);
          }
        });

        upcomingCount++;
      }
    }

    // Send reminders for overdue tasks
    for (const task of overdueResult.rows) {
      if (task.assigned_to) {
        const daysOverdue = Math.ceil(
          (new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24)
        );

        await pool.query(
          `INSERT INTO notifications (
            user_id, type, title, content, priority, task_id, action_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            task.assigned_to,
            'task_overdue',
            `Aufgabe überfällig`,
            `Die Aufgabe "${task.title}" ist ${daysOverdue} Tag${daysOverdue > 1 ? 'e' : ''} überfällig`,
            'urgent',
            task.id,
            '/dashboard'
          ]
        ).then(result => {
          if (io && result.rows[0]) {
            io.to(`user_${task.assigned_to}`).emit('notification:new', result.rows[0]);
          }
        });

        overdueCount++;
      }
    }

    logger.info(`Deadline reminders sent: ${upcomingCount} upcoming, ${overdueCount} overdue`);

    return {
      upcoming: upcomingCount,
      overdue: overdueCount
    };

  } catch (error) {
    logger.error('Error checking deadline reminders', error);
    throw error;
  }
}

/**
 * Check for calendar event reminders
 * Sends notifications 15 minutes before events (or custom reminder time)
 */
async function checkEventReminders() {
  try {
    logger.info('Running event reminder check...');

    // Get events with upcoming start times within their reminder window
    const result = await pool.query(`
      SELECT ce.*
      FROM calendar_events ce
      WHERE ce.start_time > CURRENT_TIMESTAMP
        AND ce.start_time <= CURRENT_TIMESTAMP + (COALESCE(ce.reminder, 15) * INTERVAL '1 minute')
        AND ce.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.event_id = ce.id
            AND n.type = 'calendar_event'
            AND n.created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        )
    `);

    const io = getIO();
    let reminderCount = 0;

    for (const event of result.rows) {
      const minutesUntil = Math.ceil(
        (new Date(event.start_time) - new Date()) / (1000 * 60)
      );

      // Send to event creator
      if (event.created_by) {
        await pool.query(
          `INSERT INTO notifications (
            user_id, type, title, content, priority, event_id, action_url, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            event.created_by,
            'calendar_event',
            'Terminerinnerung',
            `"${event.title}" beginnt in ${minutesUntil} Minuten`,
            event.priority || 'normal',
            event.id,
            '/dashboard',
            JSON.stringify({ start_time: event.start_time, minutesUntil })
          ]
        ).then(result => {
          if (io && result.rows[0]) {
            io.to(`user_${event.created_by}`).emit('notification:new', result.rows[0]);
          }
        });

        reminderCount++;
      }

      // Send to attendees if any
      if (event.attendees && Array.isArray(event.attendees)) {
        for (const attendeeId of event.attendees) {
          await pool.query(
            `INSERT INTO notifications (
              user_id, type, title, content, priority, event_id, action_url, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              attendeeId,
              'calendar_event',
              'Terminerinnerung',
              `"${event.title}" beginnt in ${minutesUntil} Minuten`,
              event.priority || 'normal',
              event.id,
              '/dashboard',
              JSON.stringify({ start_time: event.start_time, minutesUntil })
            ]
          ).then(result => {
            if (io && result.rows[0]) {
              io.to(`user_${attendeeId}`).emit('notification:new', result.rows[0]);
            }
          });

          reminderCount++;
        }
      }
    }

    logger.info(`Event reminders sent: ${reminderCount}`);

    return { reminders: reminderCount };

  } catch (error) {
    logger.error('Error checking event reminders', error);
    throw error;
  }
}

/**
 * Run all reminder checks
 */
async function runAllReminderChecks() {
  try {
    const deadlineResults = await checkDeadlineReminders();
    const eventResults = await checkEventReminders();

    return {
      deadlines: deadlineResults,
      events: eventResults,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error running reminder checks', error);
    throw error;
  }
}

/**
 * Schedule periodic deadline and event reminder checks
 * Runs every hour by default
 */
function scheduleDeadlineReminders(intervalMinutes = 60) {
  logger.info(`Scheduling deadline reminders to run every ${intervalMinutes} minutes`);

  // Run immediately on startup
  setImmediate(async () => {
    try {
      logger.info('Running initial deadline reminder check...');
      const results = await runAllReminderChecks();
      logger.info('Initial deadline reminder check completed', results);
    } catch (error) {
      logger.error('Initial deadline reminder check failed', error);
    }
  });

  // Schedule recurring checks
  setInterval(async () => {
    try {
      logger.info('Running scheduled deadline reminder check...');
      const results = await runAllReminderChecks();
      logger.info('Scheduled deadline reminder check completed', results);
    } catch (error) {
      logger.error('Scheduled deadline reminder check failed', error);
    }
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  checkDeadlineReminders,
  checkEventReminders,
  runAllReminderChecks,
  scheduleDeadlineReminders
};
