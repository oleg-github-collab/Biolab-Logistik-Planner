// Manual migration runner for migration 060
// Run this with: node run-migration-060.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🚀 Starting migration 060...\n');

  const migrationPath = path.join(__dirname, 'server/migrations/060_fix_all_user_fks_for_deletion.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📋 Migration SQL:\n');
  console.log(sql);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    console.log('⏳ Executing migration...\n');
    await pool.query(sql);
    console.log('✅ Migration 060 executed successfully!\n');

    // Record in schema_migrations
    await pool.query(
      `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      ['060_fix_all_user_fks_for_deletion.sql']
    );
    console.log('✅ Migration recorded in schema_migrations\n');

    // Verify FK constraints
    console.log('🔍 Verifying FK constraints on users table:\n');
    const result = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    console.log('FK Constraints to users table:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Code:', error.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
