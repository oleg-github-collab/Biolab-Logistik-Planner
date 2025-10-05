const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class DatabaseSeeder {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to database for seeding');
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Clear all data from tables (for fresh seeding)
   */
  async clearData() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Order matters due to foreign key constraints
        const tables = [
          'event_reminders',
          'event_sharing',
          'calendar_views',
          'event_templates',
          'waste_items',
          'messages',
          'archived_schedules',
          'tasks',
          'events',
          'weekly_schedules',
          'users'
        ];

        let completed = 0;
        tables.forEach((table) => {
          this.db.run(`DELETE FROM ${table}`, (err) => {
            if (err) {
              console.error(`Error clearing ${table}:`, err.message);
            }
            completed++;
            if (completed === tables.length) {
              console.log('All tables cleared');
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Seed users with different roles
   */
  async seedUsers() {
    console.log('Seeding users...');

    const users = [
      {
        name: 'Admin User',
        email: 'admin@biolab.com',
        password: 'Admin123!',
        role: 'admin',
        employment_type: 'Vollzeit',
        default_start_time: '08:00',
        default_end_time: '17:00',
        auto_schedule: 1
      },
      {
        name: 'Superadmin User',
        email: 'superadmin@biolab.com',
        password: 'Super123!',
        role: 'superadmin',
        employment_type: 'Vollzeit',
        default_start_time: '07:00',
        default_end_time: '18:00',
        auto_schedule: 1
      },
      {
        name: 'Max Mustermann',
        email: 'max.mustermann@biolab.com',
        password: 'Employee123!',
        role: 'employee',
        employment_type: 'Vollzeit',
        default_start_time: '09:00',
        default_end_time: '17:00',
        auto_schedule: 1
      },
      {
        name: 'Anna Schmidt',
        email: 'anna.schmidt@biolab.com',
        password: 'Employee123!',
        role: 'employee',
        employment_type: 'Werkstudent',
        default_start_time: '10:00',
        default_end_time: '14:00',
        auto_schedule: 0
      },
      {
        name: 'Peter Wagner',
        email: 'peter.wagner@biolab.com',
        password: 'Employee123!',
        role: 'employee',
        employment_type: 'Vollzeit',
        default_start_time: '08:30',
        default_end_time: '16:30',
        auto_schedule: 1
      },
      {
        name: 'Lisa Müller',
        email: 'lisa.mueller@biolab.com',
        password: 'Employee123!',
        role: 'employee',
        employment_type: 'Werkstudent',
        default_start_time: '11:00',
        default_end_time: '15:00',
        auto_schedule: 0
      }
    ];

    const createdUsers = [];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const userId = await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO users (name, email, password, role, employment_type, default_start_time, default_end_time, auto_schedule)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.name, user.email, hashedPassword, user.role, user.employment_type,
           user.default_start_time, user.default_end_time, user.auto_schedule],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      createdUsers.push({ ...user, id: userId });
      console.log(`  ✓ Created user: ${user.name} (${user.role})`);
    }

    return createdUsers;
  }

  /**
   * Seed schedules for users
   */
  async seedSchedules(users) {
    console.log('Seeding schedules...');

    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)

    let scheduleCount = 0;

    for (const user of users) {
      if (user.employment_type === 'Vollzeit') {
        // Full-time employees: Monday to Friday
        for (let day = 1; day <= 5; day++) {
          await new Promise((resolve, reject) => {
            this.db.run(
              `INSERT INTO weekly_schedules (user_id, week_start, day_of_week, start_time, end_time, status)
               VALUES (?, ?, ?, ?, ?, 'Arbeit')`,
              [user.id, currentWeekStart.toISOString().split('T')[0], day,
               user.default_start_time, user.default_end_time],
              (err) => {
                if (err) reject(err);
                else {
                  scheduleCount++;
                  resolve();
                }
              }
            );
          });
        }
      } else {
        // Part-time students: 3 random days per week
        const workDays = [1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3);
        for (const day of workDays) {
          await new Promise((resolve, reject) => {
            this.db.run(
              `INSERT INTO weekly_schedules (user_id, week_start, day_of_week, start_time, end_time, status)
               VALUES (?, ?, ?, ?, ?, 'Arbeit')`,
              [user.id, currentWeekStart.toISOString().split('T')[0], day,
               user.default_start_time, user.default_end_time],
              (err) => {
                if (err) reject(err);
                else {
                  scheduleCount++;
                  resolve();
                }
              }
            );
          });
        }
      }
    }

    console.log(`  ✓ Created ${scheduleCount} schedule entries`);
  }

  /**
   * Seed events for users
   */
  async seedEvents(users) {
    console.log('Seeding events...');

    const eventTypes = ['Arbeit', 'Urlaub', 'Krank', 'Meeting', 'Training'];
    const priorities = ['low', 'medium', 'high'];
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    let eventCount = 0;

    for (const user of users) {
      // Create 5-10 events per user
      const numEvents = Math.floor(Math.random() * 6) + 5;

      for (let i = 0; i < numEvents; i++) {
        const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + daysOffset);

        const typeIndex = Math.floor(Math.random() * eventTypes.length);
        const type = eventTypes[typeIndex];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const color = colors[typeIndex];

        const isAllDay = Math.random() > 0.7;
        const startTime = isAllDay ? null : `${String(Math.floor(Math.random() * 8) + 8).padStart(2, '0')}:00`;
        const endTime = isAllDay ? null : `${String(Math.floor(Math.random() * 4) + 14).padStart(2, '0')}:00`;

        await new Promise((resolve, reject) => {
          this.db.run(
            `INSERT INTO events (user_id, title, description, start_date, start_time, end_time, type,
             is_all_day, priority, color, status, visibility)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'private')`,
            [
              user.id,
              `${type} - ${user.name}`,
              `Auto-generated ${type.toLowerCase()} event for testing`,
              startDate.toISOString().split('T')[0],
              startTime,
              endTime,
              type,
              isAllDay ? 1 : 0,
              priority,
              color
            ],
            (err) => {
              if (err) reject(err);
              else {
                eventCount++;
                resolve();
              }
            }
          );
        });
      }
    }

    console.log(`  ✓ Created ${eventCount} events`);
  }

  /**
   * Seed tasks for the Kanban board
   */
  async seedTasks(users) {
    console.log('Seeding tasks...');

    const tasks = [
      {
        title: 'Wochenplanung erstellen',
        description: 'Arbeitszeiten für die kommende Woche planen und eintragen',
        status: 'todo',
        priority: 'high',
        tags: ['planung', 'dringend']
      },
      {
        title: 'Abfallentsorgung koordinieren',
        description: 'Termine für Sondermüll und chemische Abfälle organisieren',
        status: 'inprogress',
        priority: 'high',
        tags: ['abfall', 'logistik']
      },
      {
        title: 'Laborgeräte warten',
        description: 'Monatliche Wartung der Laborgeräte durchführen',
        status: 'todo',
        priority: 'medium',
        tags: ['wartung', 'labor']
      },
      {
        title: 'Inventur durchführen',
        description: 'Bestandsaufnahme aller Chemikalien und Verbrauchsmaterialien',
        status: 'review',
        priority: 'medium',
        tags: ['inventur', 'organisation']
      },
      {
        title: 'Sicherheitsschulung organisieren',
        description: 'Jährliche Sicherheitsschulung für alle Mitarbeiter planen',
        status: 'todo',
        priority: 'high',
        tags: ['sicherheit', 'training']
      },
      {
        title: 'Dokumentation aktualisieren',
        description: 'SOPs und Arbeitsanweisungen überprüfen und aktualisieren',
        status: 'inprogress',
        priority: 'low',
        tags: ['dokumentation']
      },
      {
        title: 'Neue Mitarbeiter einarbeiten',
        description: 'Onboarding-Prozess für neue Werkstudenten durchführen',
        status: 'done',
        priority: 'medium',
        tags: ['onboarding', 'team']
      },
      {
        title: 'Qualitätskontrolle Q1',
        description: 'Quartalsbericht zur Qualitätssicherung erstellen',
        status: 'review',
        priority: 'high',
        tags: ['qualität', 'reporting']
      }
    ];

    let taskCount = 0;

    for (const task of tasks) {
      const assignee = users[Math.floor(Math.random() * users.length)];
      const daysOffset = Math.floor(Math.random() * 30);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysOffset);

      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO tasks (title, description, status, priority, assignee_id, due_date, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            task.title,
            task.description,
            task.status,
            task.priority,
            assignee.id,
            dueDate.toISOString(),
            JSON.stringify(task.tags)
          ],
          (err) => {
            if (err) reject(err);
            else {
              taskCount++;
              resolve();
            }
          }
        );
      });
    }

    console.log(`  ✓ Created ${taskCount} tasks`);
  }

  /**
   * Seed messages between users
   */
  async seedMessages(users) {
    console.log('Seeding messages...');

    const messageTemplates = [
      'Hallo! Wie geht es dir?',
      'Können wir kurz über das Projekt sprechen?',
      'Die Abfallentsorgung wurde erfolgreich durchgeführt.',
      'Erinnerung: Meeting morgen um 10 Uhr',
      'Bitte die Dokumentation bis Freitag aktualisieren',
      'Super Arbeit beim letzten Projekt!',
      'Brauche Hilfe bei der Wochenplanung',
      'Laborgeräte wurden gewartet',
      'Neue Chemikalien sind angekommen',
      'Bitte Sicherheitsschulung nicht vergessen'
    ];

    let messageCount = 0;

    // Create 20 random messages
    for (let i = 0; i < 20; i++) {
      const sender = users[Math.floor(Math.random() * users.length)];
      let receiver = users[Math.floor(Math.random() * users.length)];

      // Ensure sender and receiver are different
      while (receiver.id === sender.id) {
        receiver = users[Math.floor(Math.random() * users.length)];
      }

      const message = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
      const readStatus = Math.random() > 0.5 ? 1 : 0;

      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO messages (sender_id, receiver_id, message, read_status)
           VALUES (?, ?, ?, ?)`,
          [sender.id, receiver.id, message, readStatus],
          (err) => {
            if (err) reject(err);
            else {
              messageCount++;
              resolve();
            }
          }
        );
      });
    }

    console.log(`  ✓ Created ${messageCount} messages`);
  }

  /**
   * Seed waste items
   */
  async seedWasteItems(users) {
    console.log('Seeding waste items...');

    const wasteData = [
      {
        name: 'Lösungsmittel Kanister #1',
        description: 'Acetonhaltige Lösungsmittel',
        disposal_instructions: 'Monatliche Entsorgung erforderlich',
        next_disposal_date: 15,
        color: '#FF6B6B',
        icon: 'chemical'
      },
      {
        name: 'Säuren Kanister #2',
        description: 'Verschiedene Säuren',
        disposal_instructions: 'Wöchentliche Kontrolle und Entsorgung',
        next_disposal_date: 7,
        color: '#E74C3C',
        icon: 'chemical'
      },
      {
        name: 'Wassereluate',
        description: 'Wässrige Extrakte',
        disposal_instructions: 'Bei 80% Füllstand entsorgen',
        next_disposal_date: 20,
        color: '#3498DB',
        icon: 'glass'
      },
      {
        name: 'Bodenproben kontaminiert',
        description: 'Kontaminierte Bodenproben aus Labor A',
        disposal_instructions: 'Spezielle Entsorgung erforderlich',
        next_disposal_date: 10,
        color: '#8D6E63',
        icon: 'bio'
      },
      {
        name: 'Leere Extraktbehälter',
        description: 'Gereinigte Behälter nach Extraktion',
        disposal_instructions: 'Sammlung alle 2 Wochen',
        next_disposal_date: 14,
        color: '#FFC107',
        icon: 'plastic'
      }
    ];

    let wasteCount = 0;

    for (const waste of wasteData) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + waste.next_disposal_date);

      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO waste_items (name, description, disposal_instructions, next_disposal_date, color, icon)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            waste.name,
            waste.description,
            waste.disposal_instructions,
            nextDate.toISOString().split('T')[0],
            waste.color,
            waste.icon
          ],
          (err) => {
            if (err) reject(err);
            else {
              wasteCount++;
              resolve();
            }
          }
        );
      });
    }

    console.log(`  ✓ Created ${wasteCount} waste items`);
  }

  /**
   * Run all seeders
   */
  async seed(clearExisting = false) {
    try {
      await this.connect();

      if (clearExisting) {
        console.log('\nClearing existing data...');
        await this.clearData();
      }

      console.log('\n=== Starting Database Seeding ===\n');

      const users = await this.seedUsers();
      await this.seedSchedules(users);
      await this.seedEvents(users);
      await this.seedTasks(users);
      await this.seedMessages(users);
      await this.seedWasteItems(users);

      console.log('\n=== Seeding Completed Successfully! ===\n');
      console.log('Test accounts created:');
      console.log('  Superadmin: superadmin@biolab.com / Super123!');
      console.log('  Admin: admin@biolab.com / Admin123!');
      console.log('  Employee: max.mustermann@biolab.com / Employee123!');
      console.log('  Employee: anna.schmidt@biolab.com / Employee123!\n');

      await this.close();
    } catch (error) {
      console.error('Seeding failed:', error);
      await this.close();
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  // Database path - check both server/data and root data directories
  let dbPath = path.join(__dirname, '..', 'data', 'biolab.db');
  if (!require('fs').existsSync(path.dirname(dbPath))) {
    dbPath = path.join(__dirname, '..', '..', 'data', 'biolab.db');
  }
  const seeder = new DatabaseSeeder(dbPath);

  const clearFlag = process.argv.includes('--clear') || process.argv.includes('-c');

  console.log('Database Seeder');
  console.log('===============\n');

  if (clearFlag) {
    console.log('⚠️  Warning: This will clear all existing data!\n');
  }

  seeder.seed(clearFlag);
}

module.exports = DatabaseSeeder;
