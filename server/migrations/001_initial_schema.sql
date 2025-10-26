-- Biolab Logistik Planner - PostgreSQL Schema
-- Initial migration with full audit trail

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- USERS TABLE
-- ==============================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin', 'superadmin')),
  employment_type VARCHAR(50) NOT NULL DEFAULT 'Werkstudent' CHECK (employment_type IN ('Vollzeit', 'Werkstudent')),

  -- Work hours configuration
  weekly_hours_quota NUMERIC(5,2) DEFAULT 20.0, -- Werkstudent: 20h/week, Vollzeit: 40h/week
  auto_schedule BOOLEAN DEFAULT FALSE,
  default_start_time TIME DEFAULT '08:00',
  default_end_time TIME DEFAULT '17:00',

  -- First login setup
  first_login_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ==============================================
-- WEEKLY SCHEDULES (робочі години)
-- ==============================================
CREATE TABLE weekly_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  is_working BOOLEAN DEFAULT TRUE,
  is_absent BOOLEAN DEFAULT FALSE,
  absence_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE(user_id, week_start, day_of_week)
);

CREATE INDEX idx_weekly_schedules_user ON weekly_schedules(user_id);
CREATE INDEX idx_weekly_schedules_week ON weekly_schedules(week_start);
CREATE INDEX idx_weekly_schedules_day ON weekly_schedules(day_of_week);

-- ==============================================
-- WORK HOURS AUDIT LOG (детальний лог змін годин)
-- ==============================================
CREATE TABLE work_hours_audit (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES weekly_schedules(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL,

  -- Old values (before change)
  old_start_time TIME,
  old_end_time TIME,
  old_is_working BOOLEAN,
  old_absence_reason TEXT,

  -- New values (after change)
  new_start_time TIME,
  new_end_time TIME,
  new_is_working BOOLEAN,
  new_absence_reason TEXT,

  -- Who made the change
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_by_name VARCHAR(255),
  changed_by_role VARCHAR(50),

  -- When and from where
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,

  -- Additional context
  notes TEXT,
  hours_difference NUMERIC(5,2) -- calculated difference in hours
);

CREATE INDEX idx_work_hours_audit_user ON work_hours_audit(user_id);
CREATE INDEX idx_work_hours_audit_week ON work_hours_audit(week_start);
CREATE INDEX idx_work_hours_audit_changed_by ON work_hours_audit(changed_by);
CREATE INDEX idx_work_hours_audit_changed_at ON work_hours_audit(changed_at);

-- ==============================================
-- MESSAGES
-- ==============================================
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'gif', 'file', 'system')),
  is_group BOOLEAN DEFAULT FALSE,
  read_status BOOLEAN DEFAULT FALSE,
  delivered_status BOOLEAN DEFAULT TRUE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(receiver_id, read_status) WHERE read_status = FALSE;

-- ==============================================
-- TASKS (Kanban)
-- ==============================================
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'inprogress', 'review', 'done')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date TIMESTAMP,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);

-- ==============================================
-- WASTE TEMPLATES
-- ==============================================
CREATE TABLE waste_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  hazard_level VARCHAR(50) NOT NULL CHECK (hazard_level IN ('low', 'medium', 'high', 'critical')),
  disposal_frequency_days INTEGER,
  color VARCHAR(50),
  icon VARCHAR(50),
  description TEXT,
  safety_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waste_templates_category ON waste_templates(category);
CREATE INDEX idx_waste_templates_hazard ON waste_templates(hazard_level);

-- ==============================================
-- WASTE ITEMS
-- ==============================================
CREATE TABLE waste_items (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES waste_templates(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'archived')),
  last_disposal_date TIMESTAMP,
  next_disposal_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waste_items_template ON waste_items(template_id);
CREATE INDEX idx_waste_items_status ON waste_items(status);
CREATE INDEX idx_waste_items_next_disposal ON waste_items(next_disposal_date);

-- ==============================================
-- WASTE DISPOSAL SCHEDULE
-- ==============================================
CREATE TABLE waste_disposal_schedule (
  id SERIAL PRIMARY KEY,
  waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP NOT NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'rescheduled', 'completed', 'overdue', 'cancelled')),
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reminder_dates JSONB DEFAULT '[]',
  reminder_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waste_disposal_item ON waste_disposal_schedule(waste_item_id);
CREATE INDEX idx_waste_disposal_scheduled ON waste_disposal_schedule(scheduled_date);
CREATE INDEX idx_waste_disposal_assigned ON waste_disposal_schedule(assigned_to);
CREATE INDEX idx_waste_disposal_status ON waste_disposal_schedule(status);

-- ==============================================
-- ARCHIVED SCHEDULES
-- ==============================================
CREATE TABLE archived_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  data JSONB NOT NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_archived_schedules_user ON archived_schedules(user_id);
CREATE INDEX idx_archived_schedules_week ON archived_schedules(week_start);

