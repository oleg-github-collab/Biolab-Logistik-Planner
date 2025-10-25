-- Enhanced Features: User Profiles, Mentions, Quotes, Notifications, Task Pool
-- Migration 005

-- ============================================
-- USER PROFILES & SETTINGS
-- ============================================

-- User profile settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'available'; -- available, busy, away, offline
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_mobile VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Europe/Berlin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'de';
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light'; -- light, dark, auto

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  desktop_notifications BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,

  -- Notification types
  notify_messages BOOLEAN DEFAULT TRUE,
  notify_tasks BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_reactions BOOLEAN DEFAULT TRUE,
  notify_calendar BOOLEAN DEFAULT TRUE,

  -- Display preferences
  compact_view BOOLEAN DEFAULT FALSE,
  show_avatars BOOLEAN DEFAULT TRUE,
  message_preview BOOLEAN DEFAULT TRUE,

  -- Working hours notifications only
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ENHANCED MESSAGING FEATURES
-- ============================================

-- Message mentions (@user tagging)
CREATE TABLE IF NOT EXISTS message_mentions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Position in message text
  start_position INTEGER,
  end_position INTEGER,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id, is_read);

-- Message quotes/replies
CREATE TABLE IF NOT EXISTS message_quotes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, -- The new message
  quoted_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, -- The quoted message
  quoted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Quoted text excerpt (in case original is deleted)
  quoted_text TEXT,
  quoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, quoted_message_id)
);

-- Calendar event references in messages
CREATE TABLE IF NOT EXISTS message_calendar_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Reference details
  ref_type VARCHAR(50) DEFAULT 'mention', -- mention, share, invite
  ref_text TEXT, -- How it appeared in message

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task references in messages
CREATE TABLE IF NOT EXISTS message_task_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,

  -- Reference details
  ref_type VARCHAR(50) DEFAULT 'mention', -- mention, share, created
  ref_text TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ENHANCED NOTIFICATIONS
-- ============================================

-- Unified notification system
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification type
  type VARCHAR(50) NOT NULL, -- message, mention, reaction, task_assigned, task_due, calendar_event, system

  -- Title and content
  title VARCHAR(500) NOT NULL,
  content TEXT,

  -- Related entities
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  -- Display
  icon VARCHAR(100),
  color VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent

  -- Action link
  action_url VARCHAR(500),
  action_text VARCHAR(100),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);

-- Notification read receipts (for tracking read status accurately)
CREATE TABLE IF NOT EXISTS notification_read_status (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER, -- NULL for global
  last_read_message_id INTEGER,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unread_count INTEGER DEFAULT 0,

  PRIMARY KEY(user_id, conversation_id)
);

-- ============================================
-- TASK POOL & ASSIGNMENT SYSTEM
-- ============================================

