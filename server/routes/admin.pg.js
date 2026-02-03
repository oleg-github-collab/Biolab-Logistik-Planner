const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');
const { getIO, getOnlineUsers } = require('../websocket');
const entsorgungBot = require('../services/entsorgungBot');
const blBot = require('../services/blBot');
const createNotification =
  typeof entsorgungBot?.createNotification === 'function'
    ? entsorgungBot.createNotification
    : async () => {
        logger.warn('Broadcast notifications unavailable: createNotification helper missing');
      };
const router = express.Router();

const formatUptime = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || secs) parts.push(`${secs}s`);
  return parts.join(' ');
};

const buildDateWindow = (days) => {
  const parsedDays = Number.isFinite(days) && days > 0 ? days : 7;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - parsedDays);
  return { start, end };
};

const generateTemporaryPassword = () => {
  const raw = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return `${raw.slice(0, 8)}!a1`;
};

// XSS protection helper function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

const ALLOWED_BROADCAST_TYPES = ['info', 'warning', 'success', 'error'];
const BROADCAST_TITLE_PREFIX = 'Nachricht von';
const USER_ROLE_OPTIONS = ['employee', 'admin', 'superadmin', 'observer'];
const BULK_USER_ACTIONS = ['activate', 'deactivate', 'delete', 'updateRole'];

const sanitizeIdList = (ids = []) => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => parseInt(id, 10))
    .filter((value) => Number.isInteger(value) && value > 0);
};

const isValidBroadcastType = (type) =>
  ALLOWED_BROADCAST_TYPES.includes(type);

const buildBroadcastTitle = (adminName) =>
  `${BROADCAST_TITLE_PREFIX} ${adminName || 'Administrations-Team'}`;

const logBroadcastEntry = async ({ adminId, message, severity, recipients, metadata = {} }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO admin_broadcast_logs (admin_id, message, severity, recipients, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [adminId, message, severity, recipients, metadata || {}]
    );
    return result.rows[0];
  } catch (error) {
    logger.warn('Broadcast logging skipped', {
      adminId,
      message,
      severity,
      recipients,
      error: error.message
    });
    return null;
  }
};

const broadcastToAllUsers = async ({ adminId, adminName, message, type, metadata = {} }) => {
  const notificationTitle = buildBroadcastTitle(adminName);
  const sanitizedType = isValidBroadcastType(type) ? type : 'info';
  const client = await pool.connect();
  const recipients = [];

  try {
    const userRows = await client.query(
      'SELECT id FROM users WHERE is_active = TRUE AND id <> $1',
      [adminId]
    );

    for (const { id: userId } of userRows.rows) {
      try {
        await createNotification(client, userId, {
          title: notificationTitle,
          content: message,
          type: 'broadcast',
          metadata: {
            ...metadata,
            category: 'admin',
            severity: sanitizedType
          }
        });
        recipients.push(userId);
      } catch (notifyError) {
        logger.warn('Broadcast notification failed for user', {
          userId,
          error: notifyError.message
        });
      }
    }
  } finally {
    client.release();
  }

  try {
    const io = getIO();
    if (io) {
      io.emit('admin:broadcast', {
        message,
        type: sanitizedType,
        timestamp: new Date().toISOString(),
        from: adminName
      });
    }
  } catch (wsError) {
    logger.warn('WebSocket not available for broadcast', { error: wsError.message });
  }

  const logEntry = await logBroadcastEntry({
    adminId,
    message,
    severity: sanitizedType,
    recipients: recipients.length,
    metadata
  });

  logger.info('Admin broadcast dispatched', {
    adminId,
    type: sanitizedType,
    recipients: recipients.length,
    logId: logEntry?.id,
    metadata
  });

  return { recipients: recipients.length, log: logEntry };
};

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
router.get('/users', [auth, adminAuth], async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, employment_type, auto_schedule,
              default_start_time, default_end_time, weekly_hours_quota,
              first_login_completed, created_at, updated_at
       FROM users
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der Benutzer:', err.message);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Benutzer' });
  }
});

