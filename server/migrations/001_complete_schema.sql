-- Biolab Logistik Planner - Complete Database Schema
-- Single migration file with all tables

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- USERS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin', 'superadmin')),
  employment_type VARCHAR(50) NOT NULL DEFAULT 'Werkstudent' CHECK (employment_type IN ('Vollzeit', 'Werkstudent')),

  -- Work configuration
  weekly_hours_quota NUMERIC(5,2) DEFAULT 20.0,
  auto_schedule BOOLEAN DEFAULT FALSE,
  default_start_time TIME DEFAULT '08:00',
  default_end_time TIME DEFAULT '17:00',

  -- Profile
  profile_photo VARCHAR(500),
  status VARCHAR(100) DEFAULT 'available',
  status_message VARCHAR(500),
  bio TEXT,
  position_description TEXT,
  phone VARCHAR(50),
  phone_mobile VARCHAR(50),
  emergency_contact VARCHAR(200),
  emergency_phone VARCHAR(50),
  address TEXT,
  date_of_birth DATE,
  hire_date DATE,
  timezone VARCHAR(100) DEFAULT 'Europe/Berlin',
  language VARCHAR(10) DEFAULT 'de',
  theme VARCHAR(20) DEFAULT 'light',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  first_login_completed BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ==============================================
-- WEEKLY SCHEDULES
-- ==============================================
CREATE TABLE IF NOT EXISTS weekly_schedules (
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
  UNIQUE(user_id, week_start, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user ON weekly_schedules(user_id, week_start);

-- ==============================================
-- CALENDAR EVENTS
-- ==============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  location VARCHAR(500),
  event_type VARCHAR(50) DEFAULT 'meeting',
  color VARCHAR(50),
  attendees TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_creator ON calendar_events(created_by);

-- ==============================================
-- TASKS
-- ==============================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority VARCHAR(50) DEFAULT 'medium',
  due_date DATE,
  category VARCHAR(100),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- ==============================================
-- TASK POOL
-- ==============================================
CREATE TABLE IF NOT EXISTS task_pool (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  task_title VARCHAR(500),
  task_priority VARCHAR(20),
  estimated_duration INTEGER,
  status VARCHAR(50) DEFAULT 'available',
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,
  help_requested_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_request_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_pool_date ON task_pool(available_date, status);
CREATE INDEX IF NOT EXISTS idx_task_pool_assigned ON task_pool(assigned_to);

-- ==============================================
-- MESSAGES
-- ==============================================
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_status BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, read_status);

-- ==============================================
-- MESSAGE REACTIONS
-- ==============================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- ==============================================
-- NOTIFICATIONS
-- ==============================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  action_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ==============================================
-- WASTE MANAGEMENT
-- ==============================================
CREATE TABLE IF NOT EXISTS waste_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  hazard_level VARCHAR(50) NOT NULL CHECK (hazard_level IN ('low', 'medium', 'high', 'critical')),
  disposal_frequency_days INTEGER,
  disposal_instructions TEXT,
  default_frequency VARCHAR(50) DEFAULT 'weekly',
  waste_code VARCHAR(100),
  color VARCHAR(50),
  icon VARCHAR(50),
  description TEXT,
  safety_instructions TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waste_templates_category ON waste_templates(category);
CREATE INDEX IF NOT EXISTS idx_waste_templates_hazard ON waste_templates(hazard_level);

CREATE TABLE IF NOT EXISTS waste_items (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES waste_templates(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'archived')),
  last_disposal_date TIMESTAMP,
  next_disposal_date TIMESTAMP,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notification_users JSONB DEFAULT '[]',
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waste_items_template ON waste_items(template_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_status ON waste_items(status);
CREATE INDEX IF NOT EXISTS idx_waste_items_assigned ON waste_items(assigned_to);

CREATE TABLE IF NOT EXISTS waste_disposal_schedule (
  id SERIAL PRIMARY KEY,
  waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP NOT NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'rescheduled', 'completed', 'overdue', 'cancelled')),
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actual_date TIMESTAMP,
  reminder_dates JSONB DEFAULT '[]',
  reminder_sent BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),
  recurrence_end_date TIMESTAMP,
  next_occurrence TIMESTAMP,
  priority VARCHAR(50) DEFAULT 'medium',
  disposal_method VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(50),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waste_disposal_item ON waste_disposal_schedule(waste_item_id);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_scheduled ON waste_disposal_schedule(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_assigned ON waste_disposal_schedule(assigned_to);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_status ON waste_disposal_schedule(status);

-- ==============================================
-- SYSTEM FLAGS
-- ==============================================
CREATE TABLE IF NOT EXISTS system_flags (
  name VARCHAR(255) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert first_setup flag
INSERT INTO system_flags (name, value, description)
VALUES ('first_setup_completed', 'false', 'Whether initial superadmin setup has been completed')
ON CONFLICT (name) DO NOTHING;

-- ==============================================
-- UPDATE TRIGGERS
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

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waste_templates_updated_at BEFORE UPDATE ON waste_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waste_items_updated_at BEFORE UPDATE ON waste_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waste_disposal_updated_at BEFORE UPDATE ON waste_disposal_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration complete
SELECT 'Database schema initialized successfully' AS status;
