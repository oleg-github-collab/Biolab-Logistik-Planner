-- Fix all FK constraints to users table to allow user deletion
-- Date: 2026-02-01
-- This migration ensures all foreign keys to users have proper ON DELETE behavior

-- kb_article_versions.created_by
ALTER TABLE IF EXISTS kb_article_versions
  DROP CONSTRAINT IF EXISTS kb_article_versions_created_by_fkey;

ALTER TABLE IF EXISTS kb_article_versions
  ADD CONSTRAINT kb_article_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- kb_articles.created_by
ALTER TABLE IF EXISTS kb_articles
  DROP CONSTRAINT IF EXISTS kb_articles_created_by_fkey;

ALTER TABLE IF EXISTS kb_articles
  ADD CONSTRAINT kb_articles_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- kb_articles.updated_by
ALTER TABLE IF EXISTS kb_articles
  DROP CONSTRAINT IF EXISTS kb_articles_updated_by_fkey;

ALTER TABLE IF EXISTS kb_articles
  ADD CONSTRAINT kb_articles_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- calendar_events.created_by
ALTER TABLE IF EXISTS calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey;

ALTER TABLE IF EXISTS calendar_events
  ADD CONSTRAINT calendar_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- messages.user_id
ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- kanban_tasks.created_by
ALTER TABLE IF EXISTS kanban_tasks
  DROP CONSTRAINT IF EXISTS kanban_tasks_created_by_fkey;

ALTER TABLE IF EXISTS kanban_tasks
  ADD CONSTRAINT kanban_tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- kanban_tasks.assigned_to
ALTER TABLE IF EXISTS kanban_tasks
  DROP CONSTRAINT IF EXISTS kanban_tasks_assigned_to_fkey;

ALTER TABLE IF EXISTS kanban_tasks
  ADD CONSTRAINT kanban_tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- stories.user_id
ALTER TABLE IF EXISTS stories
  DROP CONSTRAINT IF EXISTS stories_user_id_fkey;

ALTER TABLE IF EXISTS stories
  ADD CONSTRAINT stories_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- time_entries.user_id
ALTER TABLE IF EXISTS time_entries
  DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

ALTER TABLE IF EXISTS time_entries
  ADD CONSTRAINT time_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON TABLE schema_migrations IS 'Migration 060: Fixed all user FK constraints for deletion';
