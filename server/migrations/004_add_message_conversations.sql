-- Introduce structured conversations for messaging (direct, group, topic)

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

-- Extend messages table to support conversations & attachments
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE messages
  ALTER COLUMN receiver_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
