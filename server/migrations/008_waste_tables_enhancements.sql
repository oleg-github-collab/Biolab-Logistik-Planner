-- Migration 008: Waste Tables Enhancements
-- Add missing columns to waste_templates, waste_items, and waste_disposal_schedule

-- Add missing columns to waste_templates
ALTER TABLE waste_templates
  ADD COLUMN IF NOT EXISTS disposal_instructions TEXT,
  ADD COLUMN IF NOT EXISTS default_frequency VARCHAR(50) DEFAULT 'weekly' CHECK (default_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS default_next_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS waste_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Add missing columns to waste_items
ALTER TABLE waste_items
  ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_users JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing columns to waste_disposal_schedule
ALTER TABLE waste_disposal_schedule
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(50) CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_occurrence TIMESTAMP,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS disposal_method VARCHAR(255),
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS actual_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_waste_items_assigned ON waste_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_priority ON waste_disposal_schedule(priority);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_recurring ON waste_disposal_schedule(is_recurring);
CREATE INDEX IF NOT EXISTS idx_waste_disposal_created_by ON waste_disposal_schedule(created_by);

-- Update existing records to have sensible defaults
UPDATE waste_templates
SET default_frequency = 'weekly'
WHERE default_frequency IS NULL;

UPDATE waste_disposal_schedule
SET priority = 'medium'
WHERE priority IS NULL;

COMMIT;
