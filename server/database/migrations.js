const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class MigrationRunner {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.migrationsDir = path.join(__dirname, 'migrations');
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
          console.log('Connected to database for migrations');
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
   * Create migrations tracking table if it doesn't exist
   */
  ensureMigrationsTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          batch INTEGER NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Migrations table ready');
          resolve();
        }
      });
    });
  }

  /**
   * Get all executed migrations
   */
  getExecutedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT name, batch FROM migrations ORDER BY id ASC',
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  /**
   * Get pending migration files
   */
  getPendingMigrations() {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure migrations directory exists
        if (!fs.existsSync(this.migrationsDir)) {
          fs.mkdirSync(this.migrationsDir, { recursive: true });
        }

        // Get all migration files
        const files = fs.readdirSync(this.migrationsDir)
          .filter(file => file.endsWith('.js'))
          .sort();

        // Get executed migrations
        const executed = await this.getExecutedMigrations();
        const executedNames = executed.map(m => m.name);

        // Filter pending migrations
        const pending = files.filter(file => !executedNames.includes(file));

        resolve(pending);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get the next batch number
   */
  getNextBatch() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(batch) as maxBatch FROM migrations',
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve((row.maxBatch || 0) + 1);
          }
        }
      );
    });
  }

  /**
   * Record migration execution
   */
  recordMigration(name, batch) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO migrations (name, batch) VALUES (?, ?)',
        [name, batch],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Remove migration record
   */
  removeMigration(name) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM migrations WHERE name = ?',
        [name],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Execute a migration file
   */
  async executeMigration(filename, direction = 'up') {
    const migrationPath = path.join(this.migrationsDir, filename);
    const migration = require(migrationPath);

    if (typeof migration[direction] !== 'function') {
      throw new Error(`Migration ${filename} doesn't have ${direction} function`);
    }

    console.log(`Running migration: ${filename} (${direction})`);
    await migration[direction](this.db);
    console.log(`Migration completed: ${filename} (${direction})`);
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const pending = await this.getPendingMigrations();

      if (pending.length === 0) {
        console.log('No pending migrations');
        await this.close();
        return;
      }

      const batch = await this.getNextBatch();
      console.log(`Running ${pending.length} migration(s) in batch ${batch}`);

      for (const filename of pending) {
        try {
          await this.executeMigration(filename, 'up');
          await this.recordMigration(filename, batch);
          console.log(`✓ ${filename}`);
        } catch (error) {
          console.error(`✗ Failed to run migration ${filename}:`, error.message);
          throw error;
        }
      }

      console.log(`\nMigration completed successfully! (batch ${batch})`);
      await this.close();
    } catch (error) {
      console.error('Migration failed:', error);
      await this.close();
      process.exit(1);
    }
  }

  /**
   * Rollback the last batch of migrations
   */
  async rollback() {
    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const executed = await this.getExecutedMigrations();

      if (executed.length === 0) {
        console.log('No migrations to rollback');
        await this.close();
        return;
      }

      // Get the last batch
      const lastBatch = Math.max(...executed.map(m => m.batch));
      const toRollback = executed
        .filter(m => m.batch === lastBatch)
        .map(m => m.name)
        .reverse();

      console.log(`Rolling back ${toRollback.length} migration(s) from batch ${lastBatch}`);

      for (const filename of toRollback) {
        try {
          await this.executeMigration(filename, 'down');
          await this.removeMigration(filename);
          console.log(`✓ Rolled back: ${filename}`);
        } catch (error) {
          console.error(`✗ Failed to rollback migration ${filename}:`, error.message);
          throw error;
        }
      }

      console.log(`\nRollback completed successfully! (batch ${lastBatch})`);
      await this.close();
    } catch (error) {
      console.error('Rollback failed:', error);
      await this.close();
      process.exit(1);
    }
  }

  /**
   * Show migration status
   */
  async status() {
    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const executed = await this.getExecutedMigrations();
      const pending = await this.getPendingMigrations();

      console.log('\n=== Migration Status ===\n');

      if (executed.length > 0) {
        console.log('Executed migrations:');
        executed.forEach(m => {
          console.log(`  ✓ ${m.name} (batch ${m.batch})`);
        });
      } else {
        console.log('No executed migrations');
      }

      if (pending.length > 0) {
        console.log('\nPending migrations:');
        pending.forEach(m => {
          console.log(`  ○ ${m}`);
        });
      } else {
        console.log('\nNo pending migrations');
      }

      console.log('');
      await this.close();
    } catch (error) {
      console.error('Status check failed:', error);
      await this.close();
      process.exit(1);
    }
  }

  /**
   * Create a new migration file
   */
  static createMigration(name) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '')
      .split('.')[0];
    const filename = `${timestamp}_${name}.js`;
    const migrationsDir = path.join(__dirname, 'migrations');

    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const filePath = path.join(migrationsDir, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 */
async function up(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Add your migration code here
      // Example:
      // db.run(\`
      //   CREATE TABLE example (
      //     id INTEGER PRIMARY KEY AUTOINCREMENT,
      //     name TEXT NOT NULL
      //   )
      // \`, (err) => {
      //   if (err) reject(err);
      //   else resolve();
      // });

      resolve();
    });
  });
}

/**
 * Reverse the migration
 */
async function down(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Add your rollback code here
      // Example:
      // db.run('DROP TABLE IF EXISTS example', (err) => {
      //   if (err) reject(err);
      //   else resolve();
      // });

      resolve();
    });
  });
}

module.exports = { up, down };
`;

    fs.writeFileSync(filePath, template);
    console.log(`Created migration: ${filename}`);
    console.log(`Location: ${filePath}`);
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  // Database path - check both server/data and root data directories
  let dbPath = path.join(__dirname, '..', 'data', 'biolab.db');
  if (!require('fs').existsSync(path.dirname(dbPath))) {
    dbPath = path.join(__dirname, '..', '..', 'data', 'biolab.db');
  }
  const runner = new MigrationRunner(dbPath);

  switch (command) {
    case 'migrate':
      runner.migrate();
      break;

    case 'rollback':
      runner.rollback();
      break;

    case 'status':
      runner.status();
      break;

    case 'create':
      const name = process.argv[3];
      if (!name) {
        console.error('Please provide a migration name');
        console.log('Usage: node migrations.js create <migration_name>');
        process.exit(1);
      }
      MigrationRunner.createMigration(name);
      break;

    default:
      console.log('Usage:');
      console.log('  node migrations.js migrate   - Run pending migrations');
      console.log('  node migrations.js rollback  - Rollback last batch');
      console.log('  node migrations.js status    - Show migration status');
      console.log('  node migrations.js create <name> - Create new migration');
      process.exit(1);
  }
}

module.exports = MigrationRunner;
