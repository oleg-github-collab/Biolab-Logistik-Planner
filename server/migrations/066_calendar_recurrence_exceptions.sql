-- Add recurrence exceptions for calendar events
ALTER TABLE IF EXISTS calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_exceptions JSONB DEFAULT '[]'::jsonb;

UPDATE calendar_events
SET recurrence_exceptions = '[]'::jsonb
WHERE recurrence_exceptions IS NULL;
