-- =============================================================================
-- Migration 002: Align task pool schema and add user_contacts table
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Task Pool enhancements
-- ---------------------------------------------------------------------------
ALTER TABLE task_pool
  ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(50),
  ADD COLUMN IF NOT EXISTS help_request_message TEXT;

UPDATE task_pool
   SET required_skills = COALESCE(required_skills, '[]'::jsonb),
       is_recurring = COALESCE(is_recurring, FALSE)
 WHERE TRUE;

ALTER TABLE task_pool
  ALTER COLUMN required_skills SET DEFAULT '[]'::jsonb,
  ALTER COLUMN is_recurring SET DEFAULT FALSE;

-- Allow additional status values used by the API code
ALTER TABLE task_pool
  DROP CONSTRAINT IF EXISTS task_pool_status_check;

ALTER TABLE task_pool
  ADD CONSTRAINT task_pool_status_check
  CHECK (status IN ('available', 'claimed', 'assigned', 'in_progress', 'completed', 'help_requested'));

-- ---------------------------------------------------------------------------
-- User contacts table (for messaging/address book)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(255),
  notes TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  groups JSONB DEFAULT '[]'::jsonb,
  is_blocked BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contacts_user
  ON user_contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_user_contacts_contact
  ON user_contacts(contact_user_id);

COMMIT;
