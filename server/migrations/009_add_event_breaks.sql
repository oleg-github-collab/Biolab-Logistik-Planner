-- Add breaks support to events
-- This allows users to add multiple breaks during a work day

CREATE TABLE IF NOT EXISTS event_breaks (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  break_start TIME NOT NULL,
  break_end TIME NOT NULL,
  break_type VARCHAR(50) DEFAULT 'lunch',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_breaks_event_id ON event_breaks(event_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_event_breaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_breaks_updated_at
  BEFORE UPDATE ON event_breaks
  FOR EACH ROW
  EXECUTE FUNCTION update_event_breaks_updated_at();
