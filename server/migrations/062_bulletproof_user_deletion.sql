-- ============================================================================
-- Migration 062: Bulletproof User Deletion - Fix ALL FK constraints
-- ============================================================================
-- This migration ensures ALL foreign keys referencing users(id) have proper
-- ON DELETE actions (either CASCADE or SET NULL) to enable reliable user deletion

-- Audit/tracking fields -> SET NULL (preserve history but remove user reference)
-- User-owned data -> CASCADE (remove data when user is deleted)

-- =============================================================================
-- Helper function to safely update FK constraints
-- =============================================================================
CREATE OR REPLACE FUNCTION fix_user_fk_constraint(
  p_table_schema TEXT,
  p_table_name TEXT,
  p_column_name TEXT,
  p_delete_rule TEXT  -- 'CASCADE' or 'SET NULL'
) RETURNS void AS $$
DECLARE
  v_constraint_name TEXT;
  v_is_nullable TEXT;
  v_drop_sql TEXT;
  v_add_sql TEXT;
BEGIN
  -- Find existing constraint name
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = p_table_schema
    AND tc.table_name = p_table_name
    AND kcu.column_name = p_column_name
    AND ccu.table_name = 'users'
  LIMIT 1;

  -- Check if column is nullable (required for SET NULL)
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_schema = p_table_schema
    AND table_name = p_table_name
    AND column_name = p_column_name;

  -- Validate SET NULL is only used with nullable columns
  IF p_delete_rule = 'SET NULL' AND v_is_nullable = 'NO' THEN
    RAISE WARNING 'Cannot use SET NULL on NOT NULL column %.%.%', p_table_schema, p_table_name, p_column_name;
    RETURN;
  END IF;

  -- Drop existing constraint if found
  IF v_constraint_name IS NOT NULL THEN
    v_drop_sql := format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                         p_table_schema, p_table_name, v_constraint_name);
    EXECUTE v_drop_sql;
    RAISE NOTICE 'Dropped constraint % on %.%', v_constraint_name, p_table_name, p_column_name;
  END IF;

  -- Add new constraint with proper ON DELETE rule
  v_constraint_name := format('%s_%s_fkey', p_table_name, p_column_name);
  v_add_sql := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE %s',
                      p_table_schema, p_table_name, v_constraint_name, p_column_name, p_delete_rule);
  EXECUTE v_add_sql;
  RAISE NOTICE 'Added constraint % on %.% with ON DELETE %', v_constraint_name, p_table_name, p_column_name, p_delete_rule;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to fix FK on %.%.%: %', p_table_schema, p_table_name, p_column_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Fix ALL user FK constraints
-- =============================================================================

