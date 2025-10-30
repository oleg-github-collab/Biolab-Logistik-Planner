-- =============================================================================
-- Messaging enhancements: quotes, mentions, references, and metadata defaults
-- =============================================================================

-- Ensure extended columns exist on messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE messages
  ALTER COLUMN attachments SET DEFAULT '[]'::jsonb,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE messages
   SET attachments = COALESCE(attachments, '[]'::jsonb),
       metadata    = COALESCE(metadata, '{}'::jsonb)
 WHERE attachments IS NULL OR metadata IS NULL;

-- ---------------------------------------------------------------------------
-- Quoted messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_quotes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  snippet TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_quotes_message
  ON message_quotes(message_id);

CREATE INDEX IF NOT EXISTS idx_message_quotes_original
  ON message_quotes(quoted_message_id);

-- ---------------------------------------------------------------------------
-- Mentions tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_mentions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_mentions
  ON message_mentions(message_id, mentioned_user_id);

CREATE INDEX IF NOT EXISTS idx_message_mentions_user
  ON message_mentions(mentioned_user_id, is_read, created_at DESC);

-- ---------------------------------------------------------------------------
-- External references (calendar & tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_calendar_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_calendar_refs
  ON message_calendar_refs(message_id, event_id);

CREATE INDEX IF NOT EXISTS idx_message_calendar_refs_event
  ON message_calendar_refs(event_id);

CREATE TABLE IF NOT EXISTS message_task_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_task_refs
  ON message_task_refs(message_id, task_id);

CREATE INDEX IF NOT EXISTS idx_message_task_refs_task
  ON message_task_refs(task_id);

-- ---------------------------------------------------------------------------
-- Reaction constraints & defaults
-- ---------------------------------------------------------------------------
ALTER TABLE message_reactions
  ADD CONSTRAINT uq_message_reaction UNIQUE (message_id, user_id, emoji);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
  ON message_reactions(user_id);
