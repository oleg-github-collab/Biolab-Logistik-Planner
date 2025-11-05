const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendBotMessage, createNotification } = require('../services/entsorgungBot');
const {
  createCalendarEvent,
  createKanbanTask,
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
    const createdBins = [];

    for (const code of normalizedCodes) {
      const title = `${titleBase}: ${code}`;
      const tags = ['kistenmanagement', code];

      const event = await createCalendarEvent(client, {
        title,
        description: descriptionBase,
        keepUntil,
        createdBy,
        tags
      });

      const task = await createKanbanTask(client, {
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

      const bin = binResult.rows[0];
      await insertStorageBinAudit(client, bin.id, 'created', { code, keepUntil }, createdBy);
      createdBins.push({ bin, event, task });
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

      for (const recipient of recipients) {
        const message = `Heute wurden neue Kisten zur Überprüfung angelegt (insgesamt ${createdBins.length}). Nächste Prüfung bis ${keepUntil}.`;
        await sendBotMessage(botClient, recipient, message);
        await createNotification(botClient, recipient, {
          title: 'Neue Kistenprüfung angelegt',
          content: `Es wurden ${createdBins.length} Kisten registriert. Prüftermin: ${keepUntil}.`,
          type: 'kisten',
          metadata: {
            keepUntil,
            codes: normalizedCodes
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
