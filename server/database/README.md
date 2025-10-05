# Database Migrations & Seeding

This directory contains the database migration system and seeding utilities for the Biolab Logistik Planner SQLite database.

## Overview

- **migrations.js** - Migration runner with versioning and rollback functionality
- **seeds.js** - Database seeder for test data
- **migrations/** - Directory containing migration files

## Migration System

### Available Commands

#### Run Migrations
Execute all pending migrations:
```bash
npm run migrate
```

#### Rollback Last Batch
Rollback the last batch of migrations:
```bash
npm run migrate:rollback
```

#### Check Migration Status
View which migrations have been executed and which are pending:
```bash
npm run migrate:status
```

#### Create New Migration
Create a new migration file with timestamp-based naming:
```bash
npm run migrate:create <migration_name>

# Example:
npm run migrate:create add_notifications_table
```

This will create a file like: `20251005123456_add_notifications_table.js`

### Migration File Structure

Each migration file must export two functions:

```javascript
/**
 * Run the migration
 */
async function up(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE example (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
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
      db.run('DROP TABLE IF EXISTS example', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = { up, down };
```

### Migration Tracking

Migrations are tracked in the `migrations` table:
- Each migration is recorded with its name and batch number
- Rollbacks operate on the last batch
- Migrations run in alphabetical order (timestamp ensures correct order)

## Database Seeding

### Available Commands

#### Seed Database
Add test data to the database (preserves existing data):
```bash
npm run seed
```

#### Seed with Clear
Clear all data and reseed from scratch:
```bash
npm run seed:clear
```

#### Full Database Reset
Rollback all migrations, re-run migrations, and seed:
```bash
npm run db:reset
```

### Seeded Data

The seeder creates:

#### Users (6 accounts)
- **Superadmin**: superadmin@biolab.com / Super123!
- **Admin**: admin@biolab.com / Admin123!
- **Employee (Vollzeit)**: max.mustermann@biolab.com / Employee123!
- **Employee (Werkstudent)**: anna.schmidt@biolab.com / Employee123!
- **Employee (Vollzeit)**: peter.wagner@biolab.com / Employee123!
- **Employee (Werkstudent)**: lisa.mueller@biolab.com / Employee123!

#### Schedules
- Full-time employees: Monday-Friday schedules
- Part-time students: 3 random days per week

#### Events
- 5-10 events per user
- Various types: Arbeit, Urlaub, Krank, Meeting, Training
- Mixed priorities and dates (±30 days from today)

#### Tasks
- 8 different tasks for Kanban board
- Various statuses: todo, inprogress, review, done
- Different priorities and due dates

#### Messages
- 20 random messages between users
- Mixed read/unread status

#### Waste Items
- 5 different waste items
- Various disposal dates and categories

## Workflow Examples

### Creating a New Feature with Database Changes

1. Create a new migration:
```bash
npm run migrate:create add_feature_table
```

2. Edit the generated migration file in `server/database/migrations/`

3. Run the migration:
```bash
npm run migrate
```

4. If something goes wrong, rollback:
```bash
npm run migrate:rollback
```

### Setting Up Development Database

1. Ensure migrations are up to date:
```bash
npm run migrate
```

2. Seed with test data:
```bash
npm run seed:clear
```

### Checking Migration Status

```bash
npm run migrate:status
```

Output example:
```
=== Migration Status ===

Executed migrations:
  ✓ 20251005120000_add_user_preferences.js (batch 1)

Pending migrations:
  ○ 20251005130000_add_notifications.js
```

## Best Practices

1. **Always test migrations** - Test both `up` and `down` functions
2. **Keep migrations atomic** - One feature per migration
3. **Use descriptive names** - migration names should be clear
4. **Never modify executed migrations** - Create a new migration instead
5. **Test rollbacks** - Ensure `down` properly reverses `up`
6. **Use transactions** - Wrap complex migrations in db.serialize()

## Migration Naming Convention

Migrations use timestamp-based naming: `YYYYMMDDHHMMSS_description.js`

Examples:
- `20251005120000_add_user_preferences.js`
- `20251005130000_create_notifications_table.js`
- `20251005140000_add_indexes_for_performance.js`

This ensures migrations run in chronological order.

## Troubleshooting

### Migration fails with foreign key error
- Ensure referenced tables exist
- Check if migration order is correct (earlier migrations create referenced tables)

### Rollback fails
- Check the `down` function implementation
- Ensure it properly reverses the `up` function
- May need to manually fix and create a new migration

### Seeding fails
- Ensure migrations are up to date: `npm run migrate`
- Check for foreign key constraint violations
- Use `npm run seed:clear` to start fresh

## Database Location

The SQLite database file is located at:
```
/server/data/biolab.db
```

Make sure this directory exists and has write permissions.