// @route   GET /api/admin/stats
// @desc    Aggregated dashboard metrics
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const [
      totalUsersRes,
      activeUsersRes,
      eventsRes,
      tasksRes,
      wasteItemsRes,
      wasteScheduleRes,
      kbArticlesRes,
      messagesRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM users'),
      pool.query("SELECT COUNT(*) AS active_today FROM users WHERE DATE(last_seen_at) = CURRENT_DATE"),
      pool.query(`
        SELECT COUNT(*) AS events
        FROM calendar_events
        WHERE start_time >= date_trunc('month', CURRENT_DATE)
          AND start_time < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'todo')        AS todo,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE status = 'done')        AS done,
          COUNT(*) FILTER (WHERE status = 'backlog')     AS backlog,
          COUNT(*) FILTER (WHERE status = 'review')      AS review
        FROM tasks
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')  AS active,
          COUNT(*) FILTER (WHERE status = 'disposed') AS disposed
        FROM waste_items
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('scheduled','rescheduled')) AS scheduled
        FROM waste_disposal_schedule
      `),
      pool.query("SELECT COUNT(*) AS articles FROM kb_articles WHERE status = 'published'"),
      pool.query("SELECT COUNT(*) AS messages FROM messages WHERE created_at::date = CURRENT_DATE")
    ]);

    const taskCountsRow = tasksRes.rows[0] || {};
    const wasteItemsRow = wasteItemsRes.rows[0] || {};
    const wasteScheduleRow = wasteScheduleRes.rows[0] || {};

    res.json({
      totalUsers: parseInt(totalUsersRes.rows[0]?.total, 10) || 0,
      activeUsersToday: parseInt(activeUsersRes.rows[0]?.active_today, 10) || 0,
      totalEventsThisMonth: parseInt(eventsRes.rows[0]?.events, 10) || 0,
      totalTasks: {
        todo: parseInt(taskCountsRow.todo, 10) || 0,
        'in-progress': parseInt(taskCountsRow.in_progress, 10) || 0,
        done: parseInt(taskCountsRow.done, 10) || 0,
        backlog: parseInt(taskCountsRow.backlog, 10) || 0,
        review: parseInt(taskCountsRow.review, 10) || 0
      },
      totalWasteItems: {
        pending: parseInt(wasteItemsRow.active, 10) || 0,
        completed: parseInt(wasteItemsRow.disposed, 10) || 0,
        scheduled: parseInt(wasteScheduleRow.scheduled, 10) || 0
      },
      totalKbArticles: parseInt(kbArticlesRes.rows[0]?.articles, 10) || 0,
      totalMessagesToday: parseInt(messagesRes.rows[0]?.messages, 10) || 0
    });
  } catch (error) {
    logger.error('Error building admin stats', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Laden der Statistiken' });
  }
});

// @route   GET /api/admin/system-health
// @desc    Provide realtime system diagnostics
router.get('/system-health', [auth, adminAuth], async (req, res) => {
  const health = {
    database: 'healthy',
    dbLatencyMs: null,
    server: 'online',
    uptime: formatUptime(process.uptime()),
    activeConnections: 0,
    recentErrors: []
  };

  try {
    const started = Date.now();
    await pool.query('SELECT NOW()');
    health.dbLatencyMs = Date.now() - started;
  } catch (error) {
    health.database = 'error';
    health.recentErrors.push({
      message: `Datenbankfehler: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const io = getIO();
    if (io?.engine) {
      health.activeConnections = io.engine.clientsCount;
    } else {
      const list = getOnlineUsers();
      health.activeConnections = Array.isArray(list) ? list.length : 0;
    }
  } catch (error) {
    logger.warn('Unable to determine active socket connections', { error: error.message });
  }

  try {
    const recentAudit = await auditLogger.query({ limit: 50 });
    const critical = recentAudit
      .filter((entry) => ['high', 'critical'].includes(entry.severity))
      .slice(-5)
      .map((entry) => ({
        message: `${entry.category}: ${entry.action}`,
        timestamp: entry.timestamp
      }));
    health.recentErrors.push(...critical);
  } catch (error) {
    logger.warn('Unable to read audit log for system health', { error: error.message });
  }

  res.json(health);
});

// @route   GET /api/admin/activity
// @desc    Recent operational activity feed
router.get('/activity', [auth, adminAuth], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        al.id,
        al.task_id,
        al.action_type,
        al.metadata,
        al.created_at,
        t.title AS task_title,
        u.name  AS actor_name
      FROM task_activity_log al
      LEFT JOIN tasks t ON al.task_id = t.id
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 25
    `);

    const feed = result.rows.map((row) => ({
      id: row.id,
      type: 'task',
      title: row.task_title || `Aufgabe #${row.task_id}`,
      action: row.action_type,
      actor: row.actor_name || 'System',
      metadata: row.metadata,
      timestamp: row.created_at
    }));

    res.json({ activities: feed });
  } catch (error) {
    if (error.code === '42P01') {
      logger.warn('task_activity_log table missing, returning empty activity feed');
      return res.json({ activities: [] });
    }
    logger.error('Error loading activity feed', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Laden des Aktivitätsprotokolls' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin only)
router.put('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota } = req.body;

  try {
    // 1. Check if user exists
    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];

    // Prevent admins from modifying superadmin accounts
    if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nur Superadmins können Superadmin-Konten ändern' });
    }

    // 2. Check for email conflicts if email is being updated
    if (email) {
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const emailCheckResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [sanitizedEmail, id]
      );

      if (emailCheckResult.rows.length > 0) {
        return res.status(400).json({ error: 'E-Mail wird bereits von einem anderen Benutzer verwendet' });
      }
    }

    // 3. Check for name conflicts if name is being updated
    if (name) {
      const sanitizedName = sanitizeInput(name);
      const nameCheckResult = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND id != $2',
        [sanitizedName, id]
      );

      if (nameCheckResult.rows.length > 0) {
        return res.status(400).json({ error: 'Benutzername wird bereits von einem anderen Benutzer verwendet' });
      }
    }

    // 4. Build the update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (name) {
      const sanitizedName = sanitizeInput(name);
      if (!sanitizedName || sanitizedName.length < 2) {
        return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein' });
      }
      if (sanitizedName.length > 255) {
        return res.status(400).json({ error: 'Name darf maximal 255 Zeichen lang sein' });
      }
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(sanitizedName);
      paramIndex++;
    }

    if (email) {
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitizedEmail)) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
      }
      if (sanitizedEmail.length > 255) {
        return res.status(400).json({ error: 'E-Mail darf maximal 255 Zeichen lang sein' });
      }
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(sanitizedEmail);
      paramIndex++;
    }

    if (role) {
      const allowedRoles = ['employee', 'admin', 'superadmin', 'observer'];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle angegeben' });
      }

      if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Nur Superadmins können die Superadmin-Rolle zuweisen' });
      }

      if (user.role === 'superadmin' && role !== 'superadmin') {
        const superAdminCountResult = await pool.query(
          "SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'"
        );
        if (parseInt(superAdminCountResult.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Der letzte Superadmin kann nicht entfernt werden' });
        }
      }

      updateFields.push(`role = $${paramIndex}`);
      updateValues.push(role);
      paramIndex++;
    }

    if (employment_type) {
      const allowedTypes = ['Vollzeit', 'Werkstudent'];
      if (!allowedTypes.includes(employment_type)) {
        return res.status(400).json({ error: 'Ungültiger Beschäftigungstyp angegeben' });
      }
      updateFields.push(`employment_type = $${paramIndex}`);
      updateValues.push(employment_type);
      paramIndex++;

      // Auto-set auto_schedule based on employment_type
      updateFields.push(`auto_schedule = $${paramIndex}`);
      updateValues.push(employment_type === 'Vollzeit');
      paramIndex++;
    }

    if (auto_schedule !== undefined) {
      updateFields.push(`auto_schedule = $${paramIndex}`);
      updateValues.push(Boolean(auto_schedule));
      paramIndex++;
    }

    if (default_start_time) {
      // Validate and normalize time format (HH:MM or H:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const match = default_start_time.match(timeRegex);
      if (!match) {
        return res.status(400).json({ error: 'Ungültiges Zeitformat für Startzeit (erwartet HH:MM)' });
      }
      // Normalize to HH:MM format
      const normalizedTime = `${match[1].padStart(2, '0')}:${match[2]}`;
      updateFields.push(`default_start_time = $${paramIndex}`);
      updateValues.push(normalizedTime);
      paramIndex++;
    }

    if (default_end_time) {
      // Validate and normalize time format (HH:MM or H:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const match = default_end_time.match(timeRegex);
      if (!match) {
        return res.status(400).json({ error: 'Ungültiges Zeitformat für Endzeit (erwartet HH:MM)' });
      }
      // Normalize to HH:MM format
      const normalizedTime = `${match[1].padStart(2, '0')}:${match[2]}`;
      updateFields.push(`default_end_time = $${paramIndex}`);
      updateValues.push(normalizedTime);
      paramIndex++;
    }

    if (weekly_hours_quota !== undefined) {
      const hours = parseInt(weekly_hours_quota, 10);
      if (isNaN(hours) || hours < 0 || hours > 168) {
        return res.status(400).json({ error: 'Wochenstunden müssen zwischen 0 und 168 liegen' });
      }
      updateFields.push(`weekly_hours_quota = $${paramIndex}`);
      updateValues.push(hours);
      paramIndex++;
    }

    // 5. Hash password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
      }
      if (password.length > 255) {
        return res.status(400).json({ error: 'Passwort darf maximal 255 Zeichen lang sein' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = $${paramIndex}`);
      updateValues.push(hashedPassword);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine zu aktualisierenden Felder angegeben' });
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // 6. Build and execute the final update query
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota, created_at, updated_at`;
    updateValues.push(id);

    const updateResult = await pool.query(query, updateValues);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer konnte nicht aktualisiert werden' });
    }

    res.json({
      message: 'Benutzer erfolgreich aktualisiert',
      user: updateResult.rows[0]
    });

  } catch (err) {
    console.error('Fehler beim Aktualisieren des Benutzers:', err.message);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Benutzers' });
  }
});

