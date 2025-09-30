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
  db.serialize(() => {
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

  // Create events table for calendar (enhanced)
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
      priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
      location TEXT,
      attendees TEXT, -- comma-separated email addresses
      reminder INTEGER DEFAULT 15, -- minutes before event
      category TEXT DEFAULT 'work',
      color TEXT DEFAULT '#3B82F6',
      tags TEXT, -- JSON array of tags
      notes TEXT,
      status TEXT DEFAULT 'confirmed', -- 'confirmed', 'tentative', 'cancelled'
      visibility TEXT DEFAULT 'private', -- 'private', 'public', 'shared'
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
      default_frequency TEXT DEFAULT 'weekly', -- 'immediate', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
      default_next_date DATE,
      hazard_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
      waste_code TEXT,
      category TEXT DEFAULT 'general', -- 'chemical', 'heavy_metal', 'aqueous', 'hazardous', 'construction', 'soil', 'container', 'general'
      assigned_to INTEGER, -- user responsible for this waste type
      notification_users TEXT, -- JSON array of user IDs to notify
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  // Create event_templates table for quick event creation
  db.run(`
    CREATE TABLE IF NOT EXISTS event_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title_template TEXT NOT NULL,
      description_template TEXT,
      type TEXT DEFAULT 'Arbeit',
      default_duration INTEGER DEFAULT 60, -- minutes
      default_start_time TEXT DEFAULT '09:00',
      is_all_day BOOLEAN DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      location_template TEXT,
      category TEXT DEFAULT 'work',
      color TEXT DEFAULT '#3B82F6',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create event_reminders table for advanced reminder system
  db.run(`
    CREATE TABLE IF NOT EXISTS event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reminder_time DATETIME NOT NULL,
      reminder_type TEXT DEFAULT 'notification', -- 'notification', 'email', 'sms'
      message TEXT,
      is_sent BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create calendar_views table for saving custom calendar configurations
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      view_type TEXT DEFAULT 'month', -- 'month', 'week', 'day', 'agenda'
      filters TEXT, -- JSON object with filter settings
      display_settings TEXT, -- JSON object with display preferences
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create event_sharing table for shared events
  db.run(`
    CREATE TABLE IF NOT EXISTS event_sharing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      shared_with_id INTEGER NOT NULL,
      permission TEXT DEFAULT 'view', -- 'view', 'edit', 'admin'
      status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
      shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users (id) ON DELETE CASCADE
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
          name: 'Acetone - Kanister 140603',
          description: 'Acetonhaltige Lösungsmittel in Kanistern',
          disposal_instructions: 'Kanister müssen vollständig entleert und gekennzeichnet sein. Sammlung nach Bedarf oder monatlich.',
          color: '#FF6B6B',
          icon: 'chemical',
          default_frequency: 'monthly',
          default_next_date: null,
          hazard_level: 'high',
          waste_code: '140603',
          category: 'chemical'
        },
        {
          name: 'Säuren - Kanister 060106',
          description: 'Saure Lösungen und Konzentrate',
          disposal_instructions: 'Säuren in originalen Kanistern sammeln. pH-Wert dokumentieren. Wöchentliche Kontrolle.',
          color: '#E74C3C',
          icon: 'acid',
          default_frequency: 'weekly',
          default_next_date: null,
          hazard_level: 'critical',
          waste_code: '060106',
          category: 'chemical'
        },
        {
          name: 'Quecksilbereluate',
          description: 'Quecksilberhaltige Extrakte und Lösungen',
          disposal_instructions: 'Sofortige fachgerechte Entsorgung erforderlich. Spezielle Behälter verwenden.',
          color: '#8E44AD',
          icon: 'mercury',
          default_frequency: 'immediate',
          default_next_date: null,
          hazard_level: 'critical',
          waste_code: '060404',
          category: 'heavy_metal'
        },
        {
          name: 'Wassereluate',
          description: 'Wässrige Eluate aus Analysen',
          disposal_instructions: 'Sammlung in PE-Behältern. Monatliche Entsorgung oder bei 80% Füllstand.',
          color: '#3498DB',
          icon: 'water',
          default_frequency: 'monthly',
          default_next_date: null,
          hazard_level: 'medium',
          waste_code: '160216',
          category: 'aqueous'
        },
        {
          name: 'Wasserproben - Waschbecken',
          description: 'Kontaminierte Wasserproben aus Waschbecken',
          disposal_instructions: 'Tägliche Sammlung aus Laborwaschbecken. Spezielle Aufbewahrung erforderlich.',
          color: '#17A2B8',
          icon: 'sink',
          default_frequency: 'daily',
          default_next_date: null,
          hazard_level: 'medium',
          waste_code: '160216',
          category: 'aqueous'
        },
        {
          name: 'Asbest - Asbest Säcke im Lager',
          description: 'Asbesthaltige Materialien in speziellen Säcken',
          disposal_instructions: 'Nur von geschultem Personal handhaben. Lagerung in separatem Bereich. Quartalsweise Entsorgung.',
          color: '#6C757D',
          icon: 'hazmat',
          default_frequency: 'quarterly',
          default_next_date: null,
          hazard_level: 'critical',
          waste_code: '170605',
          category: 'hazardous'
        },
        {
          name: 'Asphalte',
          description: 'Asphaltproben und -reste',
          disposal_instructions: 'Sammlung in stabilen Behältern. Monatliche Entsorgung über Bauschutt-Entsorgung.',
          color: '#495057',
          icon: 'construction',
          default_frequency: 'monthly',
          default_next_date: null,
          hazard_level: 'low',
          waste_code: '170302',
          category: 'construction'
        },
        {
          name: 'Bodenproben',
          description: 'Kontaminierte und unkontaminierte Bodenproben',
          disposal_instructions: 'Getrennte Sammlung nach Kontaminationsgrad. Wöchentliche Kontrolle der Lagerung.',
          color: '#8D6E63',
          icon: 'soil',
          default_frequency: 'weekly',
          default_next_date: null,
          hazard_level: 'medium',
          waste_code: '200203',
          category: 'soil'
        },
        {
          name: 'Gefäße nach Extrakte',
          description: 'Leere Behälter nach Extraktionsverfahren',
          disposal_instructions: 'Behälter müssen gespült und getrocknet sein. Sammlung alle 2 Wochen.',
          color: '#FFC107',
          icon: 'container',
          default_frequency: 'biweekly',
          default_next_date: null,
          hazard_level: 'low',
          waste_code: '150110',
          category: 'container'
        },
        {
          name: 'Restmüll - Gewerbemüllcontainer',
          description: 'Allgemeine Abfälle ohne besondere Eigenschaften',
          disposal_instructions: 'Regelmäßige Entleerung des Gewerbemüllcontainers. Wöchentliche Abholung.',
          color: '#6C757D',
          icon: 'trash',
          default_frequency: 'weekly',
          default_next_date: null,
          hazard_level: 'low',
          waste_code: '200301',
          category: 'general'
        }
      ];

      defaultTemplates.forEach(template => {
        db.run(
          `INSERT INTO waste_templates (
            name, description, disposal_instructions, color, icon,
            default_frequency, default_next_date, hazard_level, waste_code, category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            template.name,
            template.description,
            template.disposal_instructions,
            template.color,
            template.icon,
            template.default_frequency,
            template.default_next_date,
            template.hazard_level,
            template.waste_code,
            template.category
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
        if (err) {
          console.error('Error getting user for default tasks:', err.message);
          return;
        }

        if (!user) {
          console.log('Skipping default task seeding - no users available yet.');
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
      console.log('No users found - creating default superadmin account');

      const defaultSuperAdmin = {
        name: process.env.DEFAULT_SUPERADMIN_NAME || 'System Superadmin',
        email: process.env.DEFAULT_SUPERADMIN_EMAIL || 'work.olegkaminskyi@gmail.com',
        password: process.env.DEFAULT_SUPERADMIN_PASSWORD || 'QwertY24$',
      };

      try {
        const hashedPassword = await bcrypt.hash(defaultSuperAdmin.password, 12);

        await new Promise((resolve, reject) => {
          db.run(
            "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, 'superadmin', datetime('now'))",
            [
              defaultSuperAdmin.name,
              defaultSuperAdmin.email,
              hashedPassword
            ],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this);
              }
            }
          );
        });

        db.run("INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')");

        console.log(`Default superadmin account ready (email: ${defaultSuperAdmin.email})`);
      } catch (seedError) {
        console.error('Failed to create default superadmin account:', seedError.message);
      }
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
  });
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
