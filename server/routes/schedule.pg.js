const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const auditLogger = require('../utils/auditLog');
const logger = require('../utils/logger');
const { schemas, validate } = require('../validators');

const router = express.Router();

// Helper functions
function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateForDB(date) {
  return date.toISOString().split('T')[0];
}

function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return (endMinutes - startMinutes) / 60;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value && value !== 0) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function combineDateAndTime(dateInput, timeInput) {
  if (!dateInput && dateInput !== 0) return null;

  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const dateAsString = String(dateInput).trim();
  if (!dateAsString) return null;

  if (dateAsString.includes('T')) {
    const parsed = new Date(dateAsString);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const sanitizedTime = typeof timeInput === 'string' && timeInput
    ? (timeInput.length === 5 ? `${timeInput}:00` : timeInput)
    : '00:00:00';

  const parsed = new Date(`${dateAsString}T${sanitizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveEventTimestamps({ allDay, startDate, endDate, startTime, endTime }) {
  const isAllDay = parseBoolean(allDay, false);

  if (isAllDay) {
    const start = toDate(startDate);
    if (!start) return { startTimestamp: null, endTimestamp: null };

    const end = toDate(endDate) || start;
    return {
      startTimestamp: start.toISOString(),
      endTimestamp: (end && end >= start ? end : start).toISOString()
    };
  }

  const start = combineDateAndTime(startDate, startTime);
  if (!start) return { startTimestamp: null, endTimestamp: null };

  const end = combineDateAndTime(endDate || startDate, endTime);
  const finalEnd = end && end >= start ? end : start;

  return {
    startTimestamp: start.toISOString(),
    endTimestamp: finalEnd.toISOString()
  };
}

function normalizeAttachments(rawAttachments) {
  if (!rawAttachments && rawAttachments !== 0) return [];

  let list = rawAttachments;

  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (error) {
      return [];
    }
  }

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      if (!item.url) return null;

      const mime = item.mimeType || item.mimetype || '';
      const inferredType = typeof item.type === 'string'
        ? item.type
        : mime.startsWith('image/')
          ? 'image'
          : mime.startsWith('audio/')
            ? 'audio'
            : 'file';

      return {
        ...item,
        type: inferredType,
        name: item.name || item.filename || null
      };
    })
    .filter(Boolean);
}

function normalizeTags(rawTags) {
  if (!rawTags && rawTags !== 0) return [];

  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof rawTags === 'string') {
    const trimmed = rawTags.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean);
      }
    } catch (error) {
      // Ignore JSON parse error and fall back to manual split
    }

    return trimmed
      .split(/[;,]/)
      .map((tag) => tag.trim().replace(/^#+/, ''))
      .filter(Boolean);
  }

  return [];
}

function normalizeAttendees(rawAttendees) {
  if (!rawAttendees && rawAttendees !== 0) return [];

  if (Array.isArray(rawAttendees)) {
    return rawAttendees.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof rawAttendees === 'object') {
    return Object.values(rawAttendees)
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  if (typeof rawAttendees === 'string') {
    const trimmed = rawAttendees.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter(Boolean);
      }
    } catch (error) {
      // Ignore parse error and fall back to manual split
    }

    return trimmed
      .split(/[;,]/)
      .map((entry) => entry.trim().replace(/^"+|"+$/g, ''))
      .filter(Boolean);
  }

  return [];
}

function normalizeReminder(value, fallback = 15) {
  if (value === null) return null;
  if (value === undefined || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeIsoDate(value) {
  if (!value && value !== 0) return null;
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function firstImageUrl(attachments) {
  return attachments.find((file) => file?.type === 'image')?.url || null;
}

function transformEventRow(row) {
  if (!row) return row;

  const attachments = normalizeAttachments(row.attachments);
  const tags = normalizeTags(row.tags);
  const attendees = normalizeAttendees(row.attendees);

  return {
    ...row,
    attachments,
    tags,
    attendees,
    all_day: parseBoolean(row.all_day, false),
    is_recurring: parseBoolean(row.is_recurring, false),
    reminder: row.reminder === null || row.reminder === undefined ? null : Number(row.reminder),
    start_time: normalizeIsoDate(row.start_time) || row.start_time,
    end_time: normalizeIsoDate(row.end_time) || row.end_time,
    recurrence_end_date: normalizeIsoDate(row.recurrence_end_date) || row.recurrence_end_date,
    created_at: normalizeIsoDate(row.created_at) || row.created_at,
    updated_at: normalizeIsoDate(row.updated_at) || row.updated_at
  };
}

// @route   GET /api/schedule/week/:weekStart
// @desc    Get schedule for a specific week
router.get('/week/:weekStart', auth, async (req, res) => {
  try {
    const { weekStart } = req.params;
    const { userId } = req.query;

    // If userId is provided and user is admin/superadmin, show that user's schedule
    // Otherwise, show current user's schedule
    let targetUserId = req.user.id;

    if (userId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      targetUserId = parseInt(userId);
    }

    const result = await pool.query(
      `SELECT ws.*,
         u.name as user_name,
         updater.name as last_updated_by_name
       FROM weekly_schedules ws
       LEFT JOIN users u ON ws.user_id = u.id
       LEFT JOIN users updater ON ws.last_updated_by = updater.id
       WHERE ws.user_id = $1 AND ws.week_start = $2
       ORDER BY ws.day_of_week`,
      [targetUserId, weekStart]
    );

    // If no schedule exists for this week, create schedule with defaults for Vollzeit
    if (result.rows.length === 0) {
      // Get user's employment type to set default hours
      const userInfo = await pool.query('SELECT weekly_hours_quota FROM users WHERE id = $1', [targetUserId]);
      const isVollzeit = userInfo.rows.length > 0 && userInfo.rows[0].weekly_hours_quota >= 40;

      const days = [];
      for (let i = 0; i < 7; i++) {
        // For Vollzeit: Mon-Fri 8:00-16:30, Sat-Sun off
        const isWeekday = i >= 0 && i <= 4; // Mon=0, Fri=4
        const isWorking = isVollzeit ? isWeekday : false;
        const startTime = (isVollzeit && isWeekday) ? '08:00' : null;
        const endTime = (isVollzeit && isWeekday) ? '16:30' : null;

        const insertResult = await pool.query(
          `INSERT INTO weekly_schedules (
            user_id, week_start, day_of_week, is_working, start_time, end_time,
            last_updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [targetUserId, weekStart, i, isWorking, startTime, endTime, req.user.id]
        );
        days.push(insertResult.rows[0]);
      }

      logger.info('Created schedule for week', {
        userId: targetUserId,
        weekStart,
        type: isVollzeit ? 'Vollzeit (8:00-16:30)' : 'Empty'
      });

      return res.json(days);
    }

    const events = result.rows.map((row) => ({
      ...row,
      attachments: typeof row.attachments === 'string'
        ? JSON.parse(row.attachments || '[]')
        : Array.isArray(row.attachments)
          ? row.attachments
          : []
    }));

    res.json(events);

  } catch (error) {
    logger.error('Error fetching week schedule', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/schedule/hours-summary/:weekStart
// @desc    Get hours summary for a week (booked vs quota)
router.get('/hours-summary/:weekStart', auth, async (req, res) => {
  try {
    const { weekStart } = req.params;
    const { userId } = req.query;

    let targetUserId = req.user.id;
    if (userId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      targetUserId = parseInt(userId);
    }

    // Get user's weekly quota
    const userResult = await pool.query(
      'SELECT weekly_hours_quota FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const weeklyQuota = parseFloat(userResult.rows[0].weekly_hours_quota);

    // Get booked hours for this week
    const scheduleResult = await pool.query(
      `SELECT start_time, end_time, is_working
       FROM weekly_schedules
       WHERE user_id = $1 AND week_start = $2`,
      [targetUserId, weekStart]
    );

    let totalBooked = 0;
    scheduleResult.rows.forEach(row => {
      if (row.is_working && row.start_time && row.end_time) {
        totalBooked += calculateHours(row.start_time, row.end_time);
      }
    });

    const difference = totalBooked - weeklyQuota;
    const status = difference === 0 ? 'exact' : (difference < 0 ? 'under' : 'over');

    res.json({
      weeklyQuota,
      totalBooked,
      difference,
      status,
      weekStart
    });

  } catch (error) {
    logger.error('Error fetching hours summary', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/schedule/hours-summary/month/:year/:month
// @desc    Get hours summary for entire month
router.get('/hours-summary/month/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { userId } = req.query;

    let targetUserId = req.user.id;
    if (userId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      targetUserId = parseInt(userId);
    }

    // Get user's weekly quota
    const userResult = await pool.query(
      'SELECT weekly_hours_quota, employment_type FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const weeklyQuota = parseFloat(userResult.rows[0].weekly_hours_quota);

    // Calculate date range for month
    const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthEnd = new Date(parseInt(year), parseInt(month), 0);

    // Get all schedules for this month
    const scheduleResult = await pool.query(
      `SELECT week_start, start_time, end_time, is_working
       FROM weekly_schedules
       WHERE user_id = $1
         AND week_start >= $2
         AND week_start <= $3`,
      [targetUserId, formatDateForDB(monthStart), formatDateForDB(monthEnd)]
    );

    // Group by week
    const weekSummaries = {};
    scheduleResult.rows.forEach(row => {
      if (!weekSummaries[row.week_start]) {
        weekSummaries[row.week_start] = {
          weekStart: row.week_start,
          totalBooked: 0
        };
      }

      if (row.is_working && row.start_time && row.end_time) {
        weekSummaries[row.week_start].totalBooked += calculateHours(row.start_time, row.end_time);
      }
    });

    // Calculate totals
    const weeks = Object.values(weekSummaries);
    const totalWeeks = weeks.length;
    const totalQuota = weeklyQuota * totalWeeks;
    const totalBooked = weeks.reduce((sum, week) => sum + week.totalBooked, 0);
    const difference = totalBooked - totalQuota;
    const status = difference === 0 ? 'exact' : (difference < 0 ? 'under' : 'over');

    res.json({
      year: parseInt(year),
      month: parseInt(month),
      weeklyQuota,
      totalWeeks,
      totalQuota,
      totalBooked,
      difference,
      status,
      weeks
    });

  } catch (error) {
    logger.error('Error fetching month hours summary', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/schedule/day/:id
// @desc    Update a single day in schedule
router.put('/day/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isWorking, startTime, endTime } = req.body;

    // Get existing day data
    const existingResult = await pool.query(
      'SELECT * FROM weekly_schedules WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule day not found' });
    }

    const existingDay = existingResult.rows[0];

    // Check permissions - users can only edit their own schedule unless admin
    if (existingDay.user_id !== req.user.id &&
        req.user.role !== 'admin' &&
        req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    // Validate and normalize time range if working
    let normalizedStartTime = startTime;
    let normalizedEndTime = endTime;

    if (isWorking) {
      if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start- und Endzeit sind erforderlich' });
      }

      // Support both H:MM and HH:MM formats, and handle various input types
      const flexibleTimeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

      // Ensure times are strings and trim whitespace
      const cleanStartTime = String(startTime || '').trim();
      const cleanEndTime = String(endTime || '').trim();

      const startMatch = cleanStartTime.match(flexibleTimeRegex);
      const endMatch = cleanEndTime.match(flexibleTimeRegex);

      if (!startMatch || !endMatch) {
        return res.status(400).json({
          error: 'Ungültiges Zeitformat (HH:MM erforderlich)',
          details: `Start: "${cleanStartTime}", End: "${cleanEndTime}"`
        });
      }

      // Normalize to HH:MM format
      normalizedStartTime = `${startMatch[1].padStart(2, '0')}:${startMatch[2]}`;
      normalizedEndTime = `${endMatch[1].padStart(2, '0')}:${endMatch[2]}`;

      const hours = calculateHours(normalizedStartTime, normalizedEndTime);
      if (hours <= 0) {
        return res.status(400).json({ error: 'Endzeit muss nach Startzeit liegen' });
      }
      if (hours > 24) {
        return res.status(400).json({ error: 'Arbeitszeit kann nicht mehr als 24 Stunden betragen' });
      }
    } else {
      // When not working, explicitly set times to null
      normalizedStartTime = null;
      normalizedEndTime = null;
    }

    // Update day
    const updateResult = await pool.query(
      `UPDATE weekly_schedules
       SET is_working = $1,
           start_time = $2,
           end_time = $3,
           last_updated_by = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        isWorking,
        isWorking ? normalizedStartTime : null,
        isWorking ? normalizedEndTime : null,
        req.user.id,
        id
      ]
    );

    const updatedDay = updateResult.rows[0];

    // Fetch with joined data
    const dayResult = await pool.query(
      `SELECT ws.*,
         u.name as user_name,
         updater.name as last_updated_by_name
       FROM weekly_schedules ws
       LEFT JOIN users u ON ws.user_id = u.id
       LEFT JOIN users updater ON ws.last_updated_by = updater.id
       WHERE ws.id = $1`,
      [id]
    );

    const formattedDay = dayResult.rows[0];

    // Broadcast to all connected clients
    const io = getIO();
    if (io) {
      io.emit('schedule:day_updated', {
        day: formattedDay,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    // Audit log - automatically handled by trigger
    logger.info('Schedule day updated', {
      scheduleId: id,
      userId: req.user.id,
      targetUserId: existingDay.user_id,
      weekStart: existingDay.week_start,
      dayOfWeek: existingDay.day_of_week
    });

    res.json(formattedDay);

  } catch (error) {
    logger.error('Error updating schedule day', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/schedule/week/:weekStart
// @desc    Update entire week schedule
router.put('/week/:weekStart', auth, async (req, res) => {
  try {
    const { weekStart } = req.params;
    const { days } = req.body; // Array of day objects

    if (!Array.isArray(days) || days.length !== 7) {
      return res.status(400).json({ error: 'Must provide exactly 7 days' });
    }

    // Use transaction for atomicity
    const client = await pool.getClient();
    try {
      await client.query('BEGIN');

      const updatedDays = [];

      for (let i = 0; i < days.length; i++) {
        const day = days[i];

        // Validate
        if (day.isWorking && day.startTime && day.endTime) {
          const hours = calculateHours(day.startTime, day.endTime);
          if (hours <= 0 || hours > 24) {
            throw new Error(`Invalid time range for day ${i}`);
          }
        }

        // Update or insert
        const result = await client.query(
          `INSERT INTO weekly_schedules (
            user_id, week_start, day_of_week, is_working, start_time, end_time,
            last_updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, week_start, day_of_week)
          DO UPDATE SET
            is_working = EXCLUDED.is_working,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            last_updated_by = EXCLUDED.last_updated_by,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *`,
          [
            req.user.id,
            weekStart,
            i,
            day.isWorking || false,
            day.isWorking ? day.startTime : null,
            day.isWorking ? day.endTime : null,
            req.user.id
          ]
        );

        updatedDays.push(result.rows[0]);
      }

      await client.query('COMMIT');

      // Broadcast to all connected clients
      const io = getIO();
      if (io) {
        io.emit('schedule:week_updated', {
          weekStart,
          days: updatedDays,
          user: {
            id: req.user.id,
            name: req.user.name
          }
        });
      }

      logger.info('Week schedule updated', {
        userId: req.user.id,
        weekStart
      });

      res.json(updatedDays);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error updating week schedule', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// @route   GET /api/schedule/audit/:weekStart
// @desc    Get audit trail for a week's schedule
router.get('/audit/:weekStart', auth, async (req, res) => {
  try {
    const { weekStart } = req.params;
    const { userId } = req.query;

    // Only admin/superadmin can view other users' audit logs
    let targetUserId = req.user.id;
    if (userId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      targetUserId = parseInt(userId);
    } else if (userId) {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    const result = await pool.query(
      `SELECT wha.*,
         u.name as user_name,
         changer.name as changed_by_user_name
       FROM work_hours_audit wha
       LEFT JOIN users u ON wha.user_id = u.id
       LEFT JOIN users changer ON wha.changed_by = changer.id
       WHERE wha.user_id = $1 AND wha.week_start = $2
       ORDER BY wha.changed_at DESC`,
      [targetUserId, weekStart]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching schedule audit', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/schedule/users
// @desc    Get all users with their current week hours (admin only)
router.get('/users', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const currentWeekStart = formatDateForDB(getMonday(new Date()));

    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.employment_type,
         u.weekly_hours_quota,
         COALESCE(SUM(
           CASE WHEN ws.is_working THEN
             EXTRACT(EPOCH FROM (ws.end_time - ws.start_time)) / 3600
           ELSE 0 END
         ), 0) as current_week_hours
       FROM users u
       LEFT JOIN weekly_schedules ws ON u.id = ws.user_id AND ws.week_start = $1
       GROUP BY u.id, u.name, u.email, u.role, u.employment_type, u.weekly_hours_quota
       ORDER BY u.name`,
      [currentWeekStart]
    );

    const users = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      employment_type: row.employment_type,
      weekly_hours_quota: parseFloat(row.weekly_hours_quota),
      current_week_hours: parseFloat(row.current_week_hours),
      status: row.current_week_hours < row.weekly_hours_quota ? 'under' :
              row.current_week_hours > row.weekly_hours_quota ? 'over' : 'exact'
    }));

    res.json(users);

  } catch (error) {
    logger.error('Error fetching users schedule overview', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/schedule/events
// @desc    Get all calendar events with optional filters
router.get('/events', auth, async (req, res) => {
  try {
    // Accept both start/end and startDate/endDate for backward compatibility
    const {
      startDate,
      endDate,
      start,
      end,
      userId,
      type,
      priority
    } = req.query;

    const actualStartDate = startDate || start;
    const actualEndDate = endDate || end;

    let targetUserId = req.user.id;
    if (userId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      targetUserId = parseInt(userId);
    }

    let query = `
      SELECT e.*,
        creator.name as created_by_name
      FROM calendar_events e
      LEFT JOIN users creator ON e.created_by = creator.id
      WHERE e.created_by = $1
    `;

    const params = [targetUserId];
    let paramIndex = 2;

    if (actualStartDate) {
      query += ` AND e.start_time >= $${paramIndex}`;
      params.push(actualStartDate);
      paramIndex++;
    }

    if (actualEndDate) {
      query += ` AND e.end_time <= $${paramIndex}`;
      params.push(actualEndDate);
      paramIndex++;
    }

    if (type) {
      query += ` AND e.event_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (priority) {
      query += ` AND e.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ' ORDER BY e.start_time, e.end_time';

    const result = await pool.query(query, params);
    const events = result.rows.map(transformEventRow);

    res.json(events);

  } catch (error) {
    logger.error('Error fetching calendar events', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/schedule/events
// @desc    Create new calendar event
router.post('/events', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      start,
      end,
      event_type,
      type,
      location,
      attendees,
      all_day,
      isAllDay,
      color,
      attachments = [],
      priority,
      status,
      category,
      reminder,
      notes,
      tags,
      is_recurring,
      isRecurring,
      recurrence_pattern,
      recurrencePattern,
      recurrence_end_date,
      recurrenceEndDate
    } = req.body;

    if (!title || !(startDate || start)) {
      return res.status(400).json({ error: 'Titel und Startdatum sind erforderlich' });
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'Titel darf nicht leer sein' });
    }

    const computedAllDay = parseBoolean(all_day ?? isAllDay, false);

    const { startTimestamp, endTimestamp } = resolveEventTimestamps({
      allDay: computedAllDay,
      startDate: startDate || start,
      endDate: endDate || end,
      startTime,
      endTime
    });

    if (!startTimestamp) {
      return res.status(400).json({ error: 'Ungültiges Startdatum oder Startzeit' });
    }

    const normalizedAttachments = normalizeAttachments(attachments);
    const normalizedTags = normalizeTags(tags);
    const normalizedAttendees = normalizeAttendees(attendees);
    const coverImage = firstImageUrl(normalizedAttachments);

    const normalizedPriority = priority ? String(priority).trim() || 'medium' : 'medium';
    const normalizedStatus = status ? String(status).trim() || 'confirmed' : 'confirmed';
    const normalizedCategory = category ? String(category).trim() || 'work' : 'work';
    const normalizedReminder = normalizeReminder(reminder, 15);
    const sanitizedNotes = notes !== undefined && notes !== null
      ? (String(notes).trim() || null)
      : null;

    const recurringFlag = parseBoolean(is_recurring ?? isRecurring, false);
    const recurrencePatternValue = recurringFlag
      ? (recurrence_pattern || recurrencePattern || null)
      : null;
    const recurrenceEndValue = recurringFlag
      ? normalizeIsoDate(recurrence_end_date || recurrenceEndDate)
      : null;

    const eventType = (() => {
      const candidate = event_type ?? type;
      if (!candidate) return 'meeting';
      const cleaned = String(candidate).trim();
      return cleaned || 'meeting';
    })();

    const result = await pool.query(
      `INSERT INTO calendar_events (
        title, description, start_time, end_time, all_day,
        event_type, color, location, attendees, attachments, cover_image,
        priority, status, category, reminder, notes, tags,
        is_recurring, recurrence_pattern, recurrence_end_date,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9::jsonb, $10::jsonb, $11,
        $12, $13, $14, $15, $16, $17::jsonb,
        $18, $19, $20,
        $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *`,
      [
        normalizedTitle,
        description ? String(description).trim() : null,
        startTimestamp,
        endTimestamp,
        computedAllDay,
        eventType,
        color ? String(color).trim() : null,
        location ? String(location).trim() : null,
        JSON.stringify(normalizedAttendees),
        JSON.stringify(normalizedAttachments),
        coverImage,
        normalizedPriority,
        normalizedStatus,
        normalizedCategory,
        normalizedReminder,
        sanitizedNotes,
        JSON.stringify(normalizedTags),
        recurringFlag,
        recurrencePatternValue ? String(recurrencePatternValue).trim() || null : null,
        recurrenceEndValue,
        req.user.id
      ]
    );

    const newEvent = transformEventRow(result.rows[0]);

    auditLogger.logDataChange('create', req.user.id, 'calendar_event', newEvent.id, {
      title: newEvent.title,
      start_time: startTimestamp,
      end_time: endTimestamp,
      priority: normalizedPriority,
      status: normalizedStatus,
      is_recurring: recurringFlag,
      attachments: normalizedAttachments.length
    });

    // Broadcast to connected clients
    const io = getIO();
    if (io) {
      io.emit('schedule:event_created', {
        event: newEvent,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Calendar event created', {
      eventId: newEvent.id,
      userId: req.user.id,
      eventType,
      priority: normalizedPriority,
      isRecurring: recurringFlag
    });

    res.status(201).json(newEvent);

  } catch (error) {
    logger.error('Error creating calendar event', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   PUT /api/schedule/events/:id
// @desc    Update calendar event
router.put('/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      start,
      end,
      event_type,
      type,
      location,
      attendees,
      all_day,
      isAllDay,
      color,
      attachments = [],
      priority,
      status,
      category,
      reminder,
      notes,
      tags,
      is_recurring,
      isRecurring,
      recurrence_pattern,
      recurrencePattern,
      recurrence_end_date,
      recurrenceEndDate
    } = req.body;

    // Check if event exists and user has permission
    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ereignis nicht gefunden' });
    }

    const event = transformEventRow(existing.rows[0]);

    if (event.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    const computedAllDay = parseBoolean(all_day ?? isAllDay, event.all_day);

    const existingStartIso = event.start_time;
    const existingEndIso = event.end_time;

    const derivedStartTime = existingStartIso ? existingStartIso.substring(11, 16) : null;
    const derivedEndTime = existingEndIso ? existingEndIso.substring(11, 16) : null;

    const { startTimestamp, endTimestamp } = resolveEventTimestamps({
      allDay: computedAllDay,
      startDate: startDate || start || existingStartIso,
      endDate: endDate || end || existingEndIso,
      startTime: startTime ?? derivedStartTime,
      endTime: endTime ?? derivedEndTime
    });

    if (!startTimestamp) {
      return res.status(400).json({ error: 'Ungültiges Startdatum oder Startzeit' });
    }

    const normalizedAttachments = normalizeAttachments(
      attachments === undefined ? event.attachments : attachments
    );
    const normalizedTags = normalizeTags(tags === undefined ? event.tags : tags);
    const normalizedAttendees = normalizeAttendees(
      attendees === undefined ? event.attendees : attendees
    );
    const coverImage = firstImageUrl(normalizedAttachments);

    const normalizedTitle = title !== undefined ? String(title).trim() : event.title;
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'Titel darf nicht leer sein' });
    }

    const eventTypeCandidate = event_type ?? type ?? event.event_type ?? 'meeting';
    const eventTypeNormalized = String(eventTypeCandidate).trim() || 'meeting';

    const normalizedPriority = priority !== undefined
      ? (String(priority).trim() || event.priority || 'medium')
      : (event.priority || 'medium');

    const normalizedStatus = status !== undefined
      ? (String(status).trim() || event.status || 'confirmed')
      : (event.status || 'confirmed');

    const normalizedCategory = category !== undefined
      ? (String(category).trim() || event.category || 'work')
      : (event.category || 'work');

    const normalizedReminder = normalizeReminder(reminder, event.reminder ?? 15);

    const sanitizedNotes = notes !== undefined
      ? (notes === null ? null : (String(notes).trim() || null))
      : (event.notes || null);

    const recurringFlag = parseBoolean(is_recurring ?? isRecurring, event.is_recurring);
    const recurrencePatternValue = recurringFlag
      ? (recurrence_pattern || recurrencePattern || event.recurrence_pattern || null)
      : null;
    const recurrenceEndValue = recurringFlag
      ? (normalizeIsoDate(recurrence_end_date || recurrenceEndDate) || event.recurrence_end_date || null)
      : null;

    const result = await pool.query(
      `UPDATE calendar_events SET
        title = $1,
        description = $2,
        start_time = $3,
        end_time = $4,
        all_day = $5,
        event_type = $6,
        color = $7,
        location = $8,
        attendees = $9::jsonb,
        attachments = $10::jsonb,
        cover_image = $11,
        priority = $12,
        status = $13,
        category = $14,
        reminder = $15,
        notes = $16,
        tags = $17::jsonb,
        is_recurring = $18,
        recurrence_pattern = $19,
        recurrence_end_date = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *`,
      [
        normalizedTitle,
        description !== undefined ? (description ? String(description).trim() : null) : (event.description || null),
        startTimestamp,
        endTimestamp,
        computedAllDay,
        eventTypeNormalized,
        color !== undefined ? (color ? String(color).trim() : null) : (event.color || null),
        location !== undefined ? (location ? String(location).trim() : null) : (event.location || null),
        JSON.stringify(normalizedAttendees),
        JSON.stringify(normalizedAttachments),
        coverImage,
        normalizedPriority,
        normalizedStatus,
        normalizedCategory,
        normalizedReminder,
        sanitizedNotes,
        JSON.stringify(normalizedTags),
        recurringFlag,
        recurrencePatternValue ? String(recurrencePatternValue).trim() || null : null,
        recurrenceEndValue,
        id
      ]
    );

    const updatedEvent = transformEventRow(result.rows[0]);

    auditLogger.logDataChange('update', req.user.id, 'calendar_event', updatedEvent.id, {
      title: updatedEvent.title,
      start_time: startTimestamp,
      end_time: endTimestamp,
      priority: normalizedPriority,
      status: normalizedStatus,
      is_recurring: recurringFlag,
      attachments: normalizedAttachments.length
    });

    // Broadcast
    const io = getIO();
    if (io) {
      io.emit('schedule:event_updated', {
        event: updatedEvent,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Calendar event updated', {
      eventId: id,
      userId: req.user.id,
      priority: normalizedPriority,
      isRecurring: recurringFlag
    });

    res.json(updatedEvent);

  } catch (error) {
    logger.error('Error updating calendar event', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   DELETE /api/schedule/events/:id
// @desc    Delete calendar event
router.delete('/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists and user has permission
    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ereignis nicht gefunden' });
    }

    const event = existing.rows[0];

    if (event.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);

    // Broadcast
    const io = getIO();
    if (io) {
      io.emit('schedule:event_deleted', {
        eventId: id,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Calendar event deleted', {
      eventId: id,
      userId: req.user.id
    });

    auditLogger.logDataChange('delete', req.user.id, 'calendar_event', parseInt(id, 10), {});

    res.json({ message: 'Event deleted successfully', deletedId: id });

  } catch (error) {
    logger.error('Error deleting calendar event', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   GET /api/schedule/events/statistics
// @desc    Get event statistics
router.get('/events/statistics', auth, async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;

    let startDate;
    const endDate = new Date();

    switch (timeframe) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'meeting' THEN 1 END) as meetings,
        COUNT(CASE WHEN event_type = 'vacation' THEN 1 END) as vacations,
        COUNT(CASE WHEN event_type = 'sick' THEN 1 END) as sick_days,
        COUNT(CASE WHEN event_type = 'urgent' THEN 1 END) as high_priority
      FROM calendar_events
      WHERE created_by = $1
        AND start_time >= $2
        AND start_time <= $3`,
      [req.user.id, formatDateForDB(startDate), formatDateForDB(endDate)]
    );

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error fetching event statistics', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/schedule/events/bulk
// @desc    Create multiple events at once
router.post('/events/bulk', auth, async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const client = await pool.getClient();
    try {
      await client.query('BEGIN');

      const createdEvents = [];

      for (const event of events) {
        const title = event.title ? String(event.title).trim() : '';
        if (!title) {
          throw new Error('Event title is required for bulk creation');
        }

        const computedAllDay = parseBoolean(event.all_day ?? event.isAllDay, false);

        const { startTimestamp, endTimestamp } = resolveEventTimestamps({
          allDay: computedAllDay,
          startDate: event.startDate || event.start || event.start_date || event.event_date,
          endDate: event.endDate || event.end || event.end_date || event.event_date,
          startTime: event.startTime || event.start_time,
          endTime: event.endTime || event.end_time
        });

        if (!startTimestamp) {
          throw new Error(`Invalid start date for event "${title}"`);
        }

        const normalizedAttachments = normalizeAttachments(event.attachments);
        const normalizedTags = normalizeTags(event.tags);
        const normalizedAttendees = normalizeAttendees(event.attendees);
        const coverImage = firstImageUrl(normalizedAttachments);

        const normalizedPriority = event.priority ? String(event.priority).trim() || 'medium' : 'medium';
        const normalizedStatus = event.status ? String(event.status).trim() || 'confirmed' : 'confirmed';
        const normalizedCategory = event.category ? String(event.category).trim() || 'work' : 'work';
        const normalizedReminder = normalizeReminder(event.reminder, 15);
        const sanitizedNotes = event.notes !== undefined && event.notes !== null
          ? (String(event.notes).trim() || null)
          : null;

        const recurringFlag = parseBoolean(event.is_recurring ?? event.isRecurring, false);
        const recurrencePatternValue = recurringFlag
          ? (event.recurrence_pattern || event.recurrencePattern || null)
          : null;
        const recurrenceEndValue = recurringFlag
          ? normalizeIsoDate(event.recurrence_end_date || event.recurrenceEndDate)
          : null;

        const eventType = (() => {
          const candidate = event.event_type || event.type;
          if (!candidate) return 'meeting';
          const cleaned = String(candidate).trim();
          return cleaned || 'meeting';
        })();

        const result = await client.query(
          `INSERT INTO calendar_events (
            title, description, start_time, end_time, all_day,
            event_type, color, location, attendees, attachments, cover_image,
            priority, status, category, reminder, notes, tags,
            is_recurring, recurrence_pattern, recurrence_end_date,
            created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9::jsonb, $10::jsonb, $11,
            $12, $13, $14, $15, $16, $17::jsonb,
            $18, $19, $20,
            $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *`,
          [
            title,
            event.description ? String(event.description).trim() : null,
            startTimestamp,
            endTimestamp,
            computedAllDay,
            eventType,
            event.color ? String(event.color).trim() : null,
            event.location ? String(event.location).trim() : null,
            JSON.stringify(normalizedAttendees),
            JSON.stringify(normalizedAttachments),
            coverImage,
            normalizedPriority,
            normalizedStatus,
            normalizedCategory,
            normalizedReminder,
            sanitizedNotes,
            JSON.stringify(normalizedTags),
            recurringFlag,
            recurrencePatternValue ? String(recurrencePatternValue).trim() || null : null,
            recurrenceEndValue,
            req.user.id
          ]
        );

        createdEvents.push(transformEventRow(result.rows[0]));
      }

      await client.query('COMMIT');

      logger.info('Bulk events created', {
        count: createdEvents.length,
        userId: req.user.id
      });

      res.status(201).json(createdEvents);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error creating bulk events', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// @route   POST /api/schedule/events/:id/duplicate
// @desc    Duplicate event to new date
router.post('/events/:id/duplicate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate } = req.body;

    if (!newDate) {
      return res.status(400).json({ error: 'New date is required' });
    }

    // Get original event
    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ereignis nicht gefunden' });
    }

    const original = transformEventRow(existing.rows[0]);

    if (original.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Nicht autorisiert' });
    }

    const newDateObj = toDate(newDate);
    if (!newDateObj) {
      return res.status(400).json({ error: 'Ungültiges Datum für die Duplizierung' });
    }

    const originalStart = toDate(original.start_time);
    const originalEnd = toDate(original.end_time) || originalStart;
    const durationMs = originalStart && originalEnd ? originalEnd.getTime() - originalStart.getTime() : 0;

    let startTimestamp;
    let endTimestamp;

    if (parseBoolean(original.all_day, false)) {
      const baseStart = combineDateAndTime(newDate, '00:00:00') || toDate(newDate);
      if (!baseStart) {
        return res.status(400).json({ error: 'Ungültiges Startdatum für die Duplizierung' });
      }
      const duplicateEnd = new Date(baseStart.getTime() + Math.max(durationMs, 0));
      startTimestamp = baseStart.toISOString();
      endTimestamp = duplicateEnd.toISOString();
    } else {
      const originalStartTime = originalStart ? originalStart.toISOString().substring(11, 16) : null;
      const originalEndTime = originalEnd ? originalEnd.toISOString().substring(11, 16) : null;

      const duplicateStart = combineDateAndTime(newDate, originalStartTime) || toDate(newDate);
      if (!duplicateStart) {
        return res.status(400).json({ error: 'Ungültiges Startdatum für die Duplizierung' });
      }

      let duplicateEnd = originalEndTime
        ? combineDateAndTime(newDate, originalEndTime)
        : null;

      if (!duplicateEnd) {
        duplicateEnd = new Date(duplicateStart.getTime() + Math.max(durationMs, 0));
      }

      startTimestamp = duplicateStart.toISOString();
      endTimestamp = duplicateEnd.toISOString();
    }

    const normalizedAttachments = normalizeAttachments(original.attachments);
    const normalizedTags = normalizeTags(original.tags);
    const normalizedAttendees = normalizeAttendees(original.attendees);
    const coverImage = firstImageUrl(normalizedAttachments) || original.cover_image || null;

    const result = await pool.query(
      `INSERT INTO calendar_events (
        title, description, start_time, end_time, all_day,
        event_type, color, location, attendees, attachments, cover_image,
        priority, status, category, reminder, notes, tags,
        is_recurring, recurrence_pattern, recurrence_end_date,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9::jsonb, $10::jsonb, $11,
        $12, $13, $14, $15, $16, $17::jsonb,
        $18, $19, $20,
        $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *`,
      [
        original.title,
        original.description,
        startTimestamp,
        endTimestamp,
        original.all_day,
        original.event_type,
        original.color,
        original.location,
        JSON.stringify(normalizedAttendees),
        JSON.stringify(normalizedAttachments),
        coverImage,
        original.priority || 'medium',
        original.status || 'confirmed',
        original.category || 'work',
        original.reminder ?? 15,
        original.notes || null,
        JSON.stringify(normalizedTags),
        original.is_recurring || false,
        original.recurrence_pattern || null,
        original.recurrence_end_date || null,
        req.user.id
      ]
    );

    const duplicatedEvent = transformEventRow(result.rows[0]);

    const io = getIO();
    if (io) {
      io.emit('schedule:event_created', {
        event: duplicatedEvent,
        user: {
          id: req.user.id,
          name: req.user.name
        }
      });
    }

    logger.info('Event duplicated', {
      originalId: id,
      newId: duplicatedEvent.id,
      userId: req.user.id,
      targetDate: newDate
    });

    auditLogger.logDataChange('create', req.user.id, 'calendar_event', duplicatedEvent.id, {
      action: 'duplicate',
      originalId: Number(id),
      start_time: startTimestamp,
      end_time: endTimestamp
    });

    res.status(201).json(duplicatedEvent);

  } catch (error) {
    logger.error('Error duplicating event', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