// @route   POST /api/admin/users
// @desc    Create new user (admin only)
router.post('/users', [auth, adminAuth], async (req, res) => {
  const { name, email, password, role = 'employee', employment_type = 'Werkstudent', default_start_time = '08:00', default_end_time = '17:00', weekly_hours_quota = 20 } = req.body;

  try {
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name та E-Mail є обов\'язковими' });
    }

    // Sanitize and validate name
    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein' });
    }
    if (sanitizedName.length > 255) {
      return res.status(400).json({ error: 'Name darf maximal 255 Zeichen lang sein' });
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }
    if (sanitizedEmail.length > 255) {
      return res.status(400).json({ error: 'E-Mail darf maximal 255 Zeichen lang sein' });
    }

    // Generate temporary password if not provided
    const temporaryPassword = password || generateTemporaryPassword();
    if (temporaryPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }
    if (temporaryPassword.length > 255) {
      return res.status(400).json({ error: 'Passwort darf maximal 255 Zeichen lang sein' });
    }

    // Validate employment type
    const allowedTypes = ['Vollzeit', 'Werkstudent'];
    if (!allowedTypes.includes(employment_type)) {
      return res.status(400).json({ error: 'Ungültiger Beschäftigungstyp. Muss Vollzeit oder Werkstudent sein' });
    }

    // Validate role
    const allowedRoles = ['employee', 'admin', 'superadmin', 'observer'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle angegeben' });
    }

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nur Superadmins können Superadmin-Konten erstellen' });
    }

    // Validate and normalize time formats
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const startMatch = default_start_time.match(timeRegex);
    const endMatch = default_end_time.match(timeRegex);

    if (!startMatch) {
      return res.status(400).json({ error: 'Ungültiges Zeitformat für Startzeit (erwartet HH:MM)' });
    }
    if (!endMatch) {
      return res.status(400).json({ error: 'Ungültiges Zeitformat für Endzeit (erwartet HH:MM)' });
    }

    // Normalize to HH:MM format
    const normalizedStartTime = `${startMatch[1].padStart(2, '0')}:${startMatch[2]}`;
    const normalizedEndTime = `${endMatch[1].padStart(2, '0')}:${endMatch[2]}`;

    // Validate weekly hours
    const validWeeklyHours = parseInt(weekly_hours_quota, 10);
    if (isNaN(validWeeklyHours) || validWeeklyHours < 0 || validWeeklyHours > 168) {
      return res.status(400).json({ error: 'Wochenstunden müssen zwischen 0 und 168 liegen' });
    }

    // Check if email already exists
    const existingEmailResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    if (existingEmailResult.rows.length > 0) {
      return res.status(400).json({ error: 'E-Mail wird bereits verwendet' });
    }

    // Check if name already exists
    const existingNameResult = await pool.query(
      'SELECT id FROM users WHERE name = $1',
      [sanitizedName]
    );
    if (existingNameResult.rows.length > 0) {
      return res.status(400).json({ error: 'Benutzername wird bereits verwendet' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Set auto_schedule based on employment_type
    const auto_schedule = employment_type === 'Vollzeit';

    // Create user with first_login_completed = false to force password change
    const insertResult = await pool.query(
      `INSERT INTO users (name, email, password, role, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota, first_login_completed, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, TRUE, NOW(), NOW())
       RETURNING id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota, first_login_completed, is_active, created_at, updated_at`,
      [sanitizedName, sanitizedEmail, hashedPassword, role, employment_type, auto_schedule, normalizedStartTime, normalizedEndTime, validWeeklyHours]
    );

    const newUser = insertResult.rows[0];

    // Add user to general chat automatically
    try {
      const generalChatResult = await pool.query(`
        SELECT id FROM message_conversations
        WHERE LOWER(name) LIKE '%allgemein%'
           OR LOWER(name) LIKE '%general%'
        LIMIT 1
      `);

      if (generalChatResult.rows.length > 0) {
        const generalChatId = generalChatResult.rows[0].id;
        await pool.query(`
          INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
          VALUES ($1, $2, 'member', NOW())
          ON CONFLICT (conversation_id, user_id) DO NOTHING
        `, [generalChatId, newUser.id]);

        logger.info('User automatically added to general chat', {
          userId: newUser.id,
          userName: newUser.name,
          generalChatId
        });
      }
    } catch (chatError) {
      // Don't fail user creation if adding to chat fails
      logger.warn('Failed to add user to general chat', {
        userId: newUser.id,
        error: chatError.message
      });
    }

    // Send welcome onboarding message from BL_Bot (non-blocking)
    try {
      if (!blBot.initialized || !blBot.botUser) {
        await blBot.initialize();
      }
      if (blBot.initialized && blBot.botUser) {
        await blBot.sendWelcomeMessage(newUser);
      }
    } catch (botError) {
      logger.warn('Failed to send BL_Bot welcome message', {
        userId: newUser.id,
        error: botError.message
      });
    }

    // Broadcast new user to all connected clients via WebSocket
    const { getIO } = require('../websocket');
    const io = getIO();
    if (io) {
      io.emit('user:created', {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      });
    }

    res.status(201).json({
      message: 'Benutzer erfolgreich erstellt',
      user: newUser,
      temporaryPassword: password ? undefined : temporaryPassword // Only return temp password if it was auto-generated
    });
  } catch (err) {
    console.error('Fehler beim Erstellen des Benutzers:', err.message);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Benutzers' });
  }
});

