-- ============================================================================
-- Migration 027: Smart Notifications with AI Prioritization
-- ============================================================================
-- Adds intelligent notification features:
-- - AI-based priority scoring
-- - Do Not Disturb (DND) hours
-- - Automatic grouping
-- - User preferences
-- - Notification history and analytics
-- ============================================================================

-- Extend notifications table with smart features
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS ai_priority_score INTEGER DEFAULT 50 CHECK (ai_priority_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS group_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_grouped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS action_taken VARCHAR(50),
  ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP;

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Do Not Disturb settings
  dnd_enabled BOOLEAN DEFAULT FALSE,
  dnd_start_time TIME DEFAULT '22:00:00',
  dnd_end_time TIME DEFAULT '08:00:00',
  dnd_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday, 6=Saturday

  -- Smart grouping preferences
  auto_group_enabled BOOLEAN DEFAULT TRUE,
  group_window_minutes INTEGER DEFAULT 30,

  -- Priority preferences (weights for AI scoring)
  priority_weight_urgency DECIMAL(3,2) DEFAULT 0.40,
  priority_weight_sender DECIMAL(3,2) DEFAULT 0.30,
  priority_weight_content DECIMAL(3,2) DEFAULT 0.30,

  -- Type-specific settings
  notify_messages BOOLEAN DEFAULT TRUE,
  notify_tasks BOOLEAN DEFAULT TRUE,
  notify_events BOOLEAN DEFAULT TRUE,
  notify_waste BOOLEAN DEFAULT TRUE,
  notify_system BOOLEAN DEFAULT TRUE,

  -- Delivery preferences
  desktop_notifications BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  vibration_enabled BOOLEAN DEFAULT TRUE,

  -- Important contacts (VIP list for higher priority)
  vip_user_ids INTEGER[] DEFAULT '{}',

  -- Muted topics/keywords
  muted_keywords TEXT[] DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

-- Notification actions log
CREATE TABLE IF NOT EXISTS notification_actions (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'read', 'dismiss', 'snooze', 'act', 'archive'
  action_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification groups
CREATE TABLE IF NOT EXISTS notification_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_key VARCHAR(255) NOT NULL,
  group_type VARCHAR(50) NOT NULL, -- 'message', 'task', 'event', 'system'
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  notification_count INTEGER DEFAULT 0,
  latest_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  first_created_at TIMESTAMP NOT NULL,
  last_updated_at TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,

  UNIQUE(user_id, group_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_ai_priority ON notifications(user_id, ai_priority_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_group_key ON notifications(group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_parent ON notifications(parent_notification_id) WHERE parent_notification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed ON notifications(user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_actions_notif ON notification_actions(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_actions_user ON notification_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_groups_user ON notification_groups(user_id, last_updated_at DESC);

-- Function to calculate AI priority score
CREATE OR REPLACE FUNCTION calculate_notification_priority(
  p_user_id INTEGER,
  p_type VARCHAR,
  p_related_user_id INTEGER,
  p_content TEXT,
  p_priority VARCHAR
) RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 50;
  v_prefs RECORD;
  v_urgency_score INTEGER := 50;
  v_sender_score INTEGER := 50;
  v_content_score INTEGER := 50;
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- If no preferences, return default score
  IF NOT FOUND THEN
    RETURN 50;
  END IF;

  -- Calculate urgency score based on priority
  v_urgency_score := CASE p_priority
    WHEN 'urgent' THEN 90
    WHEN 'high' THEN 75
    WHEN 'normal' THEN 50
    WHEN 'low' THEN 25
    ELSE 50
  END;

  -- Calculate sender score (VIP boost)
  IF p_related_user_id = ANY(v_prefs.vip_user_ids) THEN
    v_sender_score := 90;
  ELSE
    v_sender_score := 50;
  END IF;

  -- Calculate content score (keyword matching)
  v_content_score := 50;
  IF p_content IS NOT NULL THEN
    -- Check for muted keywords
    IF EXISTS (
      SELECT 1 FROM unnest(v_prefs.muted_keywords) AS keyword
      WHERE lower(p_content) LIKE '%' || lower(keyword) || '%'
    ) THEN
      v_content_score := 10;
    END IF;

    -- Boost for urgent keywords
    IF p_content ~* '(urgent|important|asap|critical|deadline)' THEN
      v_content_score := LEAST(90, v_content_score + 30);
    END IF;
  END IF;

  -- Calculate weighted score
  v_score := ROUND(
    (v_urgency_score * v_prefs.priority_weight_urgency) +
    (v_sender_score * v_prefs.priority_weight_sender) +
    (v_content_score * v_prefs.priority_weight_content)
  );

  -- Ensure score is within bounds
  v_score := GREATEST(0, LEAST(100, v_score));

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function to check if DND is active
CREATE OR REPLACE FUNCTION is_dnd_active(p_user_id INTEGER) RETURNS BOOLEAN AS $$
DECLARE
  v_prefs RECORD;
  v_current_time TIME;
  v_current_dow INTEGER;
BEGIN
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND OR NOT v_prefs.dnd_enabled THEN
    RETURN FALSE;
  END IF;

  v_current_time := CURRENT_TIME;
  v_current_dow := EXTRACT(DOW FROM CURRENT_DATE); -- 0=Sunday

  -- Check if current day is in DND days
  IF NOT (v_current_dow = ANY(v_prefs.dnd_days)) THEN
    RETURN FALSE;
  END IF;

  -- Check time range (handles overnight DND)
  IF v_prefs.dnd_start_time < v_prefs.dnd_end_time THEN
    RETURN v_current_time BETWEEN v_prefs.dnd_start_time AND v_prefs.dnd_end_time;
  ELSE
    RETURN v_current_time >= v_prefs.dnd_start_time OR v_current_time <= v_prefs.dnd_end_time;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate group key
CREATE OR REPLACE FUNCTION generate_notification_group_key(
  p_type VARCHAR,
  p_related_user_id INTEGER,
  p_task_id INTEGER,
  p_event_id INTEGER
) RETURNS VARCHAR AS $$
BEGIN
  RETURN CASE
    WHEN p_type = 'message' AND p_related_user_id IS NOT NULL THEN
      'msg_' || p_related_user_id::TEXT
    WHEN p_type = 'task_assigned' AND p_task_id IS NOT NULL THEN
      'task_' || p_task_id::TEXT
    WHEN p_type = 'calendar_event' AND p_event_id IS NOT NULL THEN
      'event_' || p_event_id::TEXT
    WHEN p_type IN ('mention', 'reaction') AND p_related_user_id IS NOT NULL THEN
      p_type || '_' || p_related_user_id::TEXT
    ELSE
      p_type || '_misc'
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate priority on insert
CREATE OR REPLACE FUNCTION trg_notification_auto_priority() RETURNS TRIGGER AS $$
BEGIN
  -- Calculate AI priority score if not set
  IF NEW.ai_priority_score = 50 THEN
    NEW.ai_priority_score := calculate_notification_priority(
      NEW.user_id,
      NEW.type,
      NEW.related_user_id,
      NEW.content,
      NEW.priority
    );
  END IF;

  -- Generate group key if not set
  IF NEW.group_key IS NULL THEN
    NEW.group_key := generate_notification_group_key(
      NEW.type,
      NEW.related_user_id,
      NEW.task_id,
      NEW.event_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_auto_priority ON notifications;
CREATE TRIGGER trg_notification_auto_priority
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trg_notification_auto_priority();

-- Trigger to update notification groups
CREATE OR REPLACE FUNCTION trg_update_notification_group() RETURNS TRIGGER AS $$
DECLARE
  v_prefs RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = NEW.user_id;

  -- Skip if auto-grouping is disabled
  IF NOT FOUND OR NOT v_prefs.auto_group_enabled THEN
    RETURN NEW;
  END IF;

  -- Update or create group
  INSERT INTO notification_groups (
    user_id,
    group_key,
    group_type,
    title,
    summary,
    notification_count,
    latest_notification_id,
    first_created_at,
    last_updated_at
  ) VALUES (
    NEW.user_id,
    NEW.group_key,
    NEW.type,
    NEW.title,
    NEW.content,
    1,
    NEW.id,
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT (user_id, group_key) DO UPDATE SET
    notification_count = notification_groups.notification_count + 1,
    latest_notification_id = NEW.id,
    last_updated_at = NEW.created_at,
    summary = CASE
      WHEN notification_groups.notification_count >= 3 THEN
        substring(notification_groups.summary, 1, 200) || '...'
      ELSE
        notification_groups.summary || ' | ' || substring(NEW.content, 1, 100)
    END;

  -- Mark notification as grouped if it's part of an existing group
  IF EXISTS (
    SELECT 1 FROM notification_groups
    WHERE user_id = NEW.user_id
      AND group_key = NEW.group_key
      AND notification_count > 1
  ) THEN
    NEW.is_grouped := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_notification_group ON notifications;
CREATE TRIGGER trg_update_notification_group
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_notification_group();

-- Insert default preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences WHERE user_id = users.id
);

-- Update trigger for notification_preferences
DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

COMMENT ON TABLE notification_preferences IS 'User preferences for smart notifications including DND, grouping, and AI priority weights';
COMMENT ON TABLE notification_actions IS 'Audit log of all actions taken on notifications';
COMMENT ON TABLE notification_groups IS 'Grouped notifications for better organization';
COMMENT ON COLUMN notifications.ai_priority_score IS 'AI-calculated priority score (0-100) based on user preferences and content analysis';
COMMENT ON COLUMN notifications.group_key IS 'Key used to group related notifications together';
COMMENT ON FUNCTION calculate_notification_priority IS 'Calculates AI-based priority score using user preferences and notification context';
COMMENT ON FUNCTION is_dnd_active IS 'Checks if Do Not Disturb mode is currently active for a user';
COMMENT ON FUNCTION generate_notification_group_key IS 'Generates a unique group key for automatic notification grouping';
