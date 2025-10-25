-- Add Missing Columns to Users and Task Pool Tables

-- ============================================
-- USERS TABLE - Profile & Contact Info
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_description VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_mobile VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Berlin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'de';
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- USER PREFERENCES - Extended Settings
-- ============================================

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS desktop_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_tasks BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_mentions BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_reactions BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_calendar BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS compact_view BOOLEAN DEFAULT FALSE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS show_avatars BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS message_preview BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TIME;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TIME;

-- ============================================
-- TASKS TABLE - Additional Fields
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;

-- ============================================
-- TASK POOL - Help Request Fields
-- ============================================

ALTER TABLE task_pool ADD COLUMN IF NOT EXISTS help_requested_from INTEGER REFERENCES users(id);
ALTER TABLE task_pool ADD COLUMN IF NOT EXISTS help_request_message TEXT;
ALTER TABLE task_pool ADD COLUMN IF NOT EXISTS help_requested_at TIMESTAMP;

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

COMMENT ON COLUMN users.profile_photo IS 'URL/path to user profile photo';
COMMENT ON COLUMN users.status IS 'User online status: available, busy, away, offline';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active';
COMMENT ON COLUMN task_pool.help_requested_from IS 'User ID from whom help was requested';
