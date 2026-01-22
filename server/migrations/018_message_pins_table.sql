-- Migration 018: Add message pins table (optional, will work even if 016 failed)

CREATE TABLE IF NOT EXISTS message_pins (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  conversation_id INTEGER NOT NULL,
  pinned_by INTEGER NOT NULL,
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_pins_message ON message_pins(message_id);
CREATE INDEX IF NOT EXISTS idx_message_pins_conversation ON message_pins(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_pins_pinned_by ON message_pins(pinned_by);
CREATE INDEX IF NOT EXISTS idx_message_pins_pinned_at ON message_pins(pinned_at DESC);
