/**
 * PostgreSQL Migration Runner
 */

const fs = require('fs').promises;
const path = require('path');
const { pool, query } = require('../config/database');

async function runMigrations() {
  console.log('🚀 Starting PostgreSQL migrations...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '001_initial_schema.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('📄 Executing migration: 001_initial_schema.sql');

    // Execute migration
    await query(sql);

    console.log('✅ Migration completed successfully!\n');
    console.log('Database schema created with:');
    console.log('  - Users table with roles and employment types');
    console.log('  - Weekly schedules with audit trail');
    console.log('  - Work hours audit log (automatic tracking)');
    console.log('  - Messages, Tasks, Waste management');
    console.log('  - Triggers for automatic updated_at');
    console.log('  - Views for reporting\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
