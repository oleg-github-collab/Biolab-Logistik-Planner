-- EntsorgungBot calendar integration for waste disposal schedule

ALTER TABLE waste_disposal_schedule
  ADD COLUMN IF NOT EXISTS calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_bot_notification_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_waste_disposal_calendar ON waste_disposal_schedule(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_last_bot ON waste_disposal_schedule(last_bot_notification_at);
