-- Migration: Schedule templates and seasonal assignments

CREATE TABLE IF NOT EXISTS schedule_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  pattern JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_template_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_template_assignments_user ON schedule_template_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_template_assignments_range ON schedule_template_assignments(start_date, end_date);

-- Seed default templates if they don't exist
INSERT INTO schedule_templates (name, description, is_global, is_default, pattern)
VALUES
  (
    'Vollzeit 40h',
    'Mo–Fr 08:00–12:00 + 12:30–16:30',
    TRUE,
    TRUE,
    '{
      "days": [
        {"dayOfWeek":0,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"},{"start":"12:30","end":"16:30"}]},
        {"dayOfWeek":1,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"},{"start":"12:30","end":"16:30"}]},
        {"dayOfWeek":2,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"},{"start":"12:30","end":"16:30"}]},
        {"dayOfWeek":3,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"},{"start":"12:30","end":"16:30"}]},
        {"dayOfWeek":4,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"},{"start":"12:30","end":"16:30"}]},
        {"dayOfWeek":5,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":6,"is_working":false,"time_blocks":[]}
      ]
    }'::jsonb
  ),
  (
    'Teilzeit 30h',
    'Mo–Do 08:30–15:30, Fr frei',
    TRUE,
    FALSE,
    '{
      "days": [
        {"dayOfWeek":0,"is_working":true,"time_blocks":[{"start":"08:30","end":"15:30"}]},
        {"dayOfWeek":1,"is_working":true,"time_blocks":[{"start":"08:30","end":"15:30"}]},
        {"dayOfWeek":2,"is_working":true,"time_blocks":[{"start":"08:30","end":"15:30"}]},
        {"dayOfWeek":3,"is_working":true,"time_blocks":[{"start":"08:30","end":"15:30"}]},
        {"dayOfWeek":4,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":5,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":6,"is_working":false,"time_blocks":[]}
      ]
    }'::jsonb
  ),
  (
    'Teilzeit 20h',
    'Mo–Fr 08:00–12:00',
    TRUE,
    FALSE,
    '{
      "days": [
        {"dayOfWeek":0,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"}]},
        {"dayOfWeek":1,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"}]},
        {"dayOfWeek":2,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"}]},
        {"dayOfWeek":3,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"}]},
        {"dayOfWeek":4,"is_working":true,"time_blocks":[{"start":"08:00","end":"12:00"}]},
        {"dayOfWeek":5,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":6,"is_working":false,"time_blocks":[]}
      ]
    }'::jsonb
  ),
  (
    'Mini 10h',
    'Di/Do 09:00–14:00',
    TRUE,
    FALSE,
    '{
      "days": [
        {"dayOfWeek":0,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":1,"is_working":true,"time_blocks":[{"start":"09:00","end":"14:00"}]},
        {"dayOfWeek":2,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":3,"is_working":true,"time_blocks":[{"start":"09:00","end":"14:00"}]},
        {"dayOfWeek":4,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":5,"is_working":false,"time_blocks":[]},
        {"dayOfWeek":6,"is_working":false,"time_blocks":[]}
      ]
    }'::jsonb
  )
ON CONFLICT (name) DO NOTHING;
