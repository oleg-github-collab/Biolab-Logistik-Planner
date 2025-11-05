-- Link waste items to Kanban tasks
ALTER TABLE waste_items
  ADD COLUMN IF NOT EXISTS kanban_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_waste_items_task ON waste_items(kanban_task_id);
