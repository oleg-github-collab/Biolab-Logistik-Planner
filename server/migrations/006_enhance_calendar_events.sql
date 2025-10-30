-- Enhance calendar_events schema for richer metadata and structured attendees

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'work',
  ADD COLUMN IF NOT EXISTS reminder INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS attendees_json JSONB DEFAULT '[]'::jsonb;

-- Normalize attendees into JSON arrays
UPDATE calendar_events
SET attendees_json = attendees::jsonb
WHERE attendees IS NOT NULL
  AND attendees ~ '^\s*\[.*\]\s*$';

UPDATE calendar_events
SET attendees_json = COALESCE((
  SELECT jsonb_agg(cleaned_email)
  FROM (
    SELECT NULLIF(trim(both '"' FROM trim(value)), '') AS cleaned_email
    FROM regexp_split_to_table(replace(attendees, ';', ','), ',') AS value
  ) AS cleaned
  WHERE cleaned_email IS NOT NULL
), '[]'::jsonb)
WHERE attendees IS NOT NULL
  AND attendees <> ''
  AND attendees_json = '[]'::jsonb;

-- Drop legacy attendees column and replace with JSONB
ALTER TABLE calendar_events
  DROP COLUMN IF EXISTS attendees;

ALTER TABLE calendar_events
  RENAME COLUMN attendees_json TO attendees;

ALTER TABLE calendar_events
  ALTER COLUMN attendees SET DEFAULT '[]'::jsonb;

UPDATE calendar_events
SET attendees = '[]'::jsonb
WHERE attendees IS NULL;

ALTER TABLE calendar_events
  ALTER COLUMN attendees SET NOT NULL;

-- Backfill defaults for new columns
UPDATE calendar_events
SET priority = COALESCE(priority, 'medium'),
    status = COALESCE(status, 'confirmed'),
    category = COALESCE(category, 'work'),
    reminder = COALESCE(reminder, 15),
    tags = COALESCE(tags, '[]'::jsonb),
    is_recurring = COALESCE(is_recurring, FALSE);

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring ON calendar_events(is_recurring);
