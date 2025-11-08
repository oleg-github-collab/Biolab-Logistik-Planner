-- Migration 030
-- Align task status & priority constraints with enhanced Kanban board

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'tasks'
      AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
  END IF;
END$$;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'tasks'
      AND constraint_name = 'tasks_priority_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;
  END IF;
END$$;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

COMMENT ON CONSTRAINT tasks_status_check ON tasks IS
  'Accepted Kanban states, incl. backlog/review for drag-and-drop board';
COMMENT ON CONSTRAINT tasks_priority_check ON tasks IS
  'Allows urgent priority level used by task board & reminders';
