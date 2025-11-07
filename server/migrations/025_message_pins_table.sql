-- Migration 025: Add message pins table for pinned messages in conversations
-- This allows users to pin important messages in conversations

CREATE TABLE IF NOT EXISTS message_pins (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  conversation_id INTEGER NOT NULL,
  pinned_by INTEGER NOT NULL,
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_pins_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_pins_conversation FOREIGN KEY (conversation_id) REFERENCES message_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_pins_user FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_message_pin UNIQUE (message_id, conversation_id)
);

-- Add indexes for performance
CREATE INDEX idx_message_pins_message ON message_pins(message_id);
CREATE INDEX idx_message_pins_conversation ON message_pins(conversation_id);
CREATE INDEX idx_message_pins_pinned_by ON message_pins(pinned_by);
CREATE INDEX idx_message_pins_pinned_at ON message_pins(pinned_at DESC);

-- Comments
COMMENT ON TABLE message_pins IS 'Stores pinned messages for conversations';
COMMENT ON COLUMN message_pins.message_id IS 'ID of the pinned message';
COMMENT ON COLUMN message_pins.conversation_id IS 'ID of the conversation where message is pinned';
COMMENT ON COLUMN message_pins.pinned_by IS 'User who pinned the message';
COMMENT ON COLUMN message_pins.pinned_at IS 'When the message was pinned';