-- Daily task pool (available tasks for the day)
CREATE TABLE IF NOT EXISTS task_pool (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Scheduling
  available_date DATE NOT NULL,

  -- Task details (denormalized for quick access)
  task_title VARCHAR(500),
  task_priority VARCHAR(20),
  estimated_duration INTEGER, -- minutes
  required_skills TEXT[], -- Array of skill tags

  -- Assignment status
  status VARCHAR(50) DEFAULT 'available', -- available, claimed, assigned, in_progress, completed

  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,

  -- Claiming (user takes task themselves)
  claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,

  -- Request for help (user tags another user)
  help_requested_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_request_message TEXT,
  help_requested_at TIMESTAMP,
  help_request_status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(100), -- daily, weekly, monthly, custom
  parent_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_pool_date_status ON task_pool(available_date, status);
CREATE INDEX IF NOT EXISTS idx_task_pool_assigned ON task_pool(assigned_to, available_date);

-- Task help requests (collaboration)
CREATE TABLE IF NOT EXISTS task_help_requests (
  id SERIAL PRIMARY KEY,
  task_pool_id INTEGER NOT NULL REFERENCES task_pool(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_from INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  message TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined, cancelled

  response_message TEXT,
  responded_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONTACTS & USER DIRECTORY
-- ============================================

-- User contacts (all users are contacts by default, but can customize)
CREATE TABLE IF NOT EXISTS user_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Custom labels/notes
  nickname VARCHAR(255),
  notes TEXT,

  -- Favorites
  is_favorite BOOLEAN DEFAULT FALSE,

  -- Contact groups
  groups TEXT[], -- Array of group names

  -- Block/mute
  is_blocked BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contacts_user ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_favorite ON user_contacts(user_id, is_favorite);

-- ============================================
-- KANBAN ENHANCEMENTS
-- ============================================

-- Add personal vs team task visibility
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'team'; -- personal, team, public
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_for_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Task filters and saved views
CREATE TABLE IF NOT EXISTS kanban_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Filter configuration
  filter_config JSONB NOT NULL,
  /* Example:
  {
    "visibility": "personal",
    "status": ["todo", "in_progress"],
    "assigned_to": "me",
    "priority": ["high", "urgent"],
    "due_date": "this_week"
  }
  */

  is_default BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUPERADMIN ENHANCEMENTS
-- ============================================

-- Calendar event templates (for superadmin to create quick events)
CREATE TABLE IF NOT EXISTS calendar_templates (
  id SERIAL PRIMARY KEY,
  created_by INTEGER NOT NULL REFERENCES users(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Template defaults
  event_type VARCHAR(50),
  duration_minutes INTEGER DEFAULT 60,
  default_title VARCHAR(500),
  default_location VARCHAR(500),
  default_attendees INTEGER[], -- Array of default attendee IDs

  -- Recurrence defaults
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(100),

  -- Permissions
  is_public BOOLEAN DEFAULT FALSE, -- Available to all admins

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task templates with more flexibility (already exists in 003, adding more fields)
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS estimated_duration INTEGER; -- minutes
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS required_skills TEXT[];
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS auto_assign_rules JSONB;
/* Example auto_assign_rules:
{
  "by_skill": true,
  "by_availability": true,
  "round_robin": false,
  "preferred_users": [1, 2, 3]
}
*/

-- Admin action logs (track what admins do)
CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id),

  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(100), -- user, task, event, etc.
  target_id INTEGER,

  description TEXT NOT NULL,
  details JSONB, -- Additional action details

  ip_address VARCHAR(100),
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type, created_at DESC);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update user last_seen
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on messages to update last_seen
DROP TRIGGER IF EXISTS trigger_update_last_seen_on_message ON messages;
CREATE TRIGGER trigger_update_last_seen_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_seen();

-- Function to create notification on mention
CREATE OR REPLACE FUNCTION create_mention_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, related_user_id, message_id, priority
  )
  SELECT
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    (SELECT SUBSTRING(content, 1, 100) FROM messages WHERE id = NEW.message_id),
    NEW.mentioned_by,
    NEW.message_id,
    'high'
  FROM messages WHERE id = NEW.message_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mention notifications
DROP TRIGGER IF EXISTS trigger_mention_notification ON message_mentions;
CREATE TRIGGER trigger_mention_notification
  AFTER INSERT ON message_mentions
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notification();

-- Function to create notification on reaction
CREATE OR REPLACE FUNCTION create_reaction_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, related_user_id, message_id, priority
  )
  SELECT
    m.sender_id,
    'reaction',
    'Someone reacted to your message',
    NEW.emoji,
    NEW.user_id,
    NEW.message_id,
    'normal'
  FROM messages m
  WHERE m.id = NEW.message_id AND m.sender_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reaction notifications
DROP TRIGGER IF EXISTS trigger_reaction_notification ON message_reactions;
CREATE TRIGGER trigger_reaction_notification
  AFTER INSERT ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION create_reaction_notification();

-- Function to update notification read status
CREATE OR REPLACE FUNCTION update_notification_read_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update read count when notification is marked as read
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    UPDATE notification_read_status
    SET unread_count = GREATEST(unread_count - 1, 0)
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for notification read count
DROP TRIGGER IF EXISTS trigger_notification_read_count ON notifications;
CREATE TRIGGER trigger_notification_read_count
  AFTER UPDATE ON notifications
  FOR EACH ROW
  WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
  EXECUTE FUNCTION update_notification_read_count();

-- ============================================
-- VIEWS FOR QUICK ACCESS
-- ============================================

-- View: All users as contacts (for quick access)
CREATE OR REPLACE VIEW v_all_user_contacts AS
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.profile_photo,
  u.status,
  u.status_message,
  u.position_description,
  u.last_seen_at,
  u.created_at
FROM users u
WHERE u.is_active = TRUE
ORDER BY u.name;

-- View: Unread notification count per user
CREATE OR REPLACE VIEW v_user_unread_counts AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE type = 'message') as unread_messages,
  COUNT(*) FILTER (WHERE type = 'mention') as unread_mentions,
  COUNT(*) FILTER (WHERE type = 'task_assigned') as unread_tasks,
  COUNT(*) as total_unread
FROM notifications
WHERE is_read = FALSE
GROUP BY user_id;

-- View: Available tasks for today
CREATE OR REPLACE VIEW v_today_available_tasks AS
SELECT
  tp.*,
  t.title,
  t.description,
  t.priority,
  t.status as task_status,
  u.name as assigned_to_name
FROM task_pool tp
LEFT JOIN tasks t ON tp.task_id = t.id
LEFT JOIN users u ON tp.assigned_to = u.id
WHERE tp.available_date = CURRENT_DATE
  AND tp.status IN ('available', 'claimed')
ORDER BY t.priority DESC, tp.created_at ASC;

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default user preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Create default kanban view for all users
INSERT INTO kanban_views (user_id, name, filter_config, is_default)
SELECT
  id,
  'My Tasks',
  '{"visibility": "personal", "assigned_to": "me"}'::jsonb,
  TRUE
FROM users
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_profile ON users(is_active, role);
CREATE INDEX IF NOT EXISTS idx_message_quotes_quoted ON message_quotes(quoted_message_id);
CREATE INDEX IF NOT EXISTS idx_task_pool_help_requests ON task_help_requests(requested_from, status);
CREATE INDEX IF NOT EXISTS idx_calendar_refs ON message_calendar_refs(event_id);
CREATE INDEX IF NOT EXISTS idx_task_refs ON message_task_refs(task_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notifications IS 'Unified notification system for all user notifications';
COMMENT ON TABLE message_mentions IS 'User mentions (@username) in messages';
COMMENT ON TABLE message_quotes IS 'Message quotes/replies in conversations';
COMMENT ON TABLE task_pool IS 'Daily available tasks that users can claim or be assigned';
COMMENT ON TABLE user_contacts IS 'User contact list with custom labels and settings';
COMMENT ON TABLE user_preferences IS 'User notification and display preferences';

-- Migration complete
SELECT 'Migration 005 completed successfully' AS status;
