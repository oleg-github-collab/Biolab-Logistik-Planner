#!/usr/bin/env node

/**
 * Emergency script to apply migration 062 - bulletproof user deletion
 * Run this ASAP on production to fix FK constraints
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration062() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration 062...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/062_bulletproof_user_deletion.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📖 Migration file loaded');
    console.log('⚙️  Applying migration...');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration 062 applied successfully!');

    // Verify FK constraints
    console.log('\n🔍 Verifying FK constraints on users table...');
    const verifyResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        rc.delete_rule,
        c.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.columns c
        ON c.table_schema = tc.table_schema
       AND c.table_name = tc.table_name
       AND c.column_name = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    console.log(`\n📊 Found ${verifyResult.rows.length} FK constraints:\n`);

    const cascadeCount = verifyResult.rows.filter(r => r.delete_rule === 'CASCADE').length;
    const setNullCount = verifyResult.rows.filter(r => r.delete_rule === 'SET NULL').length;
    const noActionCount = verifyResult.rows.filter(r => r.delete_rule === 'NO ACTION').length;

    console.log(`✅ CASCADE: ${cascadeCount}`);
    console.log(`✅ SET NULL: ${setNullCount}`);
    console.log(`⚠️  NO ACTION: ${noActionCount}`);

    if (noActionCount > 0) {
      console.log('\n⚠️  WARNING: Some FK constraints still have NO ACTION:');
      verifyResult.rows
        .filter(r => r.delete_rule === 'NO ACTION')
        .forEach(r => {
          console.log(`   - ${r.table_name}.${r.column_name}`);
        });
    }

    console.log('\n✅ User deletion is now safe!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
applyMigration062().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
