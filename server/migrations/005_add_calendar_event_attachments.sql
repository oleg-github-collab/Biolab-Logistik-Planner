-- Add attachment support for calendar events

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_calendar_events_attachments ON calendar_events USING gin (attachments);
