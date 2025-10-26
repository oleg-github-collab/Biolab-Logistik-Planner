/**
 * Postgres-Neuaufbau für den Biolab Logistik Planner
 * ------------------------------------------------------------------
 * - Löscht das komplette public-Schema
 * - Führt alle SQL-Migrationen aus (001 … 00x)
 * - Befüllt die Datenbank mit deutschsprachigen Standarddaten
 *
 * Achtung: Dieser Vorgang ist destruktiv und entfernt ALLE Daten.
 */

const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
require('dotenv').config();

const database = require('../config/database');
const logger = require('../utils/logger');

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function resetSchema() {
  logger.info('🔄 Entferne bestehendes public-Schema…');
  await database.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public AUTHORIZATION CURRENT_USER;
    GRANT ALL ON SCHEMA public TO CURRENT_USER;
    GRANT USAGE ON SCHEMA public TO public;
  `);
  logger.info('✅ Schema erfolgreich zurückgesetzt.');
}

async function runSqlFile(fileName) {
  const filePath = path.join(migrationsDir, fileName);
  const sql = await fs.readFile(filePath, 'utf8');
  logger.info(`📄 Migration ${fileName} wird ausgeführt…`);
  await database.query(sql);
  logger.info(`✅ Migration ${fileName} abgeschlossen.`);
}

async function runMigrations() {
  logger.info('🚀 Starte SQL-Migrationen…');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await runSqlFile(file);
  }
  logger.info('✅ Alle Migrationen erfolgreich ausgeführt.');
}

async function seedDefaultUsers() {
  logger.info('👥 Lege Standardbenutzer an…');

  const defaultUsers = [
    {
      name: 'System-Superadmin',
      email: process.env.DEFAULT_SUPERADMIN_EMAIL || 'admin@biolab-logistik.de',
      password: process.env.DEFAULT_SUPERADMIN_PASSWORD || 'SicheresPasswort!123',
      role: 'superadmin',
      employment_type: 'Vollzeit',
      weekly_hours_quota: 40,
      auto_schedule: true,
      default_start_time: '07:30',
      default_end_time: '16:30'
    },
    {
      name: 'Helena Becker',
      email: 'helena.becker@biolab-logistik.de',
      password: 'Teamleitung!123',
      role: 'admin',
      employment_type: 'Vollzeit',
      weekly_hours_quota: 38.5,
      auto_schedule: true,
      default_start_time: '08:00',
      default_end_time: '17:00'
    },
    {
      name: 'Maximilian Roth',
      email: 'max.rost@biolab-logistik.de',
      password: 'Werkstudent!123',
      role: 'employee',
      employment_type: 'Werkstudent',
      weekly_hours_quota: 20,
      auto_schedule: false,
      default_start_time: '10:00',
      default_end_time: '14:00'
    },
    {
      name: 'Sophie Kramer',
      email: 'sophie.kramer@biolab-logistik.de',
      password: 'Laboralltag!123',
      role: 'employee',
      employment_type: 'Vollzeit',
      weekly_hours_quota: 37.5,
      auto_schedule: true,
      default_start_time: '09:00',
      default_end_time: '17:30'
    }
  ];

  const createdUsers = [];

  for (const user of defaultUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 12);
    const result = await database.query(
      `INSERT INTO users (
        name, email, password, role, employment_type,
        weekly_hours_quota, auto_schedule, default_start_time,
        default_end_time, first_login_completed, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, true, CURRENT_TIMESTAMP
      )
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        employment_type = EXCLUDED.employment_type,
        weekly_hours_quota = EXCLUDED.weekly_hours_quota,
        auto_schedule = EXCLUDED.auto_schedule,
        default_start_time = EXCLUDED.default_start_time,
        default_end_time = EXCLUDED.default_end_time
      RETURNING id, name, email, role`,
      [
        user.name,
        user.email.toLowerCase(),
        hashedPassword,
        user.role,
        user.employment_type,
        user.weekly_hours_quota,
        user.auto_schedule,
        user.default_start_time,
        user.default_end_time
      ]
    );

    if (result.rows[0]) {
      createdUsers.push(result.rows[0]);
      await database.query(
        `INSERT INTO user_preferences (user_id, language, theme)
         VALUES ($1, 'de', 'light')
         ON CONFLICT (user_id)
         DO UPDATE SET language = 'de'`,
        [result.rows[0].id]
      );
    }
  }

  logger.info(`✅ ${createdUsers.length} Benutzer betriebsbereit.`);
  return createdUsers;
}

async function seedWasteTemplates() {
  logger.info('🧪 Erstelle Standard-Abfallvorlagen…');

  const templates = [
    {
      name: 'Lösungsmittel - Kanister 140603 (Aceton, Heptan, Methanol)',
      category: 'chemical',
      hazard_level: 'high',
      disposal_frequency_days: 30,
      color: '#FF6B6B',
      icon: 'chemical',
      description: 'Acetonhaltige Lösungsmittel, Heptan und Methanol in Kanistern',
      safety_instructions: 'Kanister vollständig entleeren und kennzeichnen. Monatliche Sammlung.'
    },
    {
      name: 'Säuren - Kanister 060106',
      category: 'chemical',
      hazard_level: 'critical',
      disposal_frequency_days: 7,
      color: '#E74C3C',
      icon: 'chemical',
      description: 'Saure Lösungen und Konzentrate',
      safety_instructions: 'pH-Wert dokumentieren, Kanister wöchentlich kontrollieren.'
    },
    {
      name: 'Bodenproben',
      category: 'soil',
      hazard_level: 'medium',
      disposal_frequency_days: 14,
      color: '#8D6E63',
      icon: 'bio',
      description: 'Kontaminierte und unkontaminierte Bodenproben',
      safety_instructions: 'Getrennte Sammlung nach Kontaminationsgrad, wöchentliche Sichtprüfung.'
    }
  ];

  for (const template of templates) {
    const exists = await database.query(
      'SELECT 1 FROM waste_templates WHERE name = $1 LIMIT 1',
      [template.name]
    );

    if (exists.rowCount === 0) {
      await database.query(
        `INSERT INTO waste_templates (
          name, category, hazard_level, disposal_frequency_days,
          color, icon, description, safety_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          template.name,
          template.category,
          template.hazard_level,
          template.disposal_frequency_days,
          template.color,
          template.icon,
          template.description,
          template.safety_instructions
        ]
      );
    }
  }

  logger.info('✅ Standard-Abfallvorlagen angelegt.');
}

