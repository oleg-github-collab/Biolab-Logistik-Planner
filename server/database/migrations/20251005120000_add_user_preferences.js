/**
 * Migration: add_user_preferences
 * Created: 2025-10-05T12:00:00.000Z
 *
 * This is an example migration that adds a user_preferences table
 * for storing user-specific settings and preferences
 */

/**
 * Run the migration
 */
async function up(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create user_preferences table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          preference_key TEXT NOT NULL,
          preference_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, preference_key)
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create index for better performance
        db.run(
          'CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id)',
          (err) => {
            if (err) {
              reject(err);
            } else {
              console.log('Created user_preferences table and index');
              resolve();
            }
          }
        );
      });
    });
  });
}

/**
 * Reverse the migration
 */
async function down(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop index first
      db.run('DROP INDEX IF EXISTS idx_user_preferences_user', (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Drop table
        db.run('DROP TABLE IF EXISTS user_preferences', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Dropped user_preferences table and index');
            resolve();
          }
        });
      });
    });
  });
}

module.exports = { up, down };
