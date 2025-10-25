-- Enhanced Messenger System
-- Quick actions, calendar integration, task creation from chat, file sharing

-- Message reactions (emoji reactions)
CREATE TABLE IF NOT EXISTS message_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, user_id, emoji)
);

-- Message attachments (files, images, documents)
CREATE TABLE IF NOT EXISTS message_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- image, video, document, audio

  -- Media metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  thumbnail_path VARCHAR(1000),

  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quick actions (message templates/shortcuts)
CREATE TABLE IF NOT EXISTS message_quick_actions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for global actions

  name VARCHAR(255) NOT NULL,
  description TEXT,
  action_type VARCHAR(50) NOT NULL, -- create_task, schedule_meeting, share_kb, template_message

  -- Action configuration
  config JSONB NOT NULL, -- Configuration for the action

  -- Template message (if action_type = template_message)
  template_content TEXT,

  -- Display
  icon VARCHAR(100),
  color VARCHAR(50),
  display_order INTEGER DEFAULT 0,

  -- Permissions
  is_global BOOLEAN DEFAULT FALSE, -- Available to all users
  allowed_roles TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Message threads (organize conversations)
CREATE TABLE IF NOT EXISTS message_threads (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500),
  created_by INTEGER NOT NULL REFERENCES users(id),

  -- Thread type
  thread_type VARCHAR(50) DEFAULT 'conversation', -- conversation, task_discussion, announcement

  -- Participants
  participant_ids INTEGER[], -- Array of user IDs

  -- Associated resources
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  kb_article_id INTEGER REFERENCES kb_articles(id) ON DELETE SET NULL,

  -- Settings
  is_archived BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,

  -- Metadata
  last_message_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add thread_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES message_threads(id) ON DELETE SET NULL;

-- Message forwards/shares
CREATE TABLE IF NOT EXISTS message_forwards (
  id SERIAL PRIMARY KEY,
  original_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  forwarded_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  forwarded_by INTEGER NOT NULL REFERENCES users(id),
  forwarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled messages (send later)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES message_threads(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, cancelled
  sent_at TIMESTAMP,

  -- Recurrence (for recurring messages)
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(100),
  recurrence_config JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message pinned items (important messages)
CREATE TABLE IF NOT EXISTS message_pins (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES message_threads(id) ON DELETE CASCADE,
  pinned_by INTEGER NOT NULL REFERENCES users(id),
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id)
);

-- Message mentions (@ mentions)
CREATE TABLE IF NOT EXISTS message_mentions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by INTEGER NOT NULL REFERENCES users(id),

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, user_id)
);

-- Calendar events created from messages
CREATE TABLE IF NOT EXISTS message_calendar_events (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  description TEXT,

  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location VARCHAR(500),

  -- Attendees
  attendee_ids INTEGER[],

  -- Reminders
  reminder_minutes INTEGER[], -- [15, 60, 1440] for 15min, 1hr, 1day

  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Google Calendar integration
  google_calendar_id VARCHAR(500),
  google_event_id VARCHAR(500)
);

-- Tasks created from messages
CREATE TABLE IF NOT EXISTS message_created_tasks (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, task_id)
);

-- Message drafts (auto-save)
CREATE TABLE IF NOT EXISTS message_drafts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES message_threads(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, recipient_id, thread_id)
);

-- Voice messages metadata
CREATE TABLE IF NOT EXISTS voice_messages (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  file_path VARCHAR(1000) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  file_size BIGINT NOT NULL,

  -- Transcription (if available)
  transcription TEXT,
  transcription_confidence NUMERIC(3,2), -- 0.00 to 1.00

  waveform_data JSONB, -- For visualizing audio

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message search cache (for faster search)
CREATE TABLE IF NOT EXISTS message_search_cache (
  message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  search_vector tsvector,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_message_threads_created_by ON message_threads(created_by);
CREATE INDEX idx_message_threads_task ON message_threads(task_id);
CREATE INDEX idx_message_threads_kb ON message_threads(kb_article_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX idx_message_pins_message ON message_pins(message_id);
CREATE INDEX idx_message_pins_thread ON message_pins(thread_id);
CREATE INDEX idx_message_mentions_user ON message_mentions(user_id);
CREATE INDEX idx_message_mentions_read ON message_mentions(is_read);
CREATE INDEX idx_message_calendar_events_message ON message_calendar_events(message_id);
CREATE INDEX idx_message_created_tasks_message ON message_created_tasks(message_id);
CREATE INDEX idx_message_created_tasks_task ON message_created_tasks(task_id);
CREATE INDEX idx_message_drafts_user ON message_drafts(user_id);
CREATE INDEX idx_voice_messages_message ON voice_messages(message_id);
CREATE INDEX idx_message_search_cache_vector ON message_search_cache USING GIN(search_vector);

-- Full-text search index for messages
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(to_tsvector('english', message));

-- Trigger to update message search cache
CREATE OR REPLACE FUNCTION update_message_search_cache()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO message_search_cache (message_id, search_vector)
  VALUES (NEW.id, to_tsvector('english', NEW.message))
  ON CONFLICT (message_id) DO UPDATE
  SET search_vector = to_tsvector('english', NEW.message),
      updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_search_cache_update
  AFTER INSERT OR UPDATE OF message ON messages
  FOR EACH ROW EXECUTE FUNCTION update_message_search_cache();

-- Trigger to update thread metadata
CREATE OR REPLACE FUNCTION update_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads
    SET last_message_at = NEW.created_at,
        message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_metadata_update
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_thread_metadata();

-- Insert default quick actions
INSERT INTO message_quick_actions (name, description, action_type, config, icon, color, is_global, display_order)
VALUES
  (
    'Create Task',
    'Create a new task from this conversation',
    'create_task',
    '{"defaultPriority": "medium", "autoAssign": true}'::jsonb,
    '📋',
    '#3B82F6',
    true,
    1
  ),
  (
    'Schedule Meeting',
    'Schedule a meeting with selected participants',
    'schedule_meeting',
    '{"defaultDuration": 60, "autoInvite": true}'::jsonb,
    '📅',
    '#8B5CF6',
    true,
    2
  ),
  (
    'Share KB Article',
    'Share a knowledge base article',
    'share_kb',
    '{}'::jsonb,
    '📚',
    '#10B981',
    true,
    3
  ),
  (
    'Quick Status Update',
    'Send a quick status update',
    'template_message',
    '{}'::jsonb,
    '✅',
    '#06B6D4',
    true,
    4
  )
ON CONFLICT DO NOTHING;

COMMENT ON TABLE message_reactions IS 'Emoji reactions to messages';
COMMENT ON TABLE message_attachments IS 'Files attached to messages';
COMMENT ON TABLE message_quick_actions IS 'Quick action buttons in messenger';
COMMENT ON TABLE message_threads IS 'Organized conversation threads';
COMMENT ON TABLE message_forwards IS 'Track forwarded messages';
COMMENT ON TABLE scheduled_messages IS 'Messages scheduled for later sending';
COMMENT ON TABLE message_pins IS 'Pinned important messages';
COMMENT ON TABLE message_mentions IS 'User mentions in messages';
COMMENT ON TABLE message_calendar_events IS 'Calendar events created from messages';
COMMENT ON TABLE message_created_tasks IS 'Tasks created from message conversations';
COMMENT ON TABLE message_drafts IS 'Auto-saved message drafts';
COMMENT ON TABLE voice_messages IS 'Voice message metadata and transcriptions';
COMMENT ON TABLE message_search_cache IS 'Cached search vectors for fast message search';
