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

function formatDateTimeForDB(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
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
// @desc    Get current week schedule for logged in user (backward compatibility)
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
// @desc    Update a day in the current week schedule (backward compatibility)
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

// @route   GET /api/events
// @desc    Get events for a date range
router.get('/events', auth, (req, res) => {
  try {
    const { start, end, type, priority } = req.query;

    let startDate = start ? new Date(start) : new Date();
    let endDate = end ? new Date(end) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default to 1 year

    let query = `SELECT * FROM events WHERE user_id = ? AND start_date >= ? AND start_date <= ?`;
    let params = [req.user.id, formatDateTimeForDB(startDate), formatDateTimeForDB(endDate)];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    query += ` ORDER BY start_date, start_time`;

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      // Process recurring events
      const processedEvents = [];

      rows.forEach(event => {
        processedEvents.push(event);

        // If recurring, generate additional instances
        if (event.is_recurring) {
          const recurringEvents = generateRecurringEvents(event, startDate, endDate);
          processedEvents.push(...recurringEvents);
        }
      });

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.json(processedEvents);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/events
// @desc    Create a new event
router.post('/events', auth, (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      type = 'Arbeit',
      isAllDay = false,
      isRecurring = false,
      recurrencePattern = null,
      recurrenceEndDate = null,
      priority = 'medium',
      location = null,
      attendees = null,
      reminder = 15,
      category = 'work'
    } = req.body;

    // Validate inputs
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    // Validate time consistency
    if (!isAllDay && startTime && endTime) {
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      const startMinute = parseInt(startTime.split(':')[1]);
      const endMinute = parseInt(endTime.split(':')[1]);

      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (startTotal >= endTotal) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    // Validate attendees emails
    if (attendees) {
      const emails = attendees.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const invalidEmails = emails.filter(email => email && !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return res.status(400).json({ error: `Invalid email addresses: ${invalidEmails.join(', ')}` });
      }
    }

    const startDateTime = new Date(startDate);
    const endDateTime = endDate ? new Date(endDate) : null;

    db.run(
      `INSERT INTO events (
        user_id, title, description, start_date, end_date, start_time, end_time,
        type, is_all_day, is_recurring, recurrence_pattern, recurrence_end_date,
        priority, location, attendees, reminder, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        description?.trim() || null,
        formatDateTimeForDB(startDateTime),
        endDateTime ? formatDateTimeForDB(endDateTime) : null,
        startTime || null,
        endTime || null,
        type,
        isAllDay ? 1 : 0,
        isRecurring ? 1 : 0,
        isRecurring ? recurrencePattern : null,
        isRecurring && recurrenceEndDate ? formatDateTimeForDB(new Date(recurrenceEndDate)) : null,
        priority,
        location?.trim() || null,
        attendees?.trim() || null,
        parseInt(reminder) || 15,
        category
      ],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        db.get(
          "SELECT * FROM events WHERE id = ?",
          [this.lastID],
          (err, event) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }

            res.status(201).json(event);
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/events/:id
// @desc    Update an event
router.put('/events/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      startDate, 
      endDate, 
      startTime, 
      endTime, 
      type,
      isAllDay,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate
    } = req.body;
    
    // First, verify the event belongs to the user
    db.get(
      "SELECT id FROM events WHERE id = ? AND user_id = ?",
      [id, req.user.id],
      (err, event) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!event) {
          return res.status(404).json({ error: 'Event not found or access denied' });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (title !== undefined) {
          updates.push("title = ?");
          values.push(title);
        }
        
        if (description !== undefined) {
          updates.push("description = ?");
          values.push(description || null);
        }
        
        if (startDate !== undefined) {
          updates.push("start_date = ?");
          values.push(formatDateTimeForDB(new Date(startDate)));
        }
        
        if (endDate !== undefined) {
          updates.push("end_date = ?");
          values.push(endDate ? formatDateTimeForDB(new Date(endDate)) : null);
        }
        
        if (startTime !== undefined) {
          updates.push("start_time = ?");
          values.push(startTime || null);
        }
        
        if (endTime !== undefined) {
          updates.push("end_time = ?");
          values.push(endTime || null);
        }
        
        if (type !== undefined) {
          updates.push("type = ?");
          values.push(type);
        }
        
        if (isAllDay !== undefined) {
          updates.push("is_all_day = ?");
          values.push(isAllDay ? 1 : 0);
        }
        
        if (isRecurring !== undefined) {
          updates.push("is_recurring = ?");
          values.push(isRecurring ? 1 : 0);
        }
        
        if (recurrencePattern !== undefined) {
          updates.push("recurrence_pattern = ?");
          values.push(isRecurring ? recurrencePattern : null);
        }
        
        if (recurrenceEndDate !== undefined) {
          updates.push("recurrence_end_date = ?");
          values.push(isRecurring && recurrenceEndDate ? formatDateTimeForDB(new Date(recurrenceEndDate)) : null);
        }
        
        updates.push("updated_at = CURRENT_TIMESTAMP");
        
        if (updates.length === 1) { // Only updated_at was added
          return res.status(400).json({ error: 'No fields to update' });
        }
        
        const query = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);
        
        db.run(query, values, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          db.get(
            "SELECT * FROM events WHERE id = ?",
            [id],
            (err, updatedEvent) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              
              res.json(updatedEvent);
            }
          );
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event
router.delete('/events/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    
    // First, verify the event belongs to the user
    db.get(
      "SELECT id FROM events WHERE id = ? AND user_id = ?",
      [id, req.user.id],
      (err, event) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!event) {
          return res.status(404).json({ error: 'Event not found or access denied' });
        }
        
        db.run(
          "DELETE FROM events WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }
            
            res.json({ message: 'Event deleted successfully' });
          }
        );
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

// Helper function to generate recurring events
function generateRecurringEvents(baseEvent, startDate, endDate) {
  const events = [];
  const eventStartDate = new Date(baseEvent.start_date);
  const recurrenceEndDate = baseEvent.recurrence_end_date ? new Date(baseEvent.recurrence_end_date) : endDate;

  let currentDate = new Date(eventStartDate);
  let instanceCount = 0;
  const maxInstances = 100; // Prevent infinite loops

  while (currentDate <= recurrenceEndDate && currentDate <= endDate && instanceCount < maxInstances) {
    // Skip the original event date
    if (currentDate.getTime() !== eventStartDate.getTime() && currentDate >= startDate) {
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_${instanceCount}`,
        start_date: formatDateTimeForDB(currentDate),
        is_recurring_instance: true,
        parent_event_id: baseEvent.id
      });
    }

    // Calculate next occurrence
    switch (baseEvent.recurrence_pattern) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        break;
    }

    instanceCount++;
  }

  return events;
}

// @route   GET /api/events/statistics
// @desc    Get event statistics for dashboard
router.get('/events/statistics', auth, (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;

    let startDate = new Date();
    let endDate = new Date();

    switch (timeframe) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    db.all(
      `SELECT
        type,
        priority,
        COUNT(*) as count,
        COUNT(CASE WHEN is_all_day = 1 THEN 1 END) as all_day_count
       FROM events
       WHERE user_id = ? AND start_date >= ? AND start_date <= ?
       GROUP BY type, priority`,
      [req.user.id, formatDateTimeForDB(startDate), formatDateTimeForDB(endDate)],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        // Process statistics
        const statistics = {
          totalEvents: rows.reduce((sum, row) => sum + row.count, 0),
          byType: {},
          byPriority: {},
          allDayEvents: rows.reduce((sum, row) => sum + row.all_day_count, 0)
        };

        rows.forEach(row => {
          if (!statistics.byType[row.type]) {
            statistics.byType[row.type] = 0;
          }
          statistics.byType[row.type] += row.count;

          if (!statistics.byPriority[row.priority]) {
            statistics.byPriority[row.priority] = 0;
          }
          statistics.byPriority[row.priority] += row.count;
        });

        res.json(statistics);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/events/bulk
// @desc    Create multiple events at once
router.post('/events/bulk', auth, (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    if (events.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 events can be created at once' });
    }

    const createdEvents = [];
    let processedCount = 0;

    events.forEach((eventData, index) => {
      const {
        title,
        description,
        startDate,
        endDate,
        startTime,
        endTime,
        type = 'Arbeit',
        isAllDay = false,
        priority = 'medium',
        location = null,
        category = 'work'
      } = eventData;

      // Validate required fields
      if (!title?.trim() || !startDate) {
        return res.status(400).json({
          error: `Event ${index + 1}: Title and start date are required`
        });
      }

      const startDateTime = new Date(startDate);
      const endDateTime = endDate ? new Date(endDate) : null;

      db.run(
        `INSERT INTO events (
          user_id, title, description, start_date, end_date, start_time, end_time,
          type, is_all_day, priority, location, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          title.trim(),
          description?.trim() || null,
          formatDateTimeForDB(startDateTime),
          endDateTime ? formatDateTimeForDB(endDateTime) : null,
          startTime || null,
          endTime || null,
          type,
          isAllDay ? 1 : 0,
          priority,
          location?.trim() || null,
          category
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Server error creating events' });
          }

          db.get(
            "SELECT * FROM events WHERE id = ?",
            [this.lastID],
            (err, event) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }

              createdEvents.push(event);
              processedCount++;

              if (processedCount === events.length) {
                res.status(201).json({
                  message: `${createdEvents.length} events created successfully`,
                  events: createdEvents
                });
              }
            }
          );
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