async function seedSampleTasks(users) {
  if (users.length === 0) return;

  logger.info('🗂️ Lege Beispielaufgaben an…');

  const ownerId = users[0].id;
  const tasks = [
    {
      title: 'Schichtplanung für kommende Woche abschließen',
      description: 'Arbeitszeiten mit Laborleitung abstimmen und im Kalender hinterlegen.',
      status: 'todo',
      priority: 'high',
      assignee_id: ownerId,
      category: 'planung'
    },
    {
      title: 'Abfall-Logistik überprüfen',
      description: 'Termine für Gefahrstoffabholung prüfen und bestätigen.',
      status: 'inprogress',
      priority: 'medium',
      assignee_id: ownerId,
      category: 'abfall'
    }
  ];

  for (const task of tasks) {
    const exists = await database.query(
      'SELECT 1 FROM tasks WHERE title = $1 LIMIT 1',
      [task.title]
    );

    if (exists.rowCount === 0) {
      await database.query(
        `INSERT INTO tasks (
          title, description, status, priority, assignee_id, category, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          task.title,
          task.description,
          task.status,
          task.priority,
          task.assignee_id,
          task.category
        ]
      );
    }
  }

  logger.info('✅ Beispielaufgaben verfügbar.');
}

async function main() {
  try {
    logger.info('=================================================');
    logger.info('🧼 Biolab Logistik Planner – DB-Reset gestartet');
    logger.info('=================================================');

    await resetSchema();
    await runMigrations();

    const users = await seedDefaultUsers();
    await seedWasteTemplates();
    await seedSampleTasks(users);

    logger.info('🎉 Datenbank wurde komplett neu aufgebaut und befüllt.');
  } catch (error) {
    logger.error('❌ Reset fehlgeschlagen', { error: error.message });
    console.error(error);
    process.exitCode = 1;
  } finally {
    await database.shutdown();
  }
}

main();
