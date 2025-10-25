const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const auditLogger = require('../utils/auditLog');
const logger = require('../utils/logger');

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

    // If no schedule exists for this week, create empty schedule
    if (result.rows.length === 0) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const insertResult = await pool.query(
          `INSERT INTO weekly_schedules (
            user_id, week_start, day_of_week, is_working, start_time, end_time,
            last_updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [targetUserId, weekStart, i, false, null, null, req.user.id]
        );
        days.push(insertResult.rows[0]);
      }

      logger.info('Created empty schedule for week', {
        userId: targetUserId,
        weekStart
      });

      return res.json(days);
    }

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching week schedule', error);
    res.status(500).json({ error: 'Server error' });
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
      return res.status(404).json({ error: 'User not found' });
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
    res.status(500).json({ error: 'Server error' });
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
      return res.status(404).json({ error: 'User not found' });
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
    res.status(500).json({ error: 'Server error' });
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
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate time range if working
    if (isWorking && startTime && endTime) {
      const hours = calculateHours(startTime, endTime);
      if (hours <= 0) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
      if (hours > 24) {
        return res.status(400).json({ error: 'Cannot schedule more than 24 hours per day' });
      }
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
        isWorking ? startTime : null,
        isWorking ? endTime : null,
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
    res.status(500).json({ error: 'Server error' });
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
      return res.status(403).json({ error: 'Unauthorized' });
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
    res.status(500).json({ error: 'Server error' });
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
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
