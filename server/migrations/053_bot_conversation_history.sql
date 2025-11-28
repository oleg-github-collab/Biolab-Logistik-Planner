-- Migration: Bot Conversation History
-- Purpose: Store conversation history for contextual bot responses
-- Author: Claude Code
-- Date: 2025-11-28

-- Create bot_conversation_history table
CREATE TABLE IF NOT EXISTS bot_conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL, -- links to conversation_threads.id
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- for storing additional context
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for fast lookups
  CONSTRAINT bot_conversation_history_conversation_id_idx
    FOREIGN KEY (conversation_id) REFERENCES conversation_threads(id) ON DELETE CASCADE
);

-- Index for fetching conversation history by conversation_id
CREATE INDEX IF NOT EXISTS idx_bot_history_conversation
  ON bot_conversation_history(conversation_id, created_at DESC);

-- Index for fetching user's history across all conversations
CREATE INDEX IF NOT EXISTS idx_bot_history_user
  ON bot_conversation_history(user_id, created_at DESC);

-- Index for filtering by role
CREATE INDEX IF NOT EXISTS idx_bot_history_role
  ON bot_conversation_history(role);

-- Add comment
COMMENT ON TABLE bot_conversation_history IS 'Stores conversation history for BL_Bot to maintain context in group and private chats';
COMMENT ON COLUMN bot_conversation_history.conversation_id IS 'Links to conversation_threads.id (group or private chat)';
COMMENT ON COLUMN bot_conversation_history.role IS 'Message sender: user, assistant (bot), or system';
COMMENT ON COLUMN bot_conversation_history.metadata IS 'Additional context like message_id, attachments, etc.';

-- Function to clean old history (keep last 50 messages per conversation)
CREATE OR REPLACE FUNCTION cleanup_old_bot_history()
RETURNS void AS $$
BEGIN
  -- Keep only last 50 messages per conversation
  DELETE FROM bot_conversation_history
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as rn
      FROM bot_conversation_history
    ) t
    WHERE t.rn > 50
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (can be called from a cron job or manually)
COMMENT ON FUNCTION cleanup_old_bot_history() IS 'Cleans up old bot conversation history, keeping last 50 messages per conversation';
