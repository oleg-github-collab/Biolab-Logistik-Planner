-- Calendar Events Table
-- Standalone calendar events (not linked to messages)

CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,

  -- Event metadata
  event_type VARCHAR(50) DEFAULT 'meeting',
  priority VARCHAR(20) DEFAULT 'normal',
  location VARCHAR(500),
  attendees JSONB,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled',

  -- Audit
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);

COMMENT ON TABLE calendar_events IS 'Standalone calendar events for scheduling';
