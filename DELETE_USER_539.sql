-- Manual user deletion script for user ID 539
-- Run this directly in Railway PostgreSQL console

BEGIN;

-- 1. Check which tables reference this user
SELECT
  tc.table_name,
  kcu.column_name,
  COUNT(*) as references_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users'
  AND tc.table_schema = 'public'
GROUP BY tc.table_name, kcu.column_name;

-- 2. Manually cleanup references (SET NULL or DELETE based on table)
UPDATE kb_article_versions SET created_by = NULL WHERE created_by = 539;
UPDATE kb_articles SET created_by = NULL WHERE created_by = 539;
UPDATE kb_articles SET updated_by = NULL WHERE updated_by = 539;
UPDATE messages SET user_id = NULL WHERE user_id = 539;
UPDATE kanban_tasks SET created_by = NULL WHERE created_by = 539;
UPDATE kanban_tasks SET assigned_to = NULL WHERE assigned_to = 539;
DELETE FROM calendar_events WHERE created_by = 539;
DELETE FROM stories WHERE user_id = 539;
DELETE FROM time_entries WHERE user_id = 539;
DELETE FROM chat_members WHERE user_id = 539;
DELETE FROM message_reads WHERE user_id = 539;
DELETE FROM notifications WHERE user_id = 539;
DELETE FROM task_assignments WHERE user_id = 539;

-- 3. Now delete the user
DELETE FROM users WHERE id = 539;

-- 4. Verify deletion
SELECT COUNT(*) as remaining_count FROM users WHERE id = 539;

COMMIT;

-- If you get an error, run this to see which constraint is blocking:
-- SELECT * FROM pg_constraint WHERE confrelid = 'users'::regclass;
