-- ============================================================================
-- Migration 029: Auto-create notification preferences for new users
-- ============================================================================
-- Fixes the broadcast API 500 error by ensuring every user has preferences
-- ============================================================================

-- Function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION trg_user_create_notification_prefs() RETURNS TRIGGER AS $$
BEGIN
  -- Create default notification preferences for the new user
  INSERT INTO notification_preferences (
    user_id,
    dnd_enabled,
    dnd_start_time,
    dnd_end_time,
    dnd_days,
    auto_group_enabled,
    group_window_minutes,
    priority_weight_urgency,
    priority_weight_sender,
    priority_weight_content,
    notify_messages,
    notify_tasks,
    notify_events,
    notify_waste,
    notify_system,
    desktop_notifications,
    sound_enabled,
    vibration_enabled,
    vip_user_ids,
    muted_keywords
  ) VALUES (
    NEW.id,
    FALSE,
    '22:00:00',
    '08:00:00',
    ARRAY[0,1,2,3,4,5,6],
    TRUE,
    30,
    0.40,
    0.30,
    0.30,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    '{}',
    '{}'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table
DROP TRIGGER IF EXISTS trg_user_create_notification_prefs ON users;
CREATE TRIGGER trg_user_create_notification_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trg_user_create_notification_prefs();

-- Ensure all existing users have notification preferences
INSERT INTO notification_preferences (
  user_id,
  dnd_enabled,
  dnd_start_time,
  dnd_end_time,
  dnd_days,
  auto_group_enabled,
  group_window_minutes,
  priority_weight_urgency,
  priority_weight_sender,
  priority_weight_content,
  notify_messages,
  notify_tasks,
  notify_events,
  notify_waste,
  notify_system,
  desktop_notifications,
  sound_enabled,
  vibration_enabled,
  vip_user_ids,
  muted_keywords
)
SELECT
  id,
  FALSE,
  '22:00:00',
  '08:00:00',
  ARRAY[0,1,2,3,4,5,6],
  TRUE,
  30,
  0.40,
  0.30,
  0.30,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  '{}',
  '{}'
FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
  AND is_active = TRUE;

COMMENT ON FUNCTION trg_user_create_notification_prefs IS 'Automatically creates default notification preferences when a new user is created';