// @route   POST /api/admin/users/bulk
// @desc    Bulk operations on users
router.post('/users/bulk', [auth, adminAuth], async (req, res) => {
  const { action, userIds, payload = {} } = req.body;
  const ids = sanitizeIdList(userIds);

  if (!action || !BULK_USER_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Ungültige Bulk-Aktion' });
  }

  if (!ids.length) {
    return res.status(400).json({ error: 'Keine Benutzer ausgewählt' });
  }

  try {
    let result;

    switch (action) {
      case 'activate':
        result = await pool.query(
          `UPDATE users SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1) RETURNING id`,
          [ids]
        );
        break;
      case 'deactivate':
        result = await pool.query(
          `UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1) RETURNING id`,
          [ids]
        );
        break;
      case 'delete': {
        const filtered = ids.filter((id) => id !== req.user.id);
        if (!filtered.length) {
          return res.status(400).json({ error: 'Konnte nicht alle ausgewählten Benutzer löschen' });
        }
        result = await pool.query(
          `DELETE FROM users WHERE id = ANY($1) RETURNING id`,
          [filtered]
        );
        break;
      }
      case 'updateRole': {
        const { role } = payload;
        if (!role || !USER_ROLE_OPTIONS.includes(role)) {
          return res.status(400).json({ error: 'Ungültige Rolle für die Massenbearbeitung' });
        }
        if (role === 'superadmin' && req.user.role !== 'superadmin') {
          return res.status(403).json({ error: 'Nur Superadmins dürfen diese Rolle vergeben' });
        }
        result = await pool.query(
          `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2) RETURNING id`,
          [role, ids]
        );
        break;
      }
      default:
        return res.status(400).json({ error: 'Bulk-Aktion nicht unterstützt' });
    }

    res.json({
      success: true,
      action,
      affected: result.rowCount
    });
  } catch (error) {
    logger.error('Error executing bulk user action', { action, ids, error: error.message });
    res.status(500).json({ error: 'Bulk-Aktion fehlgeschlagen' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
router.delete('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
  }

  // Prevent deleting the current admin user
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht löschen' });
  }

  const cleanupUserReferences = async (client, targetUserId) => {
    const fkRows = await client.query(
      `
        SELECT
          tc.table_schema,
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.table_schema = 'public'
      `
    );

    const handled = new Set();
    for (const row of fkRows.rows) {
      const schema = row.table_schema || 'public';
      const table = row.table_name;
      const column = row.column_name;

      if (!table || !column || table === 'users') continue;

      const key = `${schema}.${table}.${column}`;
      if (handled.has(key)) continue;
      handled.add(key);

      const nullableResult = await client.query(
        `
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
            AND column_name = $3
          LIMIT 1
        `,
        [schema, table, column]
      );

      if (nullableResult.rows.length === 0) continue;

      const isNullable = nullableResult.rows[0].is_nullable === 'YES';
      const safeSchema = schema.replace(/"/g, '""');
      const safeTable = table.replace(/"/g, '""');
      const safeColumn = column.replace(/"/g, '""');
      const qualifiedTable = `"${safeSchema}"."${safeTable}"`;
      const qualifiedColumn = `"${safeColumn}"`;

      try {
        if (isNullable) {
          await client.query(
            `UPDATE ${qualifiedTable} SET ${qualifiedColumn} = NULL WHERE ${qualifiedColumn} = $1`,
            [targetUserId]
          );
        } else {
          await client.query(
            `DELETE FROM ${qualifiedTable} WHERE ${qualifiedColumn} = $1`,
            [targetUserId]
          );
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup user reference', {
          table: `${schema}.${table}`,
          column,
          userId: targetUserId,
          error: cleanupError.message
        });
        throw cleanupError;
      }
    }
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];

    if (user.role === 'superadmin') {
      if (req.user.role !== 'superadmin') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Nur Superadmins können Superadmin-Konten löschen' });
      }

      const superAdminCountResult = await client.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'"
      );
      if (parseInt(superAdminCountResult.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Der letzte Superadmin kann nicht gelöscht werden' });
      }
    }

    const deleteUserRecord = () =>
      client.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info('Attempting to delete user', { userId, userName: user.name });

    try {
      // Attempt direct delete first (preferred when FKs are configured with ON DELETE)
      await deleteUserRecord();
      logger.info('User deleted successfully without cleanup', { userId });
    } catch (deleteError) {
      // Foreign key violation -> cleanup and retry
      if (deleteError.code === '23503') {
        logger.warn('FK violation detected, running cleanup', {
          userId,
          constraint: deleteError.constraint,
          detail: deleteError.detail
        });
        await cleanupUserReferences(client, userId);
        logger.info('Cleanup complete, retrying delete', { userId });
        await deleteUserRecord();
        logger.info('User deleted successfully after cleanup', { userId });
      } else {
        logger.error('Non-FK error during delete', {
          userId,
          code: deleteError.code,
          message: deleteError.message
        });
        throw deleteError;
      }
    }

    await client.query('COMMIT');

    res.json({
      message: `Benutzer ${user.name} erfolgreich gelöscht`,
      deletedId: userId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Fehler beim Löschen des Benutzers', {
      userId,
      error: err.message,
      detail: err.detail,
      constraint: err.constraint,
      code: err.code,
      table: err.table,
      column: err.column,
      stack: err.stack
    });

    // Return detailed error for debugging
    const errorDetails = {
      error: 'Serverfehler beim Löschen des Benutzers',
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail
    };

    logger.error('DELETE USER ERROR DETAILS:', errorDetails);
    res.status(500).json(errorDetails);
  } finally {
    client.release();
  }
});

// @route   POST /api/admin/users/:id/force-delete
// @desc    Force delete user by fixing FK constraints first (superadmin only)
router.post('/users/:id/force-delete', [auth, adminAuth], async (req, res) => {
  const userId = parseInt(req.params.id);

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Nur Superadmins können diese Funktion verwenden' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    logger.info('Force delete started', { userId, requestedBy: req.user.id });

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];

    // Prevent deletion of last superadmin
    if (user.role === 'superadmin') {
      const superAdminCountResult = await client.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'"
      );
      if (parseInt(superAdminCountResult.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Der letzte Superadmin kann nicht gelöscht werden' });
      }
    }

    // Step 1: Fix all FK constraints to allow deletion
    // Each pair in separate savepoint to avoid transaction abort cascade
    logger.info('Fixing FK constraints for user tables', { userId });

    const fkFixPairs = [
      // SET NULL for audit fields
      ['kb_article_versions', 'created_by', 'SET NULL'],
      ['kb_articles', 'created_by', 'SET NULL'],
      ['kb_articles', 'updated_by', 'SET NULL'],
      ['messages', 'user_id', 'SET NULL'],
      ['kanban_tasks', 'created_by', 'SET NULL'],
      ['kanban_tasks', 'assigned_to', 'SET NULL'],
      // CASCADE for user-owned data
      ['calendar_events', 'created_by', 'CASCADE'],
      ['stories', 'user_id', 'CASCADE'],
      ['time_entries', 'user_id', 'CASCADE'],
      ['chat_members', 'user_id', 'CASCADE'],
      ['message_reads', 'user_id', 'CASCADE'],
      ['notifications', 'user_id', 'CASCADE'],
      ['task_assignments', 'user_id', 'CASCADE']
    ];

    for (const [table, column, deleteRule] of fkFixPairs) {
      const constraintName = `${table}_${column}_fkey`;
      const savepointName = `fix_${table}_${column}`.replace(/[^a-zA-Z0-9_]/g, '_');

      try {
        // Each FK fix in its own savepoint to isolate errors
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(`ALTER TABLE IF EXISTS ${table} DROP CONSTRAINT IF EXISTS ${constraintName}`);
        await client.query(`ALTER TABLE IF EXISTS ${table} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE ${deleteRule}`);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        logger.info('FK constraint fixed', { table, column, deleteRule });
      } catch (fkError) {
        // Rollback this savepoint but continue with others
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch (rollbackErr) {
          // Savepoint might not exist if error happened before creation
        }
        logger.warn('FK fix failed (table/constraint might not exist)', {
          table,
          column,
          error: fkError.message,
          code: fkError.code
        });
      }
    }

    logger.info('FK constraints fixed, now deleting user', { userId });

    // Step 2: Delete the user (FKs should now handle cleanup automatically)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    logger.info('User force-deleted successfully', { userId, userName: user.name });

    res.json({
      message: `Benutzer ${user.name} erfolgreich gelöscht (force delete)`,
      deletedId: userId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Force delete failed', {
      userId,
      error: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      stack: err.stack
    });

    res.status(500).json({
      error: 'Fehler beim Force-Delete',
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail
    });
  } finally {
    client.release();
  }
});

