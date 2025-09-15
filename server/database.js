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

  // Create weekly_schedules table (keep for backward compatibility)
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

  // Create events table for calendar (new)
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      start_time TEXT,
      end_time TEXT,
      type TEXT DEFAULT 'Arbeit',
      is_all_day BOOLEAN DEFAULT 0,
      is_recurring BOOLEAN DEFAULT 0,
      recurrence_pattern TEXT, -- 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
      recurrence_end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create tasks table for Kanban board (new)
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo', -- 'todo', 'inprogress', 'review', 'done'
      priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
      assignee_id INTEGER,
      due_date DATETIME,
      tags TEXT, -- JSON array of tags
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
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

  // Create messages table (enhanced)
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      message TEXT NOT NULL,
      is_group BOOLEAN DEFAULT 0,
      read_status BOOLEAN DEFAULT 0,
      delivered_status BOOLEAN DEFAULT 1,
      message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'location'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create waste_items table (enhanced)
  db.run(`
    CREATE TABLE IF NOT EXISTS waste_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      disposal_instructions TEXT NOT NULL,
      next_disposal_date DATE,
      color TEXT DEFAULT '#A9D08E',
      icon TEXT DEFAULT 'trash',
      template_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES waste_templates (id) ON DELETE SET NULL
    )
  `);

  // Create waste_templates table (new)
  db.run(`
    CREATE TABLE IF NOT EXISTS waste_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      disposal_instructions TEXT NOT NULL,
      color TEXT DEFAULT '#A9D08E',
      icon TEXT DEFAULT 'trash',
      default_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
      default_next_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create system_flags table
  db.run(`
    CREATE TABLE IF NOT EXISTS system_flags (
      name TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Insert default waste templates if none exist
  db.get("SELECT COUNT(*) as count FROM waste_templates", (err, row) => {
    if (err) {
      console.error('Error checking waste templates:', err.message);
      return;
    }
    
    if (row.count === 0) {
      const defaultTemplates = [
        {
          name: 'Bioabfall',
          description: 'Organische Abfälle aus Küche und Garten',
          disposal_instructions: 'Bioabfallbehälter alle 2 Wochen am Dienstag rausstellen.\nNicht erlaubt: Plastik, Metall, Glas.',
          color: '#A9D08E',
          icon: 'bio',
          default_frequency: 'biweekly',
          default_next_date: null
        },
        {
          name: 'Papiertonne',
          description: 'Altpapier und Kartonagen',
          disposal_instructions: 'Papiertonnen monatlich am Freitag rausstellen.\nNicht erlaubt: verschmutztes Papier, Tapeten, Foto- und Faxpapier.',
          color: '#D9E1F2',
          icon: 'paper',
          default_frequency: 'monthly',
          default_next_date: null
        },
        {
          name: 'Restmüll',
          description: 'Nicht-recyclebare Abfälle',
          disposal_instructions: 'Restmülltonnen wöchentlich am Montag rausstellen.\nNicht erlaubt: Wertstoffe, Elektroschrott, Sondermüll.',
          color: '#F4B084',
          icon: 'trash',
          default_frequency: 'weekly',
          default_next_date: null
        },
        {
          name: 'Gelber Sack',
          description: 'Verpackungen aus Plastik, Metall und Verbundstoffen',
          disposal_instructions: 'Gelbe Säcke alle 2 Wochen am Mittwoch rausstellen.\nNicht erlaubt: Elektroschrott, Batterien, Glas.',
          color: '#FFD700',
          icon: 'plastic',
          default_frequency: 'biweekly',
          default_next_date: null
        }
      ];

      defaultTemplates.forEach(template => {
        db.run(
          `INSERT INTO waste_templates (
            name, description, disposal_instructions, color, icon, 
            default_frequency, default_next_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            template.name,
            template.description,
            template.disposal_instructions,
            template.color,
            template.icon,
            template.default_frequency,
            template.default_next_date
          ]
        );
      });
      
      console.log('Default waste templates inserted');
    }
  });

  // Insert default tasks if none exist
  db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
    if (err) {
      console.error('Error checking tasks:', err.message);
      return;
    }
    
    if (row.count === 0) {
      // Get first user as assignee
      db.get("SELECT id FROM users LIMIT 1", (err, user) => {
        if (err || !user) {
          console.error('Error getting user for default tasks:', err?.message);
          return;
        }
        
        const defaultTasks = [
          {
            title: 'Wochenplanung abschließen',
            description: 'Stelle sicher, dass alle Arbeitszeiten für die kommende Woche eingetragen sind',
            status: 'todo',
            priority: 'high',
            assignee_id: user.id,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            tags: JSON.stringify(['planung', 'dringend'])
          },
          {
            title: 'Abfallentsorgung planen',
            description: 'Überprüfe die nächsten Entsorgungstermine für alle Abfallarten',
            status: 'inprogress',
            priority: 'medium',
            assignee_id: user.id,
            due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            tags: JSON.stringify(['abfall', 'logistik'])
          }
        ];

        defaultTasks.forEach(task => {
          db.run(
            `INSERT INTO tasks (
              title, description, status, priority, assignee_id, due_date, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              task.title,
              task.description,
              task.status,
              task.priority,
              task.assignee_id,
              task.due_date,
              task.tags
            ]
          );
        });
        
        console.log('Default tasks inserted');
      });
    }
  });

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
  db.run("CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");
  db.run("CREATE INDEX IF NOT EXISTS idx_waste_next_disposal ON waste_items(next_disposal_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_waste_template ON waste_items(template_id)");
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

// Export the database instance directly
module.exports = db;