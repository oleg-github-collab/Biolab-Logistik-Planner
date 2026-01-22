const { Pool } = require('pg');

async function fixMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check current state
    const migrations = await pool.query("SELECT name FROM migration_history WHERE name LIKE '016%' OR name LIKE '018%' ORDER BY name");
    console.log('Current migrations:', migrations.rows);

    // Check if message_conversations exists
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'message%'");
    console.log('Message tables:', tables.rows);

    // Delete problematic migrations from history
    await pool.query("DELETE FROM migration_history WHERE name IN ('016_message_system.sql', '018_message_pins_table.sql', '025_message_pins_table.sql')");
    console.log('✅ Deleted migration records');

    // Verify
    const after = await pool.query("SELECT name FROM migration_history WHERE name LIKE '016%' OR name LIKE '018%' ORDER BY name");
    console.log('After deletion:', after.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixMigrations();
