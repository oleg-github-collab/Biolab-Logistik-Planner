const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize database
const dbPath = path.join(dataDir, 'biolab.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the Biolab Logistik Planner database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create weekly_schedules table
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'Arbeit',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create archived_schedules table
  db.run(`
    CREATE TABLE IF NOT EXISTS archived_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      data TEXT NOT NULL, -- JSON string of the schedule
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      message TEXT NOT NULL,
      is_group BOOLEAN DEFAULT 0,
      read_status BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create waste_items table
  db.run(`
    CREATE TABLE IF NOT EXISTS waste_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      disposal_instructions TEXT NOT NULL,
      next_disposal_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if FORCE_FIRST_SETUP environment variable is set
  const forceFirstSetup = process.env.FORCE_FIRST_SETUP === 'true';
  
  if (forceFirstSetup) {
    console.log('FORCE_FIRST_SETUP enabled - clearing all users');
    db.run("DELETE FROM users", (err) => {
      if (err) {
        console.error('Error clearing users:', err.message);
      } else {
        console.log('All users cleared for first setup');
      }
    });
  }

  // Insert default users if none exist
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) {
      console.error('Error checking users:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('No users found - initializing first setup');
      
      // Create a special flag to indicate first setup
      db.run("CREATE TABLE IF NOT EXISTS system_flags (name TEXT PRIMARY KEY, value TEXT)");
      db.run("INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'false')");
      
      console.log('First setup initialized - waiting for admin registration');
    } else {
      // Check if first setup was completed
      db.get("SELECT value FROM system_flags WHERE name = 'first_setup_completed'", (err, row) => {
        if (err || !row) {
          console.log('Marking first setup as completed');
          db.run("INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')");
        }
      });
    }
  });

  // Create indexes for better performance
  db.run("CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user_week ON weekly_schedules(user_id, week_start)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");
  db.run("CREATE INDEX IF NOT EXISTS idx_waste_next_disposal ON waste_items(next_disposal_date)");
}

// Add function to check if first setup is required
function isFirstSetupRequired(callback) {
  db.get("SELECT COUNT(*) as userCount FROM users", (err, userRow) => {
    if (err) {
      return callback(err, false);
    }
    
    if (userRow.userCount === 0) {
      return callback(null, true);
    }
    
    // Check system flag
    db.get("SELECT value FROM system_flags WHERE name = 'first_setup_completed'", (err, flagRow) => {
      if (err || !flagRow || flagRow.value !== 'true') {
        return callback(null, true);
      }
      callback(null, false);
    });
  });
}

module.exports = { 
  db: db, 
  isFirstSetupRequired: isFirstSetupRequired 
};