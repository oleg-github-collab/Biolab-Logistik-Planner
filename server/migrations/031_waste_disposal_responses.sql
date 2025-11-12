-- ==========================================================================
-- Migration 031: Track Entsorgungsbot responses to reminders
-- ==========================================================================

CREATE TABLE IF NOT EXISTS waste_disposal_schedule_responses (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES waste_disposal_schedule(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL CHECK (action IN ('acknowledge', 'defer')),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waste_disposal_schedule_responses_schedule
  ON waste_disposal_schedule_responses(schedule_id);
