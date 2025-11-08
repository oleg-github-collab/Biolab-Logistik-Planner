const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getIO, getOnlineUsers } = require('../websocket');
const router = express.Router();

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

// @route   GET /api/admin/audit/stats
// @desc    Get audit statistics (admin only)
router.get('/audit/stats', [auth, adminAuth], async (req, res) => {
  try {
    // Simple stats from database
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      totalActions: 0,
      errorRate: 0
    };

    const usersResult = await pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM users');
    if (usersResult.rows.length > 0) {
      stats.totalUsers = parseInt(usersResult.rows[0].total) || 0;
      stats.activeUsers = parseInt(usersResult.rows[0].active) || 0;
    }

    res.json(stats);
  } catch (err) {
    logger.error('Error getting audit stats:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Audit-Statistiken' });
  }
});

// @route   GET /api/admin/audit/logs
// @desc    Get audit logs (admin only)
router.get('/audit/logs', [auth, adminAuth], async (req, res) => {
  try {
    // Return empty logs for now - can be extended later with actual audit table
    res.json({ logs: [] });
  } catch (err) {
    logger.error('Error getting audit logs:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Audit-Logs' });
  }
});

// @route   GET /api/admin/audit/export
// @desc    Export audit logs (admin only)
router.get('/audit/export', [auth, adminAuth], async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Simple export - return empty for now
    const exportData = format === 'csv' ? 'timestamp,action,user,details\n' : '[]';

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.${format}`);
    res.send(exportData);
  } catch (err) {
    logger.error('Error exporting audit logs:', err);
    res.status(500).json({ error: 'Serverfehler beim Exportieren der Audit-Logs' });
  }
});

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
    } catch (wsError) {
      logger.warn('WebSocket not available for broadcast:', wsError.message);
    }

    logger.info('Admin broadcast sent', { adminId: req.user.id, type });
    res.json({ message: 'Broadcast erfolgreich gesendet' });
  } catch (err) {
    logger.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Serverfehler beim Senden der Broadcast-Nachricht' });
  }
});

// ==================== AUDIT LOG ====================

/**
 * @route   GET /api/admin/audit-log
 * @desc    Get audit log with filtering
 * @access  Private (admin only)
 */
router.get('/audit-log', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const {
      page = 1,
      limit = 50,
      action,
      userId,
      resource,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = `
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (resource) {
      query += ` AND al.resource = $${paramIndex}`;
      params.push(resource);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (action) {
      countQuery += ` AND action = $${countIndex}`;
      countParams.push(action);
      countIndex++;
    }

    if (userId) {
      countQuery += ` AND user_id = $${countIndex}`;
      countParams.push(userId);
      countIndex++;
    }

    if (resource) {
      countQuery += ` AND resource = $${countIndex}`;
      countParams.push(resource);
      countIndex++;
    }

    if (start_date) {
      countQuery += ` AND created_at >= $${countIndex}`;
      countParams.push(start_date);
      countIndex++;
    }

    if (end_date) {
      countQuery += ` AND created_at <= $${countIndex}`;
      countParams.push(end_date);
      countIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/**
 * @route   GET /api/admin/audit-log/stats
 * @desc    Get audit log statistics
 * @access  Private (admin only)
 */
router.get('/audit-log/stats', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { start_date, end_date } = req.query;

    // Total actions
    let totalQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const totalParams = [];

    if (start_date) {
      totalQuery += ' AND created_at >= $1';
      totalParams.push(start_date);
      if (end_date) {
        totalQuery += ' AND created_at <= $2';
        totalParams.push(end_date);
      }
    } else if (end_date) {
      totalQuery += ' AND created_at <= $1';
      totalParams.push(end_date);
    }

    const totalResult = await pool.query(totalQuery, totalParams);

    // By action
    let actionQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;

    if (start_date) {
      actionQuery += ' AND created_at >= $1';
      if (end_date) {
        actionQuery += ' AND created_at <= $2';
      }
    } else if (end_date) {
      actionQuery += ' AND created_at <= $1';
    }

    actionQuery += ' GROUP BY action ORDER BY count DESC LIMIT 10';
    const actionResult = await pool.query(actionQuery, totalParams);

    // By user
    let userQuery = `
      SELECT
        al.user_id,
        u.name,
        u.email,
        COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    if (start_date) {
      userQuery += ' AND al.created_at >= $1';
      if (end_date) {
        userQuery += ' AND al.created_at <= $2';
      }
    } else if (end_date) {
      userQuery += ' AND al.created_at <= $1';
    }

    userQuery += ' GROUP BY al.user_id, u.name, u.email ORDER BY count DESC LIMIT 10';
    const userResult = await pool.query(userQuery, totalParams);

    // By resource
    let resourceQuery = `
      SELECT resource, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;

    if (start_date) {
      resourceQuery += ' AND created_at >= $1';
      if (end_date) {
        resourceQuery += ' AND created_at <= $2';
      }
    } else if (end_date) {
      resourceQuery += ' AND created_at <= $1';
    }

    resourceQuery += ' GROUP BY resource ORDER BY count DESC';
    const resourceResult = await pool.query(resourceQuery, totalParams);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      byAction: actionResult.rows,
      byUser: userResult.rows,
      byResource: resourceResult.rows
    });
  } catch (err) {
    logger.error('Error fetching audit log stats:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
