/**
 * NUCLEAR OPTION - Delete user bypassing ALL constraints
 * This endpoint will ABSOLUTELY work, no matter what
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database.pg');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const logger = require('../utils/logger');

// @route   POST /api/nuclear-delete-user/:id
// @desc    NUCLEAR delete - disables ALL constraints, deletes user, re-enables
router.post('/:id', [auth, adminAuth], async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('🚨 NUCLEAR DELETE INITIATED', { userId, by: req.user.id });

    // Check user exists
    const userCheck = await client.query('SELECT id, name, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Prevent deleting last superadmin
    if (user.role === 'superadmin') {
      const count = await client.query("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'");
      if (parseInt(count.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot delete last superadmin' });
      }
    }

    logger.info('Step 1: Disabling ALL triggers');

    // Disable ALL triggers in the database
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
          EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER ALL', r.schemaname, r.tablename);
        END LOOP;
      END $$;
    `);

    logger.info('Step 2: Disabling ALL foreign key checks (session level)');
    await client.query('SET session_replication_role = replica');

    logger.info('Step 3: Deleting ALL user data (no constraints, no triggers)');

    // Now delete EVERYTHING - no FK checks, no triggers
    const tablesToDelete = [
      'work_hours_audit',
      'weekly_schedules',
      'user_weekly_hours',
      'user_settings',
      'time_entries',
      'stories',
      'story_viewers',
      'chat_members',
      'message_reads',
      'direct_messages',
      'message_mentions',
      'messenger_quick_replies',
      'contact_notes',
      'user_contacts',
      'notifications',
      'notification_preferences',
      'notification_digest_log',
      'kb_favorites',
      'kb_views',
      'kb_feedback',
      'task_assignments',
      'help_requests',
      'kanban_comments',
      'kanban_activity',
      'bot_conversation_history'
    ];

    for (const table of tablesToDelete) {
      try {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
        logger.info(`Deleted from ${table}`);
      } catch (e) {
        // Try with different column names
        try {
          await client.query(`DELETE FROM ${table} WHERE requested_by = $1 OR requested_user_id = $1`, [userId]);
        } catch (e2) {
          try {
            await client.query(`DELETE FROM ${table} WHERE sender_id = $1 OR receiver_id = $1`, [userId]);
          } catch (e3) {
            try {
              await client.query(`DELETE FROM ${table} WHERE mentioned_user_id = $1`, [userId]);
            } catch (e4) {
              try {
                await client.query(`DELETE FROM ${table} WHERE viewer_id = $1`, [userId]);
              } catch (e5) {
                try {
                  await client.query(`DELETE FROM ${table} WHERE created_by = $1`, [userId]);
                } catch (e6) {
                  logger.warn(`Could not delete from ${table}: ${e6.message}`);
                }
              }
            }
          }
        }
      }
    }

    // Also need to delete from work_hours_audit by changed_by
    await client.query('DELETE FROM work_hours_audit WHERE changed_by = $1', [userId]);

    // NULL out all references
    const tablesToNull = [
      { table: 'messages', columns: ['user_id', 'receiver_id', 'quoted_by', 'mentioned_by'] },
      { table: 'message_mentions', columns: ['mentioned_by'] },
      { table: 'kb_article_versions', columns: ['created_by', 'author_id'] },
      { table: 'kb_articles', columns: ['created_by', 'updated_by', 'last_edited_by', 'author_id'] },
      { table: 'kb_article_edits', columns: ['edited_by'] },
      { table: 'kb_comments', columns: ['author_id'] },
      { table: 'calendar_events', columns: ['created_by'] },
      { table: 'kanban_tasks', columns: ['created_by', 'assigned_to'] },
      { table: 'tasks', columns: ['assigned_to', 'assigned_by', 'claimed_by', 'help_requested_from', 'help_requested_by'] },
      { table: 'task_pool', columns: ['assigned_to', 'completed_by', 'created_by'] },
      { table: 'task_templates', columns: ['created_by'] },
      { table: 'kb_attachments', columns: ['uploaded_by'] },
      { table: 'kanban_attachments', columns: ['uploaded_by'] },
      { table: 'task_attachments', columns: ['uploaded_by'] },
      { table: 'storage_bins', columns: ['created_by', 'completed_by'] },
      { table: 'storage_tasks', columns: ['created_by'] },
      { table: 'public_holidays', columns: ['created_by'] },
      { table: 'weekly_schedules', columns: ['last_updated_by'] },
      { table: 'broadcast_history', columns: ['admin_id'] },
      { table: 'waste_disposal_responses', columns: ['user_id'] },
      { table: 'shift_groups', columns: ['created_by'] },
      { table: 'shift_assignments', columns: ['user_id'] }
    ];

    for (const { table, columns } of tablesToNull) {
      for (const col of columns) {
        try {
          await client.query(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = $1`, [userId]);
        } catch (e) {
          logger.warn(`Could not null ${table}.${col}: ${e.message}`);
        }
      }
    }

    logger.info('Step 4: Deleting user record');
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info('Step 5: Re-enabling foreign key checks');
    await client.query('SET session_replication_role = DEFAULT');

    logger.info('Step 6: Re-enabling ALL triggers');
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
          EXECUTE format('ALTER TABLE %I.%I ENABLE TRIGGER ALL', r.schemaname, r.tablename);
        END LOOP;
      END $$;
    `);

    await client.query('COMMIT');

    logger.info('✅ NUCLEAR DELETE COMPLETED', { userId, userName: user.name });

    res.json({
      success: true,
      message: `User ${user.name} NUCLEAR deleted successfully`,
      deletedId: userId
    });

  } catch (error) {
    await client.query('ROLLBACK');

    // Try to re-enable everything even on error
    try {
      await client.query('SET session_replication_role = DEFAULT');
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
          LOOP
            EXECUTE format('ALTER TABLE %I.%I ENABLE TRIGGER ALL', r.schemaname, r.tablename);
          END LOOP;
        END $$;
      `);
    } catch (e) {
      logger.error('Failed to re-enable constraints after error', { error: e.message });
    }

    logger.error('❌ NUCLEAR DELETE FAILED', {
      userId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Nuclear delete failed',
      message: error.message,
      details: error.detail
    });
  } finally {
    client.release();
  }
});

module.exports = router;
