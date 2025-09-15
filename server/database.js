const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); // Add this require

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Insert default users if none exist
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) {
      console.error('Error checking users:', err.message);
      return;
    }
    
    if (row.count === 0) {
      try {
        // Define default users
        const defaultUsers = [
          { name: "Sebastian", email: "sebastian@example.com", password: "password123", role: "employee" },
          { name: "Lukas", email: "lukas@example.com", password: "password123", role: "employee" },
          { name: "Manager", email: "manager@example.com", password: "password123", role: "admin" }
        ];

        // Hash passwords and insert users
        for (const user of defaultUsers) {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          
          db.run(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [user.name, user.email, hashedPassword, user.role],
            (err) => {
              if (err) {
                console.error(`Error inserting user ${user.name}:`, err.message);
              } else {
                console.log(`User ${user.name} inserted successfully`);
              }
            }
          );
        }
        
        console.log('Default users inserted with hashed passwords');
      } catch (error) {
        console.error('Error hashing passwords:', error);
      }
    }
  });

  // Create indexes for better performance
  db.run("CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user_week ON weekly_schedules(user_id, week_start)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");
  db.run("CREATE INDEX IF NOT EXISTS idx_waste_next_disposal ON waste_items(next_disposal_date)");
}

module.exports = db;