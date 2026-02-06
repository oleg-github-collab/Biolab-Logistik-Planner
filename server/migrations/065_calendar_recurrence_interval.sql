-- Add recurrence interval for calendar events
ALTER TABLE IF EXISTS calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1;

-- Normalize existing biweekly pattern into weekly + interval 2
UPDATE calendar_events
SET recurrence_interval = 2,
    recurrence_pattern = 'weekly'
WHERE is_recurring = TRUE
  AND recurrence_pattern = 'biweekly'
  AND (recurrence_interval IS NULL OR recurrence_interval < 2);

-- Ensure recurring events have a valid interval
UPDATE calendar_events
SET recurrence_interval = 1
WHERE is_recurring = TRUE
  AND (recurrence_interval IS NULL OR recurrence_interval < 1);
