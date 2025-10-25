-- Simplified Enhanced Features Migration
-- Contains only essential tables without complex dependencies

-- ============================================
-- USER PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(50) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'de',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,

  -- Related entities
  related_user_id INTEGER REFERENCES users(id),
  message_id INTEGER REFERENCES messages(id),
  task_id INTEGER REFERENCES tasks(id),

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- TASK POOL
-- ============================================

CREATE TABLE IF NOT EXISTS task_pool (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  available_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'available',
  assigned_to INTEGER REFERENCES users(id),
  claimed_by INTEGER REFERENCES users(id),
  claimed_at TIMESTAMP,

  -- Completion
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_pool_date ON task_pool(available_date, status);
CREATE INDEX IF NOT EXISTS idx_task_pool_assigned ON task_pool(assigned_to);

-- Task help requests
CREATE TABLE IF NOT EXISTS task_help_requests (
  id SERIAL PRIMARY KEY,
  task_pool_id INTEGER NOT NULL REFERENCES task_pool(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  requested_user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MESSAGE QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS message_quotes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, quoted_message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_quotes_message ON message_quotes(message_id);

COMMENT ON TABLE user_preferences IS 'User application preferences and settings';
COMMENT ON TABLE notifications IS 'Unified notification system';
COMMENT ON TABLE task_pool IS 'Daily available tasks that can be claimed';
COMMENT ON TABLE task_help_requests IS 'Help requests for tasks';
COMMENT ON TABLE message_quotes IS 'Message replies/quotes';
