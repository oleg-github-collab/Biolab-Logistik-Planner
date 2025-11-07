/**
 * System Health Check Script
 * Verifies database integrity and system functionality
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/biolab_logistik',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
  console.log('\n=== DATABASE HEALTH CHECK ===\n');

  const checks = [
    {
      name: 'Users',
      query: 'SELECT COUNT(*) as count FROM users'
    },
    {
      name: 'Calendar Events',
      query: 'SELECT COUNT(*) as count FROM calendar_events'
    },
    {
      name: 'Tasks',
      query: 'SELECT COUNT(*) as count FROM tasks'
    },
    {
      name: 'KB Categories',
      query: 'SELECT COUNT(*) as count FROM kb_categories'
    },
    {
      name: 'KB Articles',
      query: 'SELECT COUNT(*) as count FROM kb_articles'
    },
    {
      name: 'Waste Categories',
      query: 'SELECT COUNT(*) as count FROM waste_categories'
    },
    {
      name: 'Waste Items',
      query: 'SELECT COUNT(*) as count FROM waste_items'
    },
    {
      name: 'Messages',
      query: 'SELECT COUNT(*) as count FROM messages'
    }
  ];

  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      const count = result.rows[0]?.count || 0;
      const status = count > 0 ? '✅' : '⚠️';
      console.log(`${status} ${check.name}: ${count} records`);
    } catch (error) {
      console.log(`❌ ${check.name}: ERROR - ${error.message}`);
    }
  }
}

async function checkTableColumns() {
  console.log('\n=== TABLE STRUCTURE CHECK ===\n');

  const tables = [
    { name: 'calendar_events', expected: ['id', 'title', 'start_time', 'end_time', 'event_type'] },
    { name: 'waste_items', expected: ['id', 'kanban_task_id', 'display_order', 'assigned_to'] },
    { name: 'kb_articles', expected: ['id', 'current_version', 'last_edited_by'] },
    { name: 'tasks', expected: ['id', 'title', 'status', 'assigned_to'] }
  ];

  for (const table of tables) {
    try {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table.name]);

      const columns = result.rows.map(r => r.column_name);
      const missing = table.expected.filter(col => !columns.includes(col));

      if (missing.length === 0) {
        console.log(`✅ ${table.name}: All required columns present`);
      } else {
        console.log(`⚠️  ${table.name}: Missing columns: ${missing.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ ${table.name}: ERROR - ${error.message}`);
    }
  }
}

async function checkIndexes() {
  console.log('\n=== INDEX CHECK ===\n');

  const indexes = [
    { table: 'calendar_events', column: 'start_time' },
    { table: 'calendar_events', column: 'created_by' },
    { table: 'tasks', column: 'assigned_to' },
    { table: 'waste_items', column: 'display_order' },
    { table: 'kb_articles', column: 'category_id' }
  ];

  for (const idx of indexes) {
    try {
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = $1
        AND indexname LIKE '%' || $2 || '%'
      `, [idx.table, idx.column]);

      if (result.rows.length > 0) {
        console.log(`✅ Index on ${idx.table}.${idx.column}`);
      } else {
        console.log(`⚠️  No index on ${idx.table}.${idx.column}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${idx.table}.${idx.column}: ${error.message}`);
    }
  }
}

async function checkConstraints() {
  console.log('\n=== FOREIGN KEY CONSTRAINTS ===\n');

  try {
    const result = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `);

    console.log(`Total Foreign Keys: ${result.rows.length}`);

    // Check specific important FKs
    const important = [
      'calendar_events.created_by -> users.id',
      'tasks.assigned_to -> users.id',
      'waste_items.kanban_task_id -> tasks.id',
      'kb_articles.category_id -> kb_categories.id'
    ];

    for (const fk of important) {
      const found = result.rows.find(r =>
        fk.includes(r.table_name) &&
        fk.includes(r.column_name)
      );

      if (found) {
        console.log(`✅ ${fk}`);
      } else {
        console.log(`⚠️  ${fk} - Not found`);
      }
    }
  } catch (error) {
    console.log(`❌ Error checking constraints: ${error.message}`);
  }
}

async function testDataIntegrity() {
  console.log('\n=== DATA INTEGRITY CHECK ===\n');

  // Check for orphaned records
  try {
    const orphanedTasks = await pool.query(`
      SELECT COUNT(*) as count
      FROM tasks t
      WHERE t.assigned_to IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.assigned_to)
    `);

    if (orphanedTasks.rows[0].count > 0) {
      console.log(`⚠️  Found ${orphanedTasks.rows[0].count} tasks with invalid assigned_to`);
    } else {
      console.log(`✅ No orphaned task assignments`);
    }
  } catch (error) {
    console.log(`❌ Error checking task assignments: ${error.message}`);
  }

  // Check for events without creators
  try {
    const orphanedEvents = await pool.query(`
      SELECT COUNT(*) as count
      FROM calendar_events e
      WHERE e.created_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.created_by)
    `);

    if (orphanedEvents.rows[0].count > 0) {
      console.log(`⚠️  Found ${orphanedEvents.rows[0].count} events with invalid creator`);
    } else {
      console.log(`✅ No orphaned events`);
    }
  } catch (error) {
    console.log(`❌ Error checking event creators: ${error.message}`);
  }
}

async function run() {
  try {
    console.log('🔍 Starting system health check...\n');
    console.log(`Database: ${process.env.DATABASE_URL ? 'Railway (Production)' : 'Local'}\n`);

    await checkDatabase();
    await checkTableColumns();
    await checkIndexes();
    await checkConstraints();
    await testDataIntegrity();

    console.log('\n=== HEALTH CHECK COMPLETE ===\n');
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

run();
