const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('./logger');

const MIGRATIONS_TABLE = 'schema_migrations';
const DUPLICATE_ERROR_CODES = new Set(['42P07', '42701', '42703', '42710', '23505']);

const migrationsDir = path.join(__dirname, '..', 'migrations');

function isIgnorableError(error) {
  if (!error) {
    return false;
  }

  if (DUPLICATE_ERROR_CODES.has(error.code)) {
    return true;
  }

  return /already exists/i.test(error.message || '') ||
         /duplicate key value violates unique constraint/i.test(error.message || '');
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => row.name));
}

async function listMigrationFiles() {
  try {
    const files = await fs.readdir(migrationsDir);
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('PostgreSQL migrations directory not found', { migrationsDir });
      return [];
    }
    throw error;
  }
}

async function applyMigration(fileName) {
  const filePath = path.join(migrationsDir, fileName);
  const sql = await fs.readFile(filePath, 'utf8');
  const startedAt = Date.now();

  logger.info('Applying PostgreSQL migration', { migration: fileName });

  try {
    await pool.query(sql);
    await pool.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      [fileName]
    );

    logger.info('Migration applied successfully', {
      migration: fileName,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    if (isIgnorableError(error)) {
      logger.warn('Migration appears to be already applied, recording as completed', {
        migration: fileName,
        error: error.message
      });

      await pool.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [fileName]
      );
      return;
    }

    logger.error('Migration failed', error, { migration: fileName });
    throw error;
  }
}

async function runPendingMigrations() {
  await ensureMigrationsTable();

  const [files, applied] = await Promise.all([
    listMigrationFiles(),
    getAppliedMigrations()
  ]);

  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    logger.info('No pending PostgreSQL migrations');
    return;
  }

  logger.info('Running pending PostgreSQL migrations', { count: pending.length });

  for (const file of pending) {
    await applyMigration(file);
  }

  logger.info('All pending PostgreSQL migrations executed');
}

module.exports = {
  runPendingMigrations,
};
