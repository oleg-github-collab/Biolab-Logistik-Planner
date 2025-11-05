const schedule = require('node-schedule');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const {
  getPendingBinsDue,
  getBinsRemindedToday,
  insertStorageBinAudit,
  getAdminUserIds,
  autoCompleteBinsWithDoneTasks
} = require('./kistenService');
const { sendBotMessage, createNotification, ensureBotUser } = require('./entsorgungBot');

const formatDateLabel = (value) => {
  try {
    return new Date(value).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return String(value);
  }
};

const buildReminderMessage = (bins) => {
  if (!Array.isArray(bins) || bins.length === 0) {
    return '';
  }

  const header = 'Heute stehen folgende Kisten/Container zur Prüfung an:';
  const lines = bins
    .map((bin) => {
      const deadline = formatDateLabel(bin.keep_until);
      const comment = bin.comment ? ` – ${bin.comment}` : '';
      return `• ${bin.code} (Frist ${deadline})${comment}`;
    })
    .join('\n');

  const footer = '\nBitte prüfe die Behälter und verschiebe die Kanban-Aufgabe auf „Erledigt“, sobald alles abgeschlossen ist.';
  return `${header}\n${lines}${footer}`;
};

let reminderJob = null;

const runReminderJob = async ({ triggeredByScheduler = false } = {}) => {
  const botUser = await ensureBotUser();

  const client = await pool.connect();
  try {
    await autoCompleteBinsWithDoneTasks(client);

    const pendingBins = await getPendingBinsDue(client);
    if (!pendingBins.length) {
      logger.debug('Kisten reminder: keine fälligen Kisten gefunden');
      return;
    }

    const remindedToday = await getBinsRemindedToday(client);
    const binsToRemind = pendingBins.filter((bin) => !remindedToday.has(bin.id));

    if (!binsToRemind.length) {
      logger.debug('Kisten reminder: alle fälligen Kisten wurden heute bereits erinnert');
      return;
    }

    const adminIds = await getAdminUserIds(client);
    const creatorIds = binsToRemind
      .map((bin) => bin.created_by)
      .filter((id) => !!id);

    const recipients = Array.from(new Set([...adminIds, ...creatorIds]));

    if (!recipients.length) {
      logger.warn('Kisten reminder: keine Empfänger gefunden, Benachrichtigung wird übersprungen');
      return;
    }

    const message = buildReminderMessage(binsToRemind);

    await Promise.all(
      recipients.map(async (recipientId) => {
        try {
          await sendBotMessage(client, recipientId, message);
          await createNotification(client, recipientId, {
            title: 'Kistenprüfung fällig',
            content: message,
            type: 'kisten',
            metadata: {
              binIds: binsToRemind.map((bin) => bin.id),
              codes: binsToRemind.map((bin) => bin.code),
              keepUntil: binsToRemind.map((bin) => bin.keep_until),
              triggeredByScheduler
            }
          });
        } catch (notifyError) {
          logger.error('Kisten reminder: Benachrichtigung fehlgeschlagen', {
            recipientId,
            error: notifyError.message
          });
        }
      })
    );

    await Promise.all(
      binsToRemind.map((bin) =>
        insertStorageBinAudit(
          client,
          bin.id,
          'reminder',
          {
            code: bin.code,
            keepUntil: bin.keep_until,
            triggeredByScheduler
          },
          botUser?.id || null
        )
      )
    );

    logger.info('Kisten reminder versendet', {
      recipients: recipients.length,
      bins: binsToRemind.length,
      triggeredByScheduler
    });
  } catch (error) {
    logger.error('Kisten reminder fehlgeschlagen', { error: error.message });
  } finally {
    client.release();
  }
};

const scheduleKistenReminders = () => {
  if (reminderJob) {
    reminderJob.cancel();
  }

  reminderJob = schedule.scheduleJob(
    { tz: 'Europe/Berlin', hour: 10, minute: 0 },
    () => {
      runReminderJob({ triggeredByScheduler: true }).catch((error) =>
        logger.error('Kisten reminder job execution failed', { error: error.message })
      );
    }
  );

  logger.info('Kisten reminder job geplant', { time: '10:00', timezone: 'Europe/Berlin' });
};

module.exports = {
  scheduleKistenReminders,
  runReminderJob
};
