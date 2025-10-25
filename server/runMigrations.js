const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/biolab_logistik',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`📦 Running migration: ${file}`);

      try {
        await pool.query(sql);
        console.log(`✅ ${file} completed successfully\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${file} - tables already exist (skipping)\n`);
        } else {
          console.error(`❌ ${file} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed successfully!\n');

    // Verify tables
    console.log('🔍 Verifying database tables...');
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📊 Found ${result.rows.length} tables:`);
    result.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

    console.log('\n✅ Database is ready!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();
