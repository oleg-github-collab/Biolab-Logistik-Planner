-- Migration: Allow NULL employment_type and weekly_hours_quota for observer role
-- Date: 2026-02-01
-- Description: Observer role doesn't need time tracking fields

-- Remove NOT NULL constraint from employment_type
ALTER TABLE users ALTER COLUMN employment_type DROP NOT NULL;

-- Remove NOT NULL constraint from weekly_hours_quota (if exists)
ALTER TABLE users ALTER COLUMN weekly_hours_quota DROP NOT NULL;

-- Update existing observers to have NULL values
UPDATE users
SET employment_type = NULL, weekly_hours_quota = NULL
WHERE role = 'observer' AND (employment_type IS NOT NULL OR weekly_hours_quota IS NOT NULL);

-- Add comment
COMMENT ON COLUMN users.employment_type IS 'Employment type (NULL for observer role)';
COMMENT ON COLUMN users.weekly_hours_quota IS 'Weekly hours quota (NULL for observer role)';
