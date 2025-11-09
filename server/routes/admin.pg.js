const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLog');
const { getIO, getOnlineUsers, sendNotificationToUser } = require('../websocket');
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
      const allowedRoles = ['employee', 'admin', 'superadmin'];

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
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
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

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }
    if (password.length > 255) {
      return res.status(400).json({ error: 'Passwort darf maximal 255 Zeichen lang sein' });
    }

    // Validate employment type
    const allowedTypes = ['Vollzeit', 'Werkstudent'];
    if (!allowedTypes.includes(employment_type)) {
      return res.status(400).json({ error: 'Ungültiger Beschäftigungstyp. Muss Vollzeit oder Werkstudent sein' });
    }

    // Validate role
    const allowedRoles = ['employee', 'admin', 'superadmin'];
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
    const hashedPassword = await bcrypt.hash(password, 12);

    // Set auto_schedule based on employment_type
    const auto_schedule = employment_type === 'Vollzeit';

    // Create user
    const insertResult = await pool.query(
      `INSERT INTO users (name, email, password, role, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW())
       RETURNING id, name, email, role, employment_type, auto_schedule, default_start_time, default_end_time, weekly_hours_quota, is_active, created_at, updated_at`,
      [sanitizedName, sanitizedEmail, hashedPassword, role, employment_type, auto_schedule, normalizedStartTime, normalizedEndTime, validWeeklyHours]
    );

    const newUser = insertResult.rows[0];

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
      user: newUser
    });
  } catch (err) {
    console.error('Fehler beim Erstellen des Benutzers:', err.message);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Benutzers' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
router.delete('/users/:id', [auth, adminAuth], async (req, res) => {
  const { id } = req.params;

  // Prevent deleting the current admin user
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht löschen' });
  }

  try {
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];

    if (user.role === 'superadmin') {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Nur Superadmins können Superadmin-Konten löschen' });
      }

      const superAdminCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'"
      );
      if (parseInt(superAdminCountResult.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Der letzte Superadmin kann nicht gelöscht werden' });
      }
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: `Benutzer ${user.name} erfolgreich gelöscht`,
      deletedId: id
    });
  } catch (err) {
    console.error('Fehler beim Löschen des Benutzers:', err.message);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Benutzers' });
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
    console.log('[BROADCAST] Request:', JSON.stringify(req.body, null, 2));
    const { message, type = 'info' } = req.body;

    if (!message || !message.trim()) {
      console.log('[BROADCAST] ERROR: Empty message');
      return res.status(400).json({ error: 'Nachricht ist erforderlich' });
    }

    // Sanitize message
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage || sanitizedMessage.length === 0) {
      return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
    }

    if (sanitizedMessage.length > 5000) {
      return res.status(400).json({ error: 'Nachricht darf maximal 5000 Zeichen lang sein' });
    }

    // Validate type
    const allowedTypes = ['info', 'warning', 'success', 'error'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Nachrichtentyp. Erlaubt: info, warning, success, error' });
    }

    const notificationTitle = `Nachricht von ${req.user.name}`;

    const notificationResult = await pool.query(
      `
      INSERT INTO notifications (user_id, type, title, content, metadata, created_at)
      SELECT id, 'broadcast', $1, $2,
             jsonb_build_object('category', 'admin', 'severity', $3),
             NOW()
      FROM users
      WHERE is_active = TRUE
        AND id <> $4
      RETURNING id, user_id
      `,
      [notificationTitle, sanitizedMessage, type, req.user.id]
    );

    try {
      const io = getIO();
      if (io) {
        io.emit('admin:broadcast', {
          message: sanitizedMessage,
          type,
          timestamp: new Date().toISOString(),
          from: req.user.name
        });
      }

      notificationResult.rows.forEach(({ user_id, id }) => {
        sendNotificationToUser(user_id, {
          id,
          user_id,
          type: 'broadcast',
          title: notificationTitle,
          content: sanitizedMessage,
          metadata: { category: 'admin', severity: type }
        });
      });
    } catch (wsError) {
      logger.warn('WebSocket not available for broadcast:', wsError.message);
    }

    logger.info('Admin broadcast sent', {
      adminId: req.user.id,
      type,
      recipients: notificationResult.rowCount
    });
    res.json({ message: 'Broadcast erfolgreich gesendet', recipients: notificationResult.rowCount });
  } catch (err) {
    logger.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Serverfehler beim Senden der Broadcast-Nachricht' });
  }
});

// ==================== AUDIT LOG ====================

router.get('/audit-log', [auth, adminAuth], handleAuditLogs);
router.get('/audit-log/stats', [auth, adminAuth], handleAuditStats);
router.get('/audit-log/export', [auth, adminAuth], handleAuditExport);

module.exports = router;