-- ==============================================
-- SYSTEM FLAGS
-- ==============================================
CREATE TABLE system_flags (
  name VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- AUDIT LOG (general system audit)
-- ==============================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ==============================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_schedules_updated_at BEFORE UPDATE ON weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waste_items_updated_at BEFORE UPDATE ON waste_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waste_disposal_schedule_updated_at BEFORE UPDATE ON waste_disposal_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- TRIGGER FOR WORK HOURS AUDIT
-- ==============================================
CREATE OR REPLACE FUNCTION log_work_hours_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO work_hours_audit (
      schedule_id, user_id, action, week_start, day_of_week,
      new_start_time, new_end_time, new_is_working, new_absence_reason,
      changed_by, changed_by_name, changed_by_role,
      hours_difference
    ) VALUES (
      NEW.id, NEW.user_id, 'created', NEW.week_start, NEW.day_of_week,
      NEW.start_time, NEW.end_time, NEW.is_working, NEW.absence_reason,
      NEW.created_by,
      (SELECT name FROM users WHERE id = NEW.created_by),
      (SELECT role FROM users WHERE id = NEW.created_by),
      CASE
        WHEN NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))/3600
        ELSE 0
      END
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO work_hours_audit (
      schedule_id, user_id, action, week_start, day_of_week,
      old_start_time, old_end_time, old_is_working, old_absence_reason,
      new_start_time, new_end_time, new_is_working, new_absence_reason,
      changed_by, changed_by_name, changed_by_role,
      hours_difference
    ) VALUES (
      NEW.id, NEW.user_id, 'updated', NEW.week_start, NEW.day_of_week,
      OLD.start_time, OLD.end_time, OLD.is_working, OLD.absence_reason,
      NEW.start_time, NEW.end_time, NEW.is_working, NEW.absence_reason,
      NEW.updated_by,
      (SELECT name FROM users WHERE id = NEW.updated_by),
      (SELECT role FROM users WHERE id = NEW.updated_by),
      CASE
        WHEN NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))/3600
        ELSE 0
      END - CASE
        WHEN OLD.start_time IS NOT NULL AND OLD.end_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (OLD.end_time - OLD.start_time))/3600
        ELSE 0
      END
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO work_hours_audit (
      schedule_id, user_id, action, week_start, day_of_week,
      old_start_time, old_end_time, old_is_working, old_absence_reason,
      changed_by, changed_by_name, changed_by_role,
      hours_difference
    ) VALUES (
      OLD.id, OLD.user_id, 'deleted', OLD.week_start, OLD.day_of_week,
      OLD.start_time, OLD.end_time, OLD.is_working, OLD.absence_reason,
      OLD.updated_by,
      (SELECT name FROM users WHERE id = OLD.updated_by),
      (SELECT role FROM users WHERE id = OLD.updated_by),
      CASE
        WHEN OLD.start_time IS NOT NULL AND OLD.end_time IS NOT NULL
        THEN -EXTRACT(EPOCH FROM (OLD.end_time - OLD.start_time))/3600
        ELSE 0
      END
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_hours_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION log_work_hours_changes();

-- ==============================================
-- VIEWS FOR REPORTING
-- ==============================================

-- View for current week work hours with audit trail
CREATE OR REPLACE VIEW v_current_week_hours AS
SELECT
  ws.id,
  ws.user_id,
  u.name as user_name,
  u.employment_type,
  ws.week_start,
  ws.day_of_week,
  ws.start_time,
  ws.end_time,
  ws.is_working,
  ws.is_absent,
  CASE
    WHEN ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ws.end_time - ws.start_time))/3600
    ELSE 0
  END as hours,
  ws.updated_at,
  updater.name as last_updated_by_name,
  updater.role as last_updated_by_role
FROM weekly_schedules ws
LEFT JOIN users u ON ws.user_id = u.id
LEFT JOIN users updater ON ws.updated_by = updater.id
WHERE ws.week_start >= date_trunc('week', CURRENT_DATE);

-- View for work hours audit report
CREATE OR REPLACE VIEW v_work_hours_audit_report AS
SELECT
  wha.id,
  wha.user_id,
  u.name as user_name,
  wha.action,
  wha.week_start,
  wha.day_of_week,
  to_char(wha.week_start + wha.day_of_week * INTERVAL '1 day', 'Day DD.MM.YYYY') as day_label,
  wha.old_start_time,
  wha.old_end_time,
  wha.new_start_time,
  wha.new_end_time,
  wha.hours_difference,
  wha.changed_by,
  wha.changed_by_name,
  wha.changed_by_role,
  wha.changed_at,
  wha.ip_address
FROM work_hours_audit wha
LEFT JOIN users u ON wha.user_id = u.id
ORDER BY wha.changed_at DESC;

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert initial waste templates
INSERT INTO waste_templates (name, category, hazard_level, color, description) VALUES
  ('Biohazard Waste', 'Biological', 'critical', '#dc2626', 'Infectious biological materials'),
  ('Chemical Waste', 'Chemical', 'high', '#ea580c', 'Hazardous chemical substances'),
  ('Glass Waste', 'General', 'medium', '#2563eb', 'Broken glass and glassware'),
  ('Plastic Waste', 'General', 'low', '#16a34a', 'Non-contaminated plastic materials'),
  ('Paper Waste', 'General', 'low', '#ca8a04', 'Clean paper and cardboard');

-- Insert system flags
INSERT INTO system_flags (name, value) VALUES
  ('first_setup_completed', 'false'),
  ('database_version', '1.0.0'),
  ('migration_version', '001');
