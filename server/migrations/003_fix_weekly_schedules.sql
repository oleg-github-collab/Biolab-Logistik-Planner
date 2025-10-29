-- Add missing last_updated_by column to weekly_schedules

ALTER TABLE weekly_schedules
  ADD COLUMN IF NOT EXISTS last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_schedules_updated_by ON weekly_schedules(last_updated_by);
