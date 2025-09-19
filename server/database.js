const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
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
    enableForeignKeys();
    createCoreTables();
    createIndexes();
    seedWasteTemplates();
    handleForceFirstSetup();
    ensureFirstSetupState();
    seedDefaultTasks();
  });
}

function enableForeignKeys() {
  db.run('PRAGMA foreign_keys = ON');
}

function createCoreTables() {
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
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'Arbeit',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
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
      recurrence_pattern TEXT,
      recurrence_end_date DATETIME,
      priority TEXT DEFAULT 'medium',
      location TEXT,
      attendees TEXT,
      reminder INTEGER DEFAULT 15,
      category TEXT DEFAULT 'work',
      color TEXT DEFAULT '#3B82F6',
      tags TEXT,
      notes TEXT,
      status TEXT DEFAULT 'confirmed',
      visibility TEXT DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee_id INTEGER,
      due_date DATETIME,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS archived_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      data TEXT NOT NULL,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      message TEXT NOT NULL,
      is_group BOOLEAN DEFAULT 0,
      read_status BOOLEAN DEFAULT 0,
      delivered_status BOOLEAN DEFAULT 1,
      message_type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS waste_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      disposal_instructions TEXT NOT NULL,
      color TEXT DEFAULT '#A9D08E',
      icon TEXT DEFAULT 'trash',
      default_frequency TEXT DEFAULT 'weekly',
      default_next_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
  db.run(`
    CREATE TABLE IF NOT EXISTS event_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title_template TEXT NOT NULL,
      description_template TEXT,
      type TEXT DEFAULT 'Arbeit',
      default_duration INTEGER DEFAULT 60,
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
  db.run(`
    CREATE TABLE IF NOT EXISTS event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reminder_time DATETIME NOT NULL,
      reminder_type TEXT DEFAULT 'notification',
      message TEXT,
      is_sent BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      view_type TEXT DEFAULT 'month',
      filters TEXT,
      display_settings TEXT,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS event_sharing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      shared_with_id INTEGER NOT NULL,
      permission TEXT DEFAULT 'view',
      status TEXT DEFAULT 'pending',
      shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS system_flags (
      name TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

function createIndexes() {
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_participants
    ON messages (sender_id, receiver_id, created_at DESC)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
    ON messages (receiver_id, read_status, created_at DESC)
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user_week ON weekly_schedules(user_id, week_start)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_waste_next_disposal ON waste_items(next_disposal_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_waste_template ON waste_items(template_id)');
}

function seedWasteTemplates() {
  db.get('SELECT COUNT(*) as count FROM waste_templates', (err, row) => {
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

      defaultTemplates.forEach((template) => {
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
}

function handleForceFirstSetup() {
  const forceFirstSetup = process.env.FORCE_FIRST_SETUP === 'true';

  if (forceFirstSetup) {
    console.log('FORCE_FIRST_SETUP enabled - clearing all users');
    db.run('DELETE FROM users', (err) => {
      if (err) {
        console.error('Error clearing users:', err.message);
      } else {
        console.log('All users cleared for first setup');
      }
    });
  }
}

function ensureFirstSetupState() {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users:', err.message);
      return;
    }

    if (row.count === 0) {
      console.log('No users found - initializing first setup');
      db.run("INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'false')");
      console.log('First setup initialized - waiting for admin registration');
      return;
    }

    db.get("SELECT value FROM system_flags WHERE name = 'first_setup_completed'", (flagErr, flagRow) => {
      if (flagErr) {
        console.error('Error checking first setup flag:', flagErr.message);
        return;
      }

      if (!flagRow || flagRow.value !== 'true') {
        console.log('Marking first setup as completed');
        db.run("INSERT OR REPLACE INTO system_flags (name, value) VALUES ('first_setup_completed', 'true')");
      }
    });
  });
}

function seedDefaultTasks() {
  db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
    if (err) {
      console.error('Error checking tasks:', err.message);
      return;
    }

    if (row.count !== 0) {
      return;
    }

    db.get('SELECT id FROM users LIMIT 1', (userErr, user) => {
      if (userErr) {
        console.error('Error retrieving user for default tasks:', userErr.message);
        return;
      }

      if (!user) {
        console.log('No users available yet - skipping default task seeding');
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

      defaultTasks.forEach((task) => {
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
  });
}
function isFirstSetupRequired(callback) {
  db.get('SELECT COUNT(*) as userCount FROM users', (err, userRow) => {
    if (err) {
      return callback(err, false);
    }

    if (userRow.userCount === 0) {
      return callback(null, true);
    }
    db.get("SELECT value FROM system_flags WHERE name = 'first_setup_completed'", (flagErr, flagRow) => {
      if (flagErr || !flagRow || flagRow.value !== 'true') {
        return callback(null, true);
      }
      callback(null, false);
    });
  });
}
module.exports = db;
