-- Migration 026: Messenger Enhancements
-- Voice messages, quick replies, contact notes, message search

-- Table for quick reply templates
CREATE TABLE IF NOT EXISTS quick_reply_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  shortcut VARCHAR(20),
  category VARCHAR(50) DEFAULT 'general',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quick_reply_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_quick_reply_user ON quick_reply_templates(user_id);
CREATE INDEX idx_quick_reply_category ON quick_reply_templates(category);

-- Table for contact notes
CREATE TABLE IF NOT EXISTS contact_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_notes_contact FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_contact_note UNIQUE (user_id, contact_id)
);

CREATE INDEX idx_contact_notes_user ON contact_notes(user_id);
CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_tags ON contact_notes USING GIN(tags);

-- Add columns to messages table for voice messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER,
  ADD COLUMN IF NOT EXISTS audio_waveform JSONB,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_from_id INTEGER,
  ADD COLUMN IF NOT EXISTS forwarded_from_name VARCHAR(255);

-- Add foreign key for forwarded messages
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_forwarded_from
  FOREIGN KEY (forwarded_from_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Full-text search index for messages
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(to_tsvector('english', message));
CREATE INDEX IF NOT EXISTS idx_messages_transcription_search ON messages USING GIN(to_tsvector('english', COALESCE(transcription, '')));

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_quick_reply_templates_updated_at
  BEFORE UPDATE ON quick_reply_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_contact_notes_updated_at
  BEFORE UPDATE ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE quick_reply_templates IS 'Stores user-defined quick reply templates for fast messaging';
COMMENT ON TABLE contact_notes IS 'Stores private notes about contacts with tags';
COMMENT ON COLUMN messages.audio_duration IS 'Duration of voice message in seconds';
COMMENT ON COLUMN messages.audio_waveform IS 'Waveform data for visualization as JSON array';
COMMENT ON COLUMN messages.transcription IS 'Auto-transcribed text from voice message';
COMMENT ON COLUMN messages.is_forwarded IS 'Indicates if message was forwarded';
COMMENT ON COLUMN messages.forwarded_from_id IS 'Original message ID if forwarded';
