-- =============================================================================
-- Biolab Logistik Planner
-- Initial PostgreSQL schema (drop-in replacement for Railway deployment)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Utility Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users & Preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin', 'superadmin')),
  employment_type VARCHAR(50) NOT NULL DEFAULT 'Werkstudent' CHECK (employment_type IN ('Vollzeit', 'Werkstudent')),
  weekly_hours_quota NUMERIC(5,2) DEFAULT 20.0,
  auto_schedule BOOLEAN DEFAULT FALSE,
  default_start_time TIME DEFAULT '08:00',
  default_end_time TIME DEFAULT '17:00',
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
  is_active BOOLEAN DEFAULT TRUE,
  first_login_completed BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  desktop_notifications BOOLEAN DEFAULT FALSE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  notify_messages BOOLEAN DEFAULT TRUE,
  notify_tasks BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_reactions BOOLEAN DEFAULT TRUE,
  notify_calendar BOOLEAN DEFAULT TRUE,
  compact_view BOOLEAN DEFAULT FALSE,
  show_avatars BOOLEAN DEFAULT TRUE,
  message_preview BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Scheduling & Work Hours
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  is_absent BOOLEAN DEFAULT FALSE,
  absence_reason TEXT,
  notes TEXT,
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start, day_of_week)
);

ALTER TABLE weekly_schedules
  ADD COLUMN IF NOT EXISTS last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user_week ON weekly_schedules(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_updated_by ON weekly_schedules(last_updated_by);

CREATE TABLE IF NOT EXISTS work_hours_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  change_type VARCHAR(20) NOT NULL,
  previous_start_time TIME,
  previous_end_time TIME,
  previous_is_working BOOLEAN,
  new_start_time TIME,
  new_end_time TIME,
  new_is_working BOOLEAN,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_work_hours_audit_user_week ON work_hours_audit(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_work_hours_audit_changed_at ON work_hours_audit(changed_at DESC);

-- ---------------------------------------------------------------------------
-- Calendar Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  event_type VARCHAR(50) DEFAULT 'meeting',
  color VARCHAR(50),
  location VARCHAR(500),
  attendees JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  cover_image VARCHAR(500),
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'confirmed',
  category VARCHAR(50) DEFAULT 'work',
  reminder INTEGER DEFAULT 15,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(30),
  recurrence_end_date TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'work',
  ADD COLUMN IF NOT EXISTS reminder INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(30),
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'calendar_events'
      AND column_name = 'attendees'
      AND data_type <> 'jsonb'
  ) THEN
    -- Create temporary function for conversion
    CREATE OR REPLACE FUNCTION convert_attendees_to_jsonb(attendees_text TEXT)
    RETURNS JSONB AS $func$
    BEGIN
      IF attendees_text IS NULL THEN
        RETURN '[]'::jsonb;
      ELSIF attendees_text ~ '^\s*\[.*\]\s*$' THEN
        RETURN attendees_text::jsonb;
      ELSE
        RETURN jsonb_strip_nulls(
          COALESCE(
            (
              SELECT jsonb_agg(NULLIF(trim(both '"' FROM trim(value)), ''))
              FROM regexp_split_to_table(replace(attendees_text, ';', ','), ',') AS value
            ),
            '[]'::jsonb
          )
        );
      END IF;
    END;
    $func$ LANGUAGE plpgsql IMMUTABLE;

    ALTER TABLE calendar_events
      ALTER COLUMN attendees TYPE JSONB
      USING convert_attendees_to_jsonb(attendees);

    DROP FUNCTION IF EXISTS convert_attendees_to_jsonb(TEXT);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events') THEN
    UPDATE calendar_events
       SET attachments = COALESCE(attachments, '[]'::jsonb),
           tags = COALESCE(tags, '[]'::jsonb),
           attendees = COALESCE(attendees, '[]'::jsonb),
           priority = COALESCE(priority, 'medium'),
           status = COALESCE(status, 'confirmed'),
           category = COALESCE(category, 'work'),
           reminder = COALESCE(reminder, 15),
           is_recurring = COALESCE(is_recurring, FALSE)
     WHERE TRUE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_creator ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring ON calendar_events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tags ON calendar_events USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_calendar_events_attendees ON calendar_events USING gin (attendees);

-- ---------------------------------------------------------------------------
-- Tasks & Task Pool
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    UPDATE tasks
       SET tags = COALESCE(tags, '[]'::jsonb)
     WHERE TRUE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING gin (tags);

CREATE TABLE IF NOT EXISTS task_pool (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  task_title VARCHAR(500),
  task_priority VARCHAR(20),
  estimated_duration INTEGER,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'in_progress', 'completed', 'help_requested')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,
  help_requested_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_requested_at TIMESTAMP,
  help_request_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_pool
  ADD COLUMN IF NOT EXISTS help_requested_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS help_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS help_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS help_request_status VARCHAR(50);

ALTER TABLE task_pool
  DROP COLUMN IF EXISTS help_requested_user_id;

CREATE INDEX IF NOT EXISTS idx_task_pool_date_status ON task_pool(available_date, status);
CREATE INDEX IF NOT EXISTS idx_task_pool_assigned ON task_pool(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_pool_claimed ON task_pool(claimed_by);

CREATE TABLE IF NOT EXISTS task_help_requests (
  id SERIAL PRIMARY KEY,
  task_pool_id INTEGER NOT NULL REFERENCES task_pool(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_help_requests_pool ON task_help_requests(task_pool_id);
CREATE INDEX IF NOT EXISTS idx_task_help_requests_user ON task_help_requests(requested_user_id, status);

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- ---------------------------------------------------------------------------
-- Messaging & Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_conversations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  conversation_type VARCHAR(20) NOT NULL DEFAULT 'group' CHECK (conversation_type IN ('direct', 'group', 'topic')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_temporary BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_conversations_type ON message_conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_message_conversations_creator ON message_conversations(created_by);

CREATE TABLE IF NOT EXISTS message_conversation_members (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_members_user ON message_conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_members_conversation ON message_conversation_members(conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  is_group BOOLEAN DEFAULT FALSE,
  read_status BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  delivered_status BOOLEAN DEFAULT FALSE,
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'messages'
      AND column_name = 'receiver_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE messages
      ALTER COLUMN receiver_id DROP NOT NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    UPDATE messages
       SET attachments = COALESCE(attachments, '[]'::jsonb),
           metadata = COALESCE(metadata, '{}'::jsonb),
           updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
     WHERE TRUE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, read_status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_reaction UNIQUE (message_id, user_id, emoji)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'message_reactions'
      AND constraint_name = 'uq_message_reaction'
  ) THEN
    ALTER TABLE message_reactions
      ADD CONSTRAINT uq_message_reaction UNIQUE (message_id, user_id, emoji);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

CREATE TABLE IF NOT EXISTS message_quotes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  snippet TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_quotes_message ON message_quotes(message_id);
CREATE INDEX IF NOT EXISTS idx_message_quotes_original ON message_quotes(quoted_message_id);

CREATE TABLE IF NOT EXISTS message_mentions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  CONSTRAINT uq_message_mentions UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS message_calendar_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_calendar_refs UNIQUE (message_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_message_calendar_refs_event ON message_calendar_refs(event_id);

CREATE TABLE IF NOT EXISTS message_task_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_task_refs UNIQUE (message_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_message_task_refs_task ON message_task_refs(task_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
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
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    UPDATE notifications
       SET metadata = COALESCE(metadata, '{}'::jsonb),
           updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
     WHERE TRUE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ---------------------------------------------------------------------------
-- Knowledge Base
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100) DEFAULT '📄',
  color VARCHAR(20) DEFAULT '#3B82F6',
  parent_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON kb_categories(is_active);

CREATE TABLE IF NOT EXISTS kb_articles (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(600) NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  visibility VARCHAR(20) DEFAULT 'all',
  is_featured BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]'::jsonb,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP,
  cover_image VARCHAR(500),
  reading_time INTEGER,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS reading_time INTEGER,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kb_articles') THEN
    UPDATE kb_articles
       SET tags = COALESCE(tags, '[]'::jsonb),
           helpful_count = COALESCE(helpful_count, 0),
           not_helpful_count = COALESCE(not_helpful_count, 0),
           view_count = COALESCE(view_count, 0),
           is_featured = COALESCE(is_featured, FALSE),
           visibility = COALESCE(visibility, 'all')
     WHERE TRUE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_featured ON kb_articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tags ON kb_articles USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles USING gin (to_tsvector('english'::regconfig, coalesce(title,'') || ' ' || coalesce(content,'')));

CREATE TABLE IF NOT EXISTS kb_article_revisions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  title VARCHAR(500),
  summary TEXT,
  content TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20),
  editor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kb_media (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_type VARCHAR(50),
  width INTEGER,
  height INTEGER,
  thumbnail_path VARCHAR(500),
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_media_article ON kb_media(article_id, display_order);

CREATE TABLE IF NOT EXISTS kb_article_feedback (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_kb_article_feedback UNIQUE (article_id, user_id)
);

CREATE TABLE IF NOT EXISTS kb_article_views (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_kb_article_views_article ON kb_article_views(article_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS kb_article_relations (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  related_article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) DEFAULT 'related',
  display_order INTEGER DEFAULT 0,
  CONSTRAINT uq_kb_article_relations UNIQUE (article_id, related_article_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_relations_article ON kb_article_relations(article_id);

CREATE TABLE IF NOT EXISTS kb_article_comments (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES kb_article_comments(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_article_comments_article ON kb_article_comments(article_id);

CREATE TABLE IF NOT EXISTS kb_bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  folder VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS kb_search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  ip_address VARCHAR(100),
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_search_history_user ON kb_search_history(user_id, searched_at DESC);

-- ---------------------------------------------------------------------------
-- Waste Management
-- ---------------------------------------------------------------------------
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
  notification_users JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE waste_items
  ADD COLUMN IF NOT EXISTS notification_users JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waste_items') THEN
    UPDATE waste_items
       SET notification_users = COALESCE(notification_users, '[]'::jsonb)
     WHERE TRUE;
  END IF;
END;
$$;

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
  reminder_dates JSONB DEFAULT '[]'::jsonb,
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
CREATE INDEX IF NOT EXISTS idx_waste_disposal_status ON waste_disposal_schedule(status);

-- ---------------------------------------------------------------------------
-- System Flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_flags (
  name VARCHAR(255) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_flags (name, value, description)
VALUES ('first_setup_completed', 'false', 'Whether initial superadmin setup has been completed')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_weekly_schedules_updated_at ON weekly_schedules;
CREATE TRIGGER trg_weekly_schedules_updated_at
  BEFORE UPDATE ON weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_task_pool_updated_at ON task_pool;
CREATE TRIGGER trg_task_pool_updated_at
  BEFORE UPDATE ON task_pool
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_message_conversations_updated_at ON message_conversations;
CREATE TRIGGER trg_message_conversations_updated_at
  BEFORE UPDATE ON message_conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_kb_categories_updated_at ON kb_categories;
CREATE TRIGGER trg_kb_categories_updated_at
  BEFORE UPDATE ON kb_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_kb_articles_updated_at ON kb_articles;
CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_waste_templates_updated_at ON waste_templates;
CREATE TRIGGER trg_waste_templates_updated_at
  BEFORE UPDATE ON waste_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_waste_items_updated_at ON waste_items;
CREATE TRIGGER trg_waste_items_updated_at
  BEFORE UPDATE ON waste_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_waste_disposal_schedule_updated_at ON waste_disposal_schedule;
CREATE TRIGGER trg_waste_disposal_schedule_updated_at
  BEFORE UPDATE ON waste_disposal_schedule
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_timestamp();

-- Audit trigger for weekly schedules
CREATE OR REPLACE FUNCTION log_weekly_schedule_changes()
RETURNS TRIGGER AS $$
DECLARE
  audit_user INTEGER;
BEGIN
  audit_user := COALESCE(NEW.last_updated_by, OLD.last_updated_by);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO work_hours_audit (
      user_id, week_start, day_of_week, change_type,
      previous_start_time, previous_end_time, previous_is_working,
      new_start_time, new_end_time, new_is_working, changed_by
    ) VALUES (
      NEW.user_id, NEW.week_start, NEW.day_of_week, 'insert',
      NULL, NULL, NULL,
      NEW.start_time, NEW.end_time, NEW.is_working, audit_user
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_working IS DISTINCT FROM OLD.is_working
       OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
      INSERT INTO work_hours_audit (
        user_id, week_start, day_of_week, change_type,
        previous_start_time, previous_end_time, previous_is_working,
        new_start_time, new_end_time, new_is_working, changed_by
      ) VALUES (
        NEW.user_id, NEW.week_start, NEW.day_of_week, 'update',
        OLD.start_time, OLD.end_time, OLD.is_working,
        NEW.start_time, NEW.end_time, NEW.is_working, audit_user
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO work_hours_audit (
      user_id, week_start, day_of_week, change_type,
      previous_start_time, previous_end_time, previous_is_working,
      new_start_time, new_end_time, new_is_working, changed_by
    ) VALUES (
      OLD.user_id, OLD.week_start, OLD.day_of_week, 'delete',
      OLD.start_time, OLD.end_time, OLD.is_working,
      NULL, NULL, NULL, audit_user
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_schedules_audit ON weekly_schedules;
CREATE TRIGGER trg_weekly_schedules_audit
  AFTER INSERT OR UPDATE OR DELETE ON weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_weekly_schedule_changes();

COMMIT;
