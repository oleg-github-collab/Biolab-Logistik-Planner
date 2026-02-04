/**
 * ULTRA-RELIABLE FK CONSTRAINT FIXER
 * Runs on every server startup to ensure FK constraints are correct
 * This guarantees user deletion always works
 */

const logger = require('../utils/logger');

// Complete list of ALL tables with user FK constraints
const FK_FIXES = [
  // User-owned data -> CASCADE (delete with user)
  { table: 'work_hours_audit', column: 'user_id', rule: 'CASCADE' },
  { table: 'user_settings', column: 'user_id', rule: 'CASCADE' },
  { table: 'user_weekly_hours', column: 'user_id', rule: 'CASCADE' },
  { table: 'time_entries', column: 'user_id', rule: 'CASCADE' },
  { table: 'stories', column: 'user_id', rule: 'CASCADE' },
  { table: 'story_viewers', column: 'viewer_id', rule: 'CASCADE' },
  { table: 'notifications', column: 'user_id', rule: 'CASCADE' },
  { table: 'notification_preferences', column: 'user_id', rule: 'CASCADE' },
  { table: 'notification_digest_log', column: 'user_id', rule: 'CASCADE' },
  { table: 'bot_conversation_history', column: 'user_id', rule: 'CASCADE' },
  { table: 'kb_favorites', column: 'user_id', rule: 'CASCADE' },
  { table: 'kb_views', column: 'user_id', rule: 'CASCADE' },
  { table: 'kb_feedback', column: 'user_id', rule: 'CASCADE' },
  { table: 'chat_members', column: 'user_id', rule: 'CASCADE' },
  { table: 'message_reads', column: 'user_id', rule: 'CASCADE' },
  { table: 'user_contacts', column: 'user_id', rule: 'CASCADE' },
  { table: 'user_contacts', column: 'contact_user_id', rule: 'CASCADE' },
  { table: 'direct_messages', column: 'sender_id', rule: 'CASCADE' },
  { table: 'direct_messages', column: 'receiver_id', rule: 'CASCADE' },
  { table: 'messenger_quick_replies', column: 'user_id', rule: 'CASCADE' },
  { table: 'contact_notes', column: 'user_id', rule: 'CASCADE' },
  { table: 'contact_notes', column: 'contact_id', rule: 'CASCADE' },
  { table: 'message_mentions', column: 'mentioned_user_id', rule: 'CASCADE' },
  { table: 'help_requests', column: 'requested_by', rule: 'CASCADE' },
  { table: 'help_requests', column: 'requested_user_id', rule: 'CASCADE' },
  { table: 'task_assignments', column: 'user_id', rule: 'CASCADE' },
  { table: 'kanban_comments', column: 'created_by', rule: 'CASCADE' },
  { table: 'kanban_activity', column: 'user_id', rule: 'CASCADE' },

  // Audit/tracking fields -> SET NULL (preserve history)
  { table: 'work_hours_audit', column: 'changed_by', rule: 'SET NULL' },
  { table: 'kb_article_versions', column: 'created_by', rule: 'SET NULL' },
  { table: 'kb_article_versions', column: 'author_id', rule: 'SET NULL' },
  { table: 'kb_articles', column: 'created_by', rule: 'SET NULL' },
  { table: 'kb_articles', column: 'updated_by', rule: 'SET NULL' },
  { table: 'kb_articles', column: 'last_edited_by', rule: 'SET NULL' },
  { table: 'kb_articles', column: 'author_id', rule: 'SET NULL' },
  { table: 'kb_article_edits', column: 'edited_by', rule: 'SET NULL' },
  { table: 'kb_comments', column: 'author_id', rule: 'SET NULL' },
  { table: 'broadcast_history', column: 'admin_id', rule: 'SET NULL' },
  { table: 'storage_bins', column: 'created_by', rule: 'SET NULL' },
  { table: 'storage_bins', column: 'completed_by', rule: 'SET NULL' },
  { table: 'storage_tasks', column: 'created_by', rule: 'SET NULL' },
  { table: 'public_holidays', column: 'created_by', rule: 'SET NULL' },
  { table: 'weekly_schedules', column: 'last_updated_by', rule: 'SET NULL' },
  { table: 'calendar_events', column: 'created_by', rule: 'SET NULL' },
  { table: 'messages', column: 'user_id', rule: 'SET NULL' },
  { table: 'messages', column: 'receiver_id', rule: 'SET NULL' },
  { table: 'messages', column: 'quoted_by', rule: 'SET NULL' },
  { table: 'messages', column: 'mentioned_by', rule: 'SET NULL' },
  { table: 'message_mentions', column: 'mentioned_by', rule: 'SET NULL' },
  { table: 'kanban_tasks', column: 'created_by', rule: 'SET NULL' },
  { table: 'kanban_tasks', column: 'assigned_to', rule: 'SET NULL' },
  { table: 'tasks', column: 'assigned_to', rule: 'SET NULL' },
  { table: 'tasks', column: 'assigned_by', rule: 'SET NULL' },
  { table: 'tasks', column: 'claimed_by', rule: 'SET NULL' },
  { table: 'tasks', column: 'help_requested_from', rule: 'SET NULL' },
  { table: 'tasks', column: 'help_requested_by', rule: 'SET NULL' },
  { table: 'task_pool', column: 'assigned_to', rule: 'SET NULL' },
  { table: 'task_pool', column: 'completed_by', rule: 'SET NULL' },
  { table: 'task_pool', column: 'created_by', rule: 'SET NULL' },
  { table: 'task_templates', column: 'created_by', rule: 'SET NULL' },
  { table: 'kb_attachments', column: 'uploaded_by', rule: 'SET NULL' },
  { table: 'kanban_attachments', column: 'uploaded_by', rule: 'SET NULL' },
  { table: 'task_attachments', column: 'uploaded_by', rule: 'SET NULL' },
  { table: 'waste_disposal_responses', column: 'user_id', rule: 'SET NULL' },
  { table: 'shift_groups', column: 'created_by', rule: 'SET NULL' },
  { table: 'shift_assignments', column: 'user_id', rule: 'SET NULL' }
];

