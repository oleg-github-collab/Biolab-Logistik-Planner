-- Fix task_pool table - add missing columns for help requests

-- Add missing columns if they don't exist
ALTER TABLE task_pool
  ADD COLUMN IF NOT EXISTS help_requested_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS help_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS help_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS help_request_status VARCHAR(50);

-- Remove old column if it exists
ALTER TABLE task_pool DROP COLUMN IF EXISTS help_requested_user_id;

-- Create task_help_requests table if not exists
CREATE TABLE IF NOT EXISTS task_help_requests (
  id SERIAL PRIMARY KEY,
  task_pool_id INTEGER NOT NULL REFERENCES task_pool(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_help_requests_pool ON task_help_requests(task_pool_id);
CREATE INDEX IF NOT EXISTS idx_task_help_requests_user ON task_help_requests(requested_user_id, status);

-- Create task_comments table if not exists (used by task completion)
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
