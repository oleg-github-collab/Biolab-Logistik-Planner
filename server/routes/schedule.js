const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Helper functions
function getMonday(d) {
  d = new Date(d);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatDate(date) {
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni",
                  "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return date.getDate() + ". " + months[date.getMonth()];
}

function formatDayDate(date) {
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${dayName}, ${day}.${month}.${year}`;
}

function formatDateForDB(date) {
  return date.toISOString().split('T')[0];
}

// @route   GET /api/schedule/current-week
// @desc    Get current week info
router.get('/current-week', (req, res) => {
  try {
    const today = new Date();
    const weekStart = getMonday(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekNumber = getWeekNumber(weekStart);
    const weekName = `Woche ${weekNumber}. ${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    
    res.json({
      weekName,
      weekStart: formatDateForDB(weekStart),
      weekEnd: formatDateForDB(weekEnd),
      weekNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/schedule/my-schedule
// @desc    Get current week schedule for logged in user
router.get('/my-schedule', auth, (req, res) => {
  try {
    const today = new Date();
    const weekStart = getMonday(today);
    const weekStartStr = formatDateForDB(weekStart);
    
    db.all(
      "SELECT * FROM weekly_schedules WHERE user_id = ? AND week_start = ? ORDER BY day_of_week",
      [req.user.id, weekStartStr],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        // Initialize schedule for all 7 days if not exists
        const schedule = [];
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          
          const existingEntry = rows.find(row => row.day_of_week === i);
          
          if (existingEntry) {
            schedule.push({
              id: existingEntry.id,
              dayOfWeek: i,
              dayName: formatDayDate(dayDate),
              startTime: existingEntry.start_time || '',
              endTime: existingEntry.end_time || '',
              status: existingEntry.status || 'Arbeit'
            });
          } else {
            schedule.push({
              dayOfWeek: i,
              dayName: formatDayDate(dayDate),
              startTime: '',
              endTime: '',
              status: 'Arbeit'
            });
          }
        }
        
        res.json(schedule);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/schedule/update-day
// @desc    Update a day in the current week schedule
router.put('/update-day', auth, (req, res) => {
  const { dayOfWeek, startTime, endTime, status } = req.body;
  
  try {
    // Validate inputs
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'Invalid day of week' });
    }
    
    const validStatuses = ['Arbeit', 'Urlaub', 'Krankheit', 'Abwesend'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const today = new Date();
    const weekStart = getMonday(today);
    const weekStartStr = formatDateForDB(weekStart);
    
    // Check if entry exists
    db.get(
      "SELECT id FROM weekly_schedules WHERE user_id = ? AND week_start = ? AND day_of_week = ?",
      [req.user.id, weekStartStr, dayOfWeek],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (row) {
          // Update existing entry
          db.run(
            "UPDATE weekly_schedules SET start_time = ?, end_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [startTime, endTime, status, row.id],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              res.json({ message: 'Schedule updated successfully', id: row.id });
            }
          );
        } else {
          // Insert new entry
          db.run(
            "INSERT INTO weekly_schedules (user_id, week_start, day_of_week, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)",
            [req.user.id, weekStartStr, dayOfWeek, startTime, endTime, status],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              res.json({ message: 'Schedule created successfully', id: this.lastID });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/schedule/team-schedule
// @desc    Get current week schedule for all team members (admin only)
router.get('/team-schedule', auth, (req, res) => {
  try {
    const today = new Date();
    const weekStart = getMonday(today);
    const weekStartStr = formatDateForDB(weekStart);
    
    // Get all users
    db.all("SELECT id, name FROM users", (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      const teamSchedule = [];
      
      // For each user, get their schedule
      const getUserSchedule = (user, callback) => {
        db.all(
          "SELECT * FROM weekly_schedules WHERE user_id = ? AND week_start = ? ORDER BY day_of_week",
          [user.id, weekStartStr],
          (err, rows) => {
            if (err) {
              return callback(err);
            }
            
            // Initialize schedule for all 7 days if not exists
            const schedule = [];
            for (let i = 0; i < 7; i++) {
              const dayDate = new Date(weekStart);
              dayDate.setDate(dayDate.getDate() + i);
              
              const existingEntry = rows.find(row => row.day_of_week === i);
              
              if (existingEntry) {
                schedule.push({
                  id: existingEntry.id,
                  dayOfWeek: i,
                  dayName: formatDayDate(dayDate),
                  startTime: existingEntry.start_time || '',
                  endTime: existingEntry.end_time || '',
                  status: existingEntry.status || 'Arbeit'
                });
              } else {
                schedule.push({
                  dayOfWeek: i,
                  dayName: formatDayDate(dayDate),
                  startTime: '',
                  endTime: '',
                  status: 'Arbeit'
                });
              }
            }
            
            callback(null, { user: user.name, schedule });
          }
        );
      };
      
      // Process users in parallel
      let completed = 0;
      users.forEach(user => {
        getUserSchedule(user, (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          teamSchedule.push(result);
          completed++;
          
          if (completed === users.length) {
            res.json(teamSchedule);
          }
        });
      });
      
      if (users.length === 0) {
        res.json([]);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/schedule/archived
// @desc    Get archived schedules for user
router.get('/archived', auth, (req, res) => {
  try {
    db.all(
      "SELECT * FROM archived_schedules WHERE user_id = ? ORDER BY archived_at DESC",
      [req.user.id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        const archivedSchedules = rows.map(row => ({
          id: row.id,
          weekStart: row.week_start,
          archivedAt: row.archived_at,
          data: JSON.parse(row.data)
        }));
        
        res.json(archivedSchedules);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;