-- -------------------------
-- Audit/History Tables - SET NULL
-- -------------------------
SELECT fix_user_fk_constraint('public', 'work_hours_audit', 'changed_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_article_versions', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_article_versions', 'author_id', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_articles', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_articles', 'updated_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_articles', 'last_edited_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_articles', 'author_id', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kb_article_edits', 'edited_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'broadcast_history', 'admin_id', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'storage_bins', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'storage_bins', 'completed_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'public_holidays', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'weekly_schedules', 'last_updated_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'storage_tasks', 'created_by', 'SET NULL');

-- -------------------------
-- Messages/Communication - SET NULL or CASCADE
-- -------------------------
SELECT fix_user_fk_constraint('public', 'messages', 'user_id', 'SET NULL');  -- Keep message but mark deleted user
SELECT fix_user_fk_constraint('public', 'messages', 'receiver_id', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'messages', 'quoted_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'messages', 'mentioned_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'direct_messages', 'sender_id', 'CASCADE');  -- Delete when sender deleted
SELECT fix_user_fk_constraint('public', 'direct_messages', 'receiver_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'messenger_quick_replies', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'contact_notes', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'contact_notes', 'contact_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'message_mentions', 'mentioned_user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'message_mentions', 'mentioned_by', 'SET NULL');

-- -------------------------
-- Chat/Messaging Infrastructure - CASCADE
-- -------------------------
SELECT fix_user_fk_constraint('public', 'chat_members', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'message_reads', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'user_contacts', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'user_contacts', 'contact_user_id', 'CASCADE');

-- -------------------------
-- Calendar - SET NULL for creator
-- -------------------------
SELECT fix_user_fk_constraint('public', 'calendar_events', 'created_by', 'SET NULL');

-- -------------------------
-- Kanban/Tasks - SET NULL for assignments/creators
-- -------------------------
SELECT fix_user_fk_constraint('public', 'kanban_tasks', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kanban_tasks', 'assigned_to', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'tasks', 'assigned_to', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'tasks', 'assigned_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'tasks', 'claimed_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'tasks', 'help_requested_from', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'tasks', 'help_requested_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'task_pool', 'assigned_to', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'task_pool', 'completed_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'task_pool', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'task_templates', 'created_by', 'SET NULL');

-- -------------------------
-- User-owned personal data - CASCADE
-- -------------------------
SELECT fix_user_fk_constraint('public', 'work_hours_audit', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'user_settings', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'user_weekly_hours', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'time_entries', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'stories', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'story_viewers', 'viewer_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'notifications', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'notification_preferences', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'notification_digest_log', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'bot_conversation_history', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'kb_favorites', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'kb_views', 'user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'kb_feedback', 'user_id', 'CASCADE');

-- -------------------------
-- Attachments/Uploads - SET NULL for uploader
-- -------------------------
SELECT fix_user_fk_constraint('public', 'kb_attachments', 'uploaded_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'kanban_attachments', 'uploaded_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'task_attachments', 'uploaded_by', 'SET NULL');

-- -------------------------
-- Help requests - CASCADE
-- -------------------------
SELECT fix_user_fk_constraint('public', 'help_requests', 'requested_by', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'help_requests', 'requested_user_id', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'task_assignments', 'user_id', 'CASCADE');

-- -------------------------
-- Comments/Feedback - SET NULL or CASCADE depending on importance
-- -------------------------
SELECT fix_user_fk_constraint('public', 'kb_comments', 'author_id', 'SET NULL');  -- Keep comment, mark deleted
SELECT fix_user_fk_constraint('public', 'kanban_comments', 'created_by', 'CASCADE');
SELECT fix_user_fk_constraint('public', 'waste_disposal_responses', 'user_id', 'SET NULL');

-- -------------------------
-- Kanban activity tracking - CASCADE
-- -------------------------
SELECT fix_user_fk_constraint('public', 'kanban_activity', 'user_id', 'CASCADE');

-- -------------------------
-- Shift management - SET NULL
-- -------------------------
SELECT fix_user_fk_constraint('public', 'shift_groups', 'created_by', 'SET NULL');
SELECT fix_user_fk_constraint('public', 'shift_assignments', 'user_id', 'SET NULL');

-- =============================================================================
-- Drop the helper function
-- =============================================================================
DROP FUNCTION IF EXISTS fix_user_fk_constraint(TEXT, TEXT, TEXT, TEXT);

-- =============================================================================
-- Verification query (run manually to check results)
-- =============================================================================
-- SELECT
--   tc.table_schema,
--   tc.table_name,
--   kcu.column_name,
--   rc.delete_rule,
--   c.is_nullable
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
--  AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.referential_constraints rc
--   ON tc.constraint_name = rc.constraint_name
--  AND tc.table_schema = rc.constraint_schema
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
--  AND ccu.table_schema = tc.table_schema
-- JOIN information_schema.columns c
--   ON c.table_schema = tc.table_schema
--  AND c.table_name = tc.table_name
--  AND c.column_name = kcu.column_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND ccu.table_name = 'users'
--   AND tc.table_schema = 'public'
-- ORDER BY tc.table_name, kcu.column_name;