// @route   POST /api/admin/users/:id/activate
// @desc    Activate user (admin only)
router.post('/users/:id/activate', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING id, name, email, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    logger.info('User activated', { userId: id, adminId: req.user.id });
    res.json({ message: 'Benutzer aktiviert', user: result.rows[0] });
  } catch (err) {
    logger.error('Error activating user:', err);
    res.status(500).json({ error: 'Serverfehler beim Aktivieren des Benutzers' });
  }
});

// @route   POST /api/admin/users/:id/deactivate
// @desc    Deactivate user (admin only)
router.post('/users/:id/deactivate', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;

  // Prevent deactivating the current admin user
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht deaktivieren' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, name, email, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    logger.info('User deactivated', { userId: id, adminId: req.user.id });
    res.json({ message: 'Benutzer deaktiviert', user: result.rows[0] });
  } catch (err) {
    logger.error('Error deactivating user:', err);
    res.status(500).json({ error: 'Serverfehler beim Deaktivieren des Benutzers' });
  }
});

// @route   POST /api/admin/users/:id/reset-password
// @desc    Generate a temporary password for a user
router.post('/users/:id/reset-password', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT id, role, email FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const targetUser = userResult.rows[0];

    if (targetUser.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nur Superadmins können Superadmin-Konten zurücksetzen' });
    }

    const newPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, id]
    );

    auditLogger.logSecurity('password_reset', req.user.id, {
      targetUserId: id,
      targetEmail: targetUser.email
    });

    res.json({
      message: 'Passwort erfolgreich zurückgesetzt',
      newPassword
    });
  } catch (error) {
    logger.error('Error resetting user password', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Zurücksetzen des Passworts' });
  }
});

