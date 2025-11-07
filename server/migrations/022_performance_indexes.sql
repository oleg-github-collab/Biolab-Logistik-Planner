-- Add performance indexes for commonly queried columns

-- Calendar Events Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

-- Knowledge Base Indexes
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_id ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author_id ON kb_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_created_at ON kb_articles(created_at DESC);

-- Full-text search index for KB articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_title_search ON kb_articles USING gin(to_tsvector('german', title));
CREATE INDEX IF NOT EXISTS idx_kb_articles_content_search ON kb_articles USING gin(to_tsvector('german', content));

-- Waste Management Indexes
CREATE INDEX IF NOT EXISTS idx_waste_items_template_id ON waste_items(template_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_status ON waste_items(status);
CREATE INDEX IF NOT EXISTS idx_waste_items_next_disposal_date ON waste_items(next_disposal_date);
CREATE INDEX IF NOT EXISTS idx_waste_items_assigned_to ON waste_items(assigned_to);

-- Messages Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- User Preferences Index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Notifications Index
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

COMMENT ON INDEX idx_calendar_events_start_time IS 'Improves event range queries';
COMMENT ON INDEX idx_tasks_assigned_to IS 'Improves user task lookups';
COMMENT ON INDEX idx_kb_articles_title_search IS 'Full-text search on article titles';