async function fixSingleFK(client, table, column, rule) {
  const constraintName = `${table}_${column}_fkey`;

  try {
    // Check if table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )`,
      [table]
    );

    if (!tableCheck.rows[0].exists) {
      return { table, column, status: 'skipped', reason: 'table not found' };
    }

    // Check if column exists
    const columnCheck = await client.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
      [table, column]
    );

    if (columnCheck.rows.length === 0) {
      return { table, column, status: 'skipped', reason: 'column not found' };
    }

    const isNullable = columnCheck.rows[0].is_nullable === 'YES';

    // Validate SET NULL with nullable column
    if (rule === 'SET NULL' && !isNullable) {
      return { table, column, status: 'error', reason: 'SET NULL on NOT NULL column' };
    }

    // Drop existing constraint (ignore if doesn't exist)
    await client.query(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName}`
    );

    // Add new constraint with correct ON DELETE rule
    await client.query(
      `ALTER TABLE ${table}
       ADD CONSTRAINT ${constraintName}
       FOREIGN KEY (${column})
       REFERENCES users(id)
       ON DELETE ${rule}`
    );

    return { table, column, status: 'fixed', rule };
  } catch (error) {
    return { table, column, status: 'error', reason: error.message };
  }
}

async function fixAllUserFKs(pool) {
  const client = await pool.connect();
  const results = {
    fixed: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    logger.info('🔧 Starting automatic FK constraint fixing...');

    for (const { table, column, rule } of FK_FIXES) {
      const result = await fixSingleFK(client, table, column, rule);
      results.details.push(result);

      if (result.status === 'fixed') {
        results.fixed++;
        logger.info(`✅ Fixed ${table}.${column} -> ${rule}`);
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'error') {
        results.errors++;
        logger.warn(`⚠️  Error fixing ${table}.${column}: ${result.reason}`);
      }
    }

    logger.info(`🎯 FK Fix Summary: ${results.fixed} fixed, ${results.skipped} skipped, ${results.errors} errors`);

    // Verify critical constraints
    const criticalCheck = await client.query(`
      SELECT table_name, column_name, delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND tc.table_name = 'work_hours_audit'
        AND kcu.column_name = 'user_id'
    `);

    if (criticalCheck.rows.length > 0) {
      const rule = criticalCheck.rows[0].delete_rule;
      logger.info(`✅ VERIFIED: work_hours_audit.user_id has ON DELETE ${rule}`);

      if (rule !== 'CASCADE') {
        logger.error('❌ CRITICAL: work_hours_audit.user_id should be CASCADE!');
      }
    }

    return results;
  } catch (error) {
    logger.error('❌ Fatal error fixing FK constraints:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { fixAllUserFKs, FK_FIXES };
