-- Storage bins / Kistenmanagement tables
CREATE TABLE IF NOT EXISTS storage_bins (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) NOT NULL,
  comment TEXT,
  keep_until DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_bins_status ON storage_bins(status);
CREATE INDEX IF NOT EXISTS idx_storage_bins_keep_until ON storage_bins(keep_until);

CREATE TABLE IF NOT EXISTS storage_bin_audit (
  id SERIAL PRIMARY KEY,
  storage_bin_id INTEGER NOT NULL REFERENCES storage_bins(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_bin_audit_bin ON storage_bin_audit(storage_bin_id);
