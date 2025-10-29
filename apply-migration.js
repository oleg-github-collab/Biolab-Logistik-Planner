const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  try {
    const migrationFile = process.argv[2] || 'server/migrations/002_fix_task_pool.sql';
    const migrationPath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Applying migration: ${path.basename(migrationFile)}`);
    await pool.query(sql);
    console.log('✓ Migration applied successfully');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
