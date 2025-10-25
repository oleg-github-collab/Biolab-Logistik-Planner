-- Advanced Task Management System
-- Task templates, assignments, checklists, time tracking, dependencies

-- Task Templates (for recurring tasks)
CREATE TABLE IF NOT EXISTS task_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  description TEXT,

  -- Template settings
  default_priority VARCHAR(50) DEFAULT 'medium',
  estimated_hours NUMERIC(5,2),
  required_skills TEXT[], -- Array of required skills

  -- Checklist template
  checklist_items JSONB, -- [{title, required, order}]

  -- Assignment rules
  default_assignee_role VARCHAR(50), -- auto-assign to specific role
  allow_self_assignment BOOLEAN DEFAULT FALSE,
  max_concurrent_instances INTEGER DEFAULT 1,

  -- Resources
  required_equipment TEXT[],
  kb_article_links INTEGER[], -- Links to knowledge base articles

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(100), -- daily, weekly, monthly, custom
  recurrence_config JSONB, -- {dayOfWeek, dayOfMonth, interval}

  -- Metadata
  category VARCHAR(255),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Enhanced tasks table (extends existing)
-- Add new columns to existing tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES task_templates(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(5,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocking_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kb_article_links INTEGER[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location VARCHAR(500); -- Where the task should be done
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS equipment_needed TEXT[];

-- Task assignments (multiple assignees possible)
CREATE TABLE IF NOT EXISTS task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Assignment details
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE, -- Primary person responsible

  -- Status
  status VARCHAR(50) DEFAULT 'assigned', -- assigned, accepted, declined, working, completed
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Time tracking
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),

  -- Notes
  notes TEXT,

  UNIQUE(task_id, user_id)
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'finish_to_start', -- finish_to_start, start_to_start, etc.
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id) -- Can't depend on itself
);

-- Task checklist items
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,

  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,

  -- Link to knowledge base for instructions
  kb_article_id INTEGER REFERENCES kb_articles(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task time logs (detailed time tracking)
CREATE TABLE IF NOT EXISTS task_time_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),

  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INTEGER, -- Auto-calculated

  description TEXT,
  is_billable BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task attachments (files, links)
CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  attachment_type VARCHAR(50) NOT NULL, -- file, link, kb_article

  -- For files
  filename VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  mime_type VARCHAR(100),

  -- For links
  url TEXT,
  url_title VARCHAR(500),

  -- For KB articles
  kb_article_id INTEGER REFERENCES kb_articles(id),

  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task comments (communication thread)
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- Mentions
  mentioned_users INTEGER[], -- Array of user IDs mentioned

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_edited BOOLEAN DEFAULT FALSE
);

-- Task watchers (users following task updates)
CREATE TABLE IF NOT EXISTS task_watchers (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification preferences
  notify_on_comment BOOLEAN DEFAULT TRUE,
  notify_on_status_change BOOLEAN DEFAULT TRUE,
  notify_on_assignment BOOLEAN DEFAULT TRUE,

  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(task_id, user_id)
);

-- Task recurrence (for recurring tasks)
CREATE TABLE IF NOT EXISTS task_recurrence (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES task_templates(id),

  recurrence_pattern VARCHAR(100) NOT NULL,
  recurrence_config JSONB,

  next_occurrence_date DATE,
  last_generated_at TIMESTAMP,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task labels/tags for categorization
CREATE TABLE IF NOT EXISTS task_labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  color VARCHAR(50),
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_label_assignments (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Create indexes
CREATE INDEX idx_task_templates_active ON task_templates(is_active);
CREATE INDEX idx_task_templates_recurring ON task_templates(is_recurring);
CREATE INDEX idx_tasks_template ON tasks(template_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_start_date ON tasks(start_date);
CREATE INDEX idx_tasks_completed ON tasks(completed_at);
CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
CREATE INDEX idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id);
CREATE INDEX idx_task_time_logs_task ON task_time_logs(task_id);
CREATE INDEX idx_task_time_logs_user ON task_time_logs(user_id);
CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_watchers_task ON task_watchers(task_id);
CREATE INDEX idx_task_watchers_user ON task_watchers(user_id);

-- Triggers
CREATE TRIGGER task_checklist_updated_at
  BEFORE UPDATE ON task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

CREATE TRIGGER task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

-- Function to auto-calculate time log duration
CREATE OR REPLACE FUNCTION calculate_time_log_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_time_log_duration
  BEFORE INSERT OR UPDATE ON task_time_logs
  FOR EACH ROW EXECUTE FUNCTION calculate_time_log_duration();

-- Function to update task progress based on checklist completion
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  new_progress INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = TRUE)
  INTO total_items, completed_items
  FROM task_checklist_items
  WHERE task_id = NEW.task_id;

  IF total_items > 0 THEN
    new_progress = (completed_items * 100) / total_items;
    UPDATE tasks SET progress_percentage = new_progress WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_checklist_progress_update
  AFTER INSERT OR UPDATE OR DELETE ON task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_task_progress();

-- Insert default task labels
INSERT INTO task_labels (name, color, created_by)
VALUES
  ('urgent', '#EF4444', 1),
  ('high-priority', '#F59E0B', 1),
  ('maintenance', '#8B5CF6', 1),
  ('cleaning', '#10B981', 1),
  ('inspection', '#3B82F6', 1),
  ('training', '#06B6D4', 1),
  ('safety', '#DC2626', 1),
  ('documentation', '#6B7280', 1)
ON CONFLICT DO NOTHING;

-- Insert sample task template
INSERT INTO task_templates (
  name, description, default_priority, estimated_hours,
  checklist_items, is_recurring, recurrence_pattern, category, created_by
)
VALUES (
  'Weekly Lab Safety Inspection',
  'Complete weekly inspection of all safety equipment and procedures',
  'high',
  2.0,
  '[
    {"title": "Check fire extinguishers", "required": true, "order": 1},
    {"title": "Inspect emergency exits", "required": true, "order": 2},
    {"title": "Verify eyewash stations", "required": true, "order": 3},
    {"title": "Check safety shower", "required": true, "order": 4},
    {"title": "Review chemical storage", "required": true, "order": 5}
  ]'::jsonb,
  true,
  'weekly',
  'Safety',
  1
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE task_templates IS 'Reusable task templates for common workflows';
COMMENT ON TABLE task_assignments IS 'Track multiple assignees per task with status';
COMMENT ON TABLE task_dependencies IS 'Task dependencies for project management';
COMMENT ON TABLE task_checklist_items IS 'Checklist items within tasks';
COMMENT ON TABLE task_time_logs IS 'Detailed time tracking for tasks';
COMMENT ON TABLE task_attachments IS 'Files, links, and KB articles attached to tasks';
COMMENT ON TABLE task_comments IS 'Discussion thread for tasks';
COMMENT ON TABLE task_watchers IS 'Users following task updates';
COMMENT ON TABLE task_labels IS 'Labels/tags for task categorization';
