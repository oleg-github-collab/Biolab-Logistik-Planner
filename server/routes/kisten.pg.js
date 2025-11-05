const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendBotMessage, createNotification } = require('../services/entsorgungBot');
const {
  createCalendarEvent,
  createKanbanTask,
  updateCalendarEventDetails,
  updateKanbanTaskDetails,
  insertStorageBinAudit,
  enrichStorageBins,
  getAdminUserIds,
  autoCompleteBinsWithDoneTasks
} = require('../services/kistenService');

const router = express.Router();


router.get('/', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await autoCompleteBinsWithDoneTasks(client);
    const bins = await enrichStorageBins();
    res.json({ bins });
  } catch (error) {
    logger.error('Error fetching storage bins', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/', auth, async (req, res) => {
  const { codes, comment, keepUntil } = req.body || {};

  const normalizedCodes = Array.isArray(codes)
    ? codes
        .map((code) => String(code).trim())
        .filter(Boolean)
    : String(codes || '')
        .split(/\s|,|;|\n/)
        .map((code) => code.trim())
        .filter(Boolean);

  if (!normalizedCodes.length) {
    return res.status(400).json({ error: 'Mindestens ein QR-Code ist erforderlich' });
  }

  if (!keepUntil) {
    return res.status(400).json({ error: 'Mindestens eine Aufbewahrungsfrist ist erforderlich' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const titleBase = 'Kistenprüfung';
    const descriptionBase = comment ? `${comment}` : 'Automatische Erinnerung zur Prüfung der gelagerten Kisten/Container.';
    const createdBy = req.user.id;
    const processedBins = [];

    for (const rawCode of normalizedCodes) {
      const code = rawCode.trim();
      if (!code) continue;

      const title = `${titleBase}: ${code}`;
      const tags = ['kistenmanagement', code];

      const existingResult = await client.query(
        `SELECT *
           FROM storage_bins
          WHERE code = $1
            AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 1`,
        [code]
      );

      let bin;
      let event = null;
      let task = null;
      let action = 'created';

      if (existingResult.rows.length) {
        const existing = existingResult.rows[0];
        action = 'updated';

        const nextEvent =
          (await updateCalendarEventDetails(client, existing.calendar_event_id, {
            title,
            description: descriptionBase,
            keepUntil,
            tags
          })) ||
          (await createCalendarEvent(client, {
            title,
            description: descriptionBase,
            keepUntil,
            createdBy,
            tags
          }));

        event = nextEvent;

        const nextTask =
          (await updateKanbanTaskDetails(client, existing.task_id, {
            title,
            description: `${descriptionBase}\n\nMindestens aufbewahren bis: ${keepUntil}`,
            dueDate: keepUntil,
            tags
          })) ||
          (await createKanbanTask(client, {
            title,
            description: `${descriptionBase}\n\nMindestens aufbewahren bis: ${keepUntil}`,
            dueDate: keepUntil,
            createdBy,
            tags
          }));

        task = nextTask;

        const updateResult = await client.query(
          `UPDATE storage_bins
              SET comment = $1,
                  keep_until = $2,
                  calendar_event_id = $3,
                  task_id = $4,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *`,
          [
            comment || existing.comment || null,
            keepUntil,
            event ? event.id : existing.calendar_event_id,
            task ? task.id : existing.task_id,
            existing.id
          ]
        );

        bin = updateResult.rows[0];
        await insertStorageBinAudit(client, bin.id, 'updated', { code, keepUntil }, createdBy);
      } else {
        event = await createCalendarEvent(client, {
          title,
          description: descriptionBase,
          keepUntil,
          createdBy,
          tags
        });

        task = await createKanbanTask(client, {
          title,
          description: `${descriptionBase}\n\nMindestens aufbewahren bis: ${keepUntil}`,
          dueDate: keepUntil,
          createdBy,
          tags
        });

        const binResult = await client.query(
          `INSERT INTO storage_bins (code, comment, keep_until, status, calendar_event_id, task_id, created_by)
           VALUES ($1, $2, $3, 'pending', $4, $5, $6)
           RETURNING *`,
          [code, comment || null, keepUntil, event.id, task.id, createdBy]
        );

        bin = binResult.rows[0];
        await insertStorageBinAudit(client, bin.id, 'created', { code, keepUntil }, createdBy);
      }

      processedBins.push({ bin, event, task, action, code });
    }

    await client.query('COMMIT');

    const binsResponse = await enrichStorageBins();

    // Notifications and bot messages after commit
    const botClient = await pool.connect();
    try {
      const adminsRes = await botClient.query(
        `SELECT id FROM users WHERE role IN ('admin', 'superadmin') AND is_active = TRUE`
      );
      const adminIds = adminsRes.rows.map((row) => row.id);
      const recipients = Array.from(new Set([createdBy, ...adminIds]));

      const createdCount = processedBins.filter((entry) => entry.action === 'created').length;
      const updatedCount = processedBins.filter((entry) => entry.action === 'updated').length;
      const summaryParts = [];
      if (createdCount > 0) summaryParts.push(`${createdCount} neu registriert`);
      if (updatedCount > 0) summaryParts.push(`${updatedCount} aktualisiert`);
      const summaryText = summaryParts.length ? summaryParts.join(' und ') : 'keine Änderungen';

      const createdCodes = processedBins.filter((entry) => entry.action === 'created').map((entry) => entry.code);
      const updatedCodes = processedBins.filter((entry) => entry.action === 'updated').map((entry) => entry.code);

      const totalCount = processedBins.length;
      const baseMessage = summaryParts.length
        ? `Statusupdate: ${summaryText}.`
        : 'Keine offenen Änderungen.';
      const reminderText = totalCount > 0
        ? ` Gesamtanzahl betroffen: ${totalCount}. Prüftermin: ${keepUntil}.`
        : '';
      for (const recipient of recipients) {
        const message = `${baseMessage}${reminderText}`;
        await sendBotMessage(botClient, recipient, message);
        await createNotification(botClient, recipient, {
          title: 'Kistenmanagement aktualisiert',
          content: `${baseMessage}${reminderText}`,
          type: 'kisten',
          metadata: {
            keepUntil,
            totalCount,
            createdCodes,
            updatedCodes,
            allCodes: normalizedCodes
          }
        });
      }
    } catch (notifyError) {
      logger.error('Failed to send Kisten notifications', { error: notifyError.message });
    } finally {
      botClient.release();
    }

    res.json({ bins: binsResponse });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating storage bins', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/:id/complete', auth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const binResult = await client.query('SELECT * FROM storage_bins WHERE id = $1', [id]);
    if (binResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kiste nicht gefunden' });
    }

    const bin = binResult.rows[0];
    if (bin.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Kiste wurde bereits erledigt' });
    }

    await client.query(
      `UPDATE storage_bins
         SET status = 'completed',
             completed_by = $1,
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user.id, id]
    );

    if (bin.task_id) {
      await client.query(
        `UPDATE tasks SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [bin.task_id]
      );
    }

    if (bin.calendar_event_id) {
      await client.query(
        `UPDATE calendar_events SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [bin.calendar_event_id]
      );
    }

    await insertStorageBinAudit(client, id, 'completed', null, req.user.id);

    await client.query('COMMIT');

    const binsResponse = await enrichStorageBins();

    const botClient = await pool.connect();
    try {
      await sendBotMessage(botClient, req.user.id, `Danke! Die Kiste ${bin.code} wurde als erledigt markiert.`);
    } catch (notifyError) {
      logger.error('Failed to send completion message', { error: notifyError.message });
    } finally {
      botClient.release();
    }

    res.json({ bins: binsResponse });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error completing storage bin', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
