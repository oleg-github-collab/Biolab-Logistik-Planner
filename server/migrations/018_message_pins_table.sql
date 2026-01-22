-- Migration 018: Add message pins table (AFTER 016_message_system)

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

CREATE INDEX IF NOT EXISTS idx_message_pins_message ON message_pins(message_id);
CREATE INDEX IF NOT EXISTS idx_message_pins_conversation ON message_pins(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_pins_pinned_by ON message_pins(pinned_by);
CREATE INDEX IF NOT EXISTS idx_message_pins_pinned_at ON message_pins(pinned_at DESC);