// @route   GET /api/admin/export/:type
// @desc    Export core datasets as JSON download
router.get('/export/:type', [auth, adminAuth], async (req, res) => {
  const { type } = req.params;

  const queries = {
    users: `
      SELECT id, name, email, role, employment_type, weekly_hours_quota, created_at, updated_at
      FROM users
      ORDER BY name
    `,
    events: `
      SELECT id, title, start_time, end_time, event_type, status, priority, created_by
      FROM calendar_events
      ORDER BY start_time DESC
      LIMIT 500
    `,
    tasks: `
      SELECT id, title, status, priority, assigned_to, due_date, category, created_by, created_at, updated_at
      FROM tasks
      ORDER BY updated_at DESC
    `,
    waste: `
      SELECT id, name, status, location, quantity, unit, next_disposal_date, template_id, created_at, updated_at
      FROM waste_items
      ORDER BY created_at DESC
    `,
    'kb-articles': `
      SELECT id, title, status, category_id, tags, author_id, created_at, updated_at
      FROM kb_articles
      ORDER BY created_at DESC
    `
  };

  if (!queries[type]) {
    return res.status(400).json({ error: 'Unbekannter Export-Typ' });
  }

  try {
    const result = await pool.query(queries[type]);
    const payload = JSON.stringify(result.rows, null, 2);
    const filename = `${type}-export-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(payload);
  } catch (error) {
    logger.error('Error exporting admin data', { type, error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Exportieren der Daten' });
  }
});

const handleAuditStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const stats = await auditLogger.getStatistics(days);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting audit stats', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Audit-Statistiken' });
  }
};

router.get('/audit/stats', [auth, adminAuth], handleAuditStats);

const handleAuditLogs = async (req, res) => {
  const {
    category,
    severity,
    action,
    userId,
    resource,
    start_date,
    end_date,
    days,
    limit = 100
  } = req.query;

  try {
    const window = buildDateWindow(parseInt(days, 10) || 7);
    const fetchLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 200), 1000);
    const logs = await auditLogger.query({
      startDate: start_date || window.start.toISOString(),
      endDate: end_date || window.end.toISOString(),
      category: category && category !== 'all' ? category : undefined,
      action: action || undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      limit: fetchLimit
    });

    const filtered = logs
      .filter((entry) => {
        if (resource && entry.resource !== resource) return false;
        if (severity && severity !== 'all' && entry.severity !== severity) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit, 10) || 100);

    res.json({ logs: filtered });
  } catch (error) {
    logger.error('Error getting audit logs', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Audit-Logs' });
  }
};

router.get('/audit/logs', [auth, adminAuth], handleAuditLogs);

const handleAuditExport = async (req, res) => {
  try {
    const { format = 'json', category, start_date, end_date, days } = req.query;
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Ungültiges Export-Format' });
    }

    const window = buildDateWindow(parseInt(days, 10) || 30);
    const payload = await auditLogger.export({
      startDate: start_date || window.start.toISOString(),
      endDate: end_date || window.end.toISOString(),
      category: category && category !== 'all' ? category : undefined
    }, format);

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.send(payload);
  } catch (error) {
    logger.error('Error exporting audit logs', { error: error.message });
    res.status(500).json({ error: 'Serverfehler beim Exportieren der Audit-Logs' });
  }
};

router.get('/audit/export', [auth, adminAuth], handleAuditExport);

// @route   GET /api/admin/users/online
// @desc    Get list of online users (admin only)
router.get('/users/online', [auth, adminAuth], async (req, res) => {
  try {
    let onlineUsers = [];

    // Check if WebSocket is initialized
    try {
      const onlineUserIds = getOnlineUsers();
      onlineUsers = Array.isArray(onlineUserIds) ? onlineUserIds : [];
    } catch (wsError) {
      console.warn('WebSocket not initialized yet:', wsError.message);
      // Return empty array if WebSocket not ready
      return res.json({ users: [] });
    }

    const usersWithDetails = [];

    for (const userId of onlineUsers) {
      const userResult = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        usersWithDetails.push(userResult.rows[0]);
      }
    }

    res.json({ users: usersWithDetails });
  } catch (err) {
    console.error('Fehler beim Abrufen der Online-Benutzer:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Online-Benutzer' });
  }
});

// @route   POST /api/admin/broadcast
// @desc    Broadcast message to all users (admin only)
router.post('/broadcast', [auth, adminAuth], async (req, res) => {
  try {
    const { message, type = 'info' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nachricht ist erforderlich' });
    }

    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
      return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
    }

    if (sanitizedMessage.length > 5000) {
      return res.status(400).json({ error: 'Nachricht darf maximal 5000 Zeichen lang sein' });
    }

    const broadcastType = isValidBroadcastType(type) ? type : 'info';
    const dispatchResult = await broadcastToAllUsers({
      adminId: req.user.id,
      adminName: req.user.name,
      message: sanitizedMessage,
      type: broadcastType,
      metadata: { source: 'admin_panel' }
    });

    res.json({
      message: 'Broadcast erfolgreich gesendet',
      recipients: dispatchResult.recipients,
      log: dispatchResult.log
    });
  } catch (err) {
    logger.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Serverfehler beim Senden der Broadcast-Nachricht' });
  }
});

// @route   GET /api/admin/broadcasts
// @desc    List recent broadcast history (admin only)
router.get('/broadcasts', [auth, adminAuth], async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const severity = isValidBroadcastType(req.query.severity) ? req.query.severity : null;

    const params = severity ? [limit, offset, severity] : [limit, offset];
    const severityClause = severity ? 'WHERE bl.severity = $3' : '';

    const result = await pool.query(
      `
        SELECT
          bl.*,
          u.name as admin_name
        FROM admin_broadcast_logs bl
        LEFT JOIN users u ON u.id = bl.admin_id
        ${severityClause}
        ORDER BY bl.created_at DESC
        LIMIT $1
        OFFSET $2
      `,
      params
    );

    res.json({ broadcasts: result.rows });
  } catch (error) {
    logger.error('Error fetching broadcast history', { error: error.message });
    res.status(500).json({ error: 'Broadcast-Verlauf konnte nicht geladen werden' });
  }
});

// @route   POST /api/admin/broadcasts/:id/resend
// @desc    Resend a saved broadcast
router.post('/broadcasts/:id/resend', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    const historyResult = await pool.query('SELECT * FROM admin_broadcast_logs WHERE id = $1', [id]);
    if (historyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast nicht gefunden' });
    }

    const logEntry = historyResult.rows[0];
    const sanitizedMessage = sanitizeInput(logEntry.message);
    if (!sanitizedMessage) {
      return res.status(400).json({ error: 'Keine gültige Nachricht zum erneuten Senden gefunden' });
    }

    const broadcastType = isValidBroadcastType(logEntry.severity) ? logEntry.severity : 'info';
    const dispatchResult = await broadcastToAllUsers({
      adminId: req.user.id,
      adminName: req.user.name,
      message: sanitizedMessage,
      type: broadcastType,
      metadata: {
        source: 'broadcast_resend',
        original_log_id: logEntry.id
      }
    });

    res.json({
      message: 'Broadcast erneut gesendet',
      recipients: dispatchResult.recipients,
      log: dispatchResult.log,
      resentFrom: logEntry.id
    });
  } catch (error) {
    logger.error('Error resending broadcast', { error: error.message, broadcastId: req.params.id });
    res.status(500).json({ error: 'Broadcast konnte nicht erneut gesendet werden' });
  }
});

// ==================== AUDIT LOG ====================

router.get('/audit-log', [auth, adminAuth], handleAuditLogs);
router.get('/audit-log/stats', [auth, adminAuth], handleAuditStats);
router.get('/audit-log/export', [auth, adminAuth], handleAuditExport);

// @route   POST /api/admin/fix-general-chat
// @desc    Add all active users to general chat (superadmin only)
router.post('/fix-general-chat', [auth, adminAuth], async (req, res) => {
  try {
    // Only superadmin can run this
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nur Superadmin kann diese Operation ausführen' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find general chat
      const generalChatResult = await client.query(`
        SELECT id FROM message_conversations
        WHERE LOWER(name) LIKE '%allgemein%'
           OR LOWER(name) LIKE '%general%'
        LIMIT 1
      `);

      if (generalChatResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Allgemeiner Chat nicht gefunden' });
      }

      const generalChatId = generalChatResult.rows[0].id;

      // Get all active users not in general chat
      const usersToAddResult = await client.query(`
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE u.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM message_conversation_members mcm
              WHERE mcm.conversation_id = $1
                AND mcm.user_id = u.id
          )
      `, [generalChatId]);

      const addedUsers = [];
      for (const user of usersToAddResult.rows) {
        await client.query(`
          INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
          VALUES ($1, $2, 'member', NOW())
          ON CONFLICT (conversation_id, user_id) DO NOTHING
        `, [generalChatId, user.id]);

        addedUsers.push({ id: user.id, name: user.name, email: user.email });
        logger.info('Added user to general chat', { userId: user.id, userName: user.name });
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        generalChatId,
        addedUsers,
        count: addedUsers.length,
        message: `${addedUsers.length} Benutzer zum allgemeinen Chat hinzugefügt`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error fixing general chat', error);
    res.status(500).json({ error: 'Fehler beim Reparieren des allgemeinen Chats' });
  }
});

// POST /api/admin/remove-duplicate-chats - Remove duplicate general chats, keep oldest
router.post('/remove-duplicate-chats', [auth, adminAuth], async (req, res) => {
  try {
    // Only superadmin can run this
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nur Superadmin kann diese Operation ausführen' });
    }

    logger.info('Starting duplicate chat removal', { userId: req.user.id });

    // Find all general chats ordered by creation date
    const chatsResult = await pool.query(`
      SELECT id, name, created_at,
             (SELECT COUNT(*) FROM message_conversation_members WHERE conversation_id = message_conversations.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = message_conversations.id) as message_count
      FROM message_conversations
      WHERE LOWER(name) LIKE '%allgemein%' OR LOWER(name) LIKE '%general%'
      ORDER BY created_at ASC
    `);

    const chats = chatsResult.rows;

    if (chats.length < 2) {
      logger.info('No duplicate chats found', { chatCount: chats.length });
      return res.json({
        success: true,
        message: 'Keine doppelten Chats gefunden',
        chats: chats.map(c => ({ id: c.id, name: c.name, created_at: c.created_at }))
      });
    }

    // Keep the oldest chat
    const keepChat = chats[0];
    const deletedChats = [];

    // Delete all newer duplicates
    for (let i = 1; i < chats.length; i++) {
      const deleteChat = chats[i];

      logger.info('Deleting duplicate chat', {
        id: deleteChat.id,
        name: deleteChat.name,
        created_at: deleteChat.created_at
      });

      // Delete in correct order (foreign keys)
      await pool.query('DELETE FROM messages WHERE conversation_id = $1', [deleteChat.id]);
      await pool.query('DELETE FROM message_conversation_members WHERE conversation_id = $1', [deleteChat.id]);
      await pool.query('DELETE FROM message_conversations WHERE id = $1', [deleteChat.id]);

      deletedChats.push({
        id: deleteChat.id,
        name: deleteChat.name,
        created_at: deleteChat.created_at,
        member_count: deleteChat.member_count,
        message_count: deleteChat.message_count
      });
    }

    logger.info('Duplicate chats removed', {
      kept: keepChat.id,
      deletedCount: deletedChats.length
    });

    res.json({
      success: true,
      message: `${deletedChats.length} doppelte Chat(s) gelöscht`,
      keptChat: {
        id: keepChat.id,
        name: keepChat.name,
        created_at: keepChat.created_at,
        member_count: keepChat.member_count,
        message_count: keepChat.message_count
      },
      deletedChats
    });

  } catch (error) {
    logger.error('Error removing duplicate chats', error);
    res.status(500).json({ error: 'Fehler beim Entfernen doppelter Chats' });
  }
});

module.exports = router;
