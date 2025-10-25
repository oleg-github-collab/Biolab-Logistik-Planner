const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const db = require('./database');
const schedule = require('node-schedule');
const { initializeSocket } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "http://localhost:5000", "http://localhost:3000", "https://*.railway.app", "https://*.vercel.app", "https://*.herokuapp.com"],
      "script-src": ["'self'", "'unsafe-inline'", "https://*.railway.app"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "", "https://*.railway.app", "https://*.vercel.app", "https://*.herokuapp.com"]
    }
  }
}));
app.use(morgan('combined'));

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('railway.app') ||
        origin.includes('vercel.app') ||
        origin.includes('herokuapp.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// API routes - PostgreSQL versions
app.use('/api/auth', require('./routes/auth.pg'));
app.use('/api/schedule', require('./routes/schedule.pg'));
app.use('/api/messages', require('./routes/messages.pg'));
app.use('/api/messages', require('./routes/messagesEnhanced.pg')); // Enhanced features
app.use('/api/tasks', require('./routes/tasks.pg'));
app.use('/api/task-pool', require('./routes/taskPool.pg'));
app.use('/api/kb', require('./routes/knowledgeBase.pg'));
app.use('/api/profile', require('./routes/userProfile.pg'));
app.use('/api/notifications', require('./routes/notifications.pg'));
// SQLite-only routes (to be migrated to PostgreSQL)
app.use('/api/waste', require('./routes/waste'));
app.use('/api/waste', require('./routes/wasteTemplates'));
app.use('/api/waste', require('./routes/wasteSchedule'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/health', require('./routes/health'));

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Schedule cleanup task (archive old weeks)
schedule.scheduleJob('0 1 * * 1', function() {
  const today = new Date();
  const currentWeekStart = getMonday(today);
  
  // Get last week's start date
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  // Archive data from last week for all users
  db.all("SELECT DISTINCT user_id FROM weekly_schedules WHERE week_start = ?", 
    [formatDateForDB(lastWeekStart)], 
    (err, rows) => {
      if (err) {
        console.error('Error getting users for archiving:', err.message);
        return;
      }
      
      rows.forEach(row => {
        const userId = row.user_id;
        
        // Get all schedule data for this user for last week
        db.all(
          "SELECT * FROM weekly_schedules WHERE user_id = ? AND week_start = ? ORDER BY day_of_week",
          [userId, formatDateForDB(lastWeekStart)],
          (err, scheduleData) => {
            if (err) {
              console.error('Error getting schedule ', err.message);
              return;
            }
            
            // Convert to JSON string
            const dataJSON = JSON.stringify(scheduleData);
            
            // Insert into archived_schedules
            db.run(
              "INSERT INTO archived_schedules (user_id, week_start, data) VALUES (?, ?, ?)",
              [userId, formatDateForDB(lastWeekStart), dataJSON],
              (err) => {
                if (err) {
                  console.error('Error archiving schedule:', err.message);
                  return;
                }
                
                console.log(`Archived schedule for user ${userId} for week starting ${formatDateForDB(lastWeekStart)}`);
                
                // Clear the weekly_schedules for this week
                db.run(
                  "DELETE FROM weekly_schedules WHERE user_id = ? AND week_start = ?",
                  [userId, formatDateForDB(lastWeekStart)],
                  (err) => {
                    if (err) {
                      console.error('Error clearing old schedule:', err.message);
                    }
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

// Send reminder emails every Monday at 8 AM
schedule.scheduleJob('0 8 * * 1', function() {
  // In a real app, you would integrate with an email service
  console.log('Sending weekly reminder emails...');

  db.all("SELECT name, email FROM users", (err, users) => {
    if (err) {
      console.error('Error getting users for reminders:', err.message);
      return;
    }

    users.forEach(user => {
      console.log(`Reminder sent to ${user.name} at ${user.email}`);
      // In production, integrate with Nodemailer or similar
    });
  });
});

// Check for waste disposal reminders every hour
schedule.scheduleJob('0 * * * *', function() {
  const { sendNotificationToUser } = require('./websocket');
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

  console.log('Checking for waste disposal reminders...');

  db.all(
    `SELECT
      wds.*,
      wi.name as waste_name,
      wt.hazard_level,
      wt.category,
      wt.color,
      u.name as assigned_to_name,
      u.email as assigned_to_email
    FROM waste_disposal_schedule wds
    LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
    LEFT JOIN waste_templates wt ON wi.template_id = wt.id
    LEFT JOIN users u ON wds.assigned_to = u.id
    WHERE wds.status IN ('scheduled', 'rescheduled')
      AND wds.reminder_sent = 0
      AND wds.reminder_dates IS NOT NULL`,
    (err, schedules) => {
      if (err) {
        console.error('Error fetching schedules for reminders:', err.message);
        return;
      }

      schedules.forEach(schedule => {
        try {
          const reminderDates = JSON.parse(schedule.reminder_dates || '[]');
          const scheduledDate = new Date(schedule.scheduled_date);

          // Check if any reminder date is within the next hour
          const shouldSendReminder = reminderDates.some(reminderDate => {
            const reminder = new Date(reminderDate);
            return reminder >= now && reminder <= nextHour;
          });

          if (shouldSendReminder) {
            const daysUntil = Math.ceil((scheduledDate - now) / (1000 * 60 * 60 * 24));

            // Send notification to assigned user
            if (schedule.assigned_to) {
              sendNotificationToUser(schedule.assigned_to, {
                title: 'Waste Disposal Reminder',
                body: `${schedule.waste_name} disposal scheduled ${daysUntil === 0 ? 'today' : `in ${daysUntil} day(s)`}`,
                icon: '/favicon.ico',
                tag: `waste_reminder_${schedule.id}`,
                data: {
                  url: '/waste-disposal-planner',
                  scheduleId: schedule.id
                },
                requireInteraction: schedule.hazard_level === 'critical',
                priority: schedule.hazard_level === 'critical' ? 'high' : 'normal'
              });

              console.log(`Reminder sent to ${schedule.assigned_to_name} for ${schedule.waste_name}`);
            }

            // Mark reminder as sent if it's the last one or if it's the day of disposal
            if (daysUntil <= 0) {
              db.run(
                'UPDATE waste_disposal_schedule SET reminder_sent = 1 WHERE id = ?',
                [schedule.id],
                (err) => {
                  if (err) {
                    console.error('Error updating reminder status:', err.message);
                  }
                }
              );
            }
          }
        } catch (error) {
          console.error('Error processing reminder for schedule:', schedule.id, error);
        }
      });
    }
  );
});

// Check for overdue waste disposals every day at 9 AM
schedule.scheduleJob('0 9 * * *', function() {
  const { sendNotificationToUser } = require('./websocket');
  const now = new Date();

  console.log('Checking for overdue waste disposals...');

  db.all(
    `SELECT
      wds.*,
      wi.name as waste_name,
      wt.hazard_level,
      u.name as assigned_to_name
    FROM waste_disposal_schedule wds
    LEFT JOIN waste_items wi ON wds.waste_item_id = wi.id
    LEFT JOIN waste_templates wt ON wi.template_id = wt.id
    LEFT JOIN users u ON wds.assigned_to = u.id
    WHERE wds.scheduled_date < ?
      AND wds.status IN ('scheduled', 'rescheduled')`,
    [now.toISOString()],
    (err, overdueSchedules) => {
      if (err) {
        console.error('Error fetching overdue schedules:', err.message);
        return;
      }

      // Update status to overdue
      overdueSchedules.forEach(schedule => {
        db.run(
          'UPDATE waste_disposal_schedule SET status = ? WHERE id = ?',
          ['overdue', schedule.id],
          (err) => {
            if (err) {
              console.error('Error updating overdue status:', err.message);
              return;
            }

            // Send urgent notification to assigned user
            if (schedule.assigned_to) {
              sendNotificationToUser(schedule.assigned_to, {
                title: 'OVERDUE: Waste Disposal',
                body: `${schedule.waste_name} disposal is overdue! Please complete immediately.`,
                icon: '/favicon.ico',
                tag: `waste_overdue_${schedule.id}`,
                requireInteraction: true,
                priority: 'urgent',
                data: {
                  url: '/waste-disposal-planner',
                  scheduleId: schedule.id
                }
              });

              console.log(`Overdue notification sent to ${schedule.assigned_to_name} for ${schedule.waste_name}`);
            }
          }
        );
      });

      if (overdueSchedules.length > 0) {
        console.log(`Found ${overdueSchedules.length} overdue waste disposals`);
      }
    }
  );
});

// Helper functions
function getMonday(d) {
  d = new Date(d);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateForDB(date) {
  return date.toISOString().split('T')[0];
}

// Start server with WebSocket support
const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`API Base URL: ${process.env.NODE_ENV === 'production' ? 'https://your-app.railway.app/api' : 'http://localhost:5000/api'}`);
  console.log(`WebSocket server enabled`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed');

    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('Database connection closed');
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

module.exports = app;
