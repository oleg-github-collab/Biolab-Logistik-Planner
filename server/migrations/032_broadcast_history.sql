-- ==========================================================================
-- Migration 032: Record admin broadcast history for auditing and replay
-- ==========================================================================

CREATE TABLE IF NOT EXISTS admin_broadcast_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'info',
  recipients INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcast_logs_admin
  ON admin_broadcast_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_broadcast_logs_created
  ON admin_broadcast_logs(created_at DESC);
