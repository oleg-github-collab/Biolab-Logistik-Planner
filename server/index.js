const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/waste', require('./routes/waste'));

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Schedule cleanup task (archive old weeks)
const schedule = require('node-schedule');

// Archive old weeks every Monday at 1 AM
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
              console.error('Error getting schedule data:', err.message);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;