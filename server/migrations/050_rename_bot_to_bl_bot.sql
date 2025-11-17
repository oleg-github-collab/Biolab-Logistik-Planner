-- Rename EntsorgungsBot to BL_Bot and upgrade to admin role
-- This migration renames the system bot and gives it admin privileges

-- Update bot user details
UPDATE users
SET
  name = 'BL_Bot',
  email = 'bl_bot@biolab.de',
  role = 'admin',
  employment_type = 'Vollzeit',
  is_system_user = true,
  updated_at = CURRENT_TIMESTAMP
WHERE email = 'entsorgungsbot@biolab.de';

-- Update the trigger function to use new bot email
CREATE OR REPLACE FUNCTION add_bl_bot_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  bot_user_id INTEGER;
BEGIN
  -- Get BL_Bot ID (try both old and new email for compatibility)
  SELECT id INTO bot_user_id FROM users
  WHERE email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de')
  AND is_system_user = true
  LIMIT 1;

  IF bot_user_id IS NOT NULL AND NEW.id != bot_user_id THEN
    -- Add bot as contact for the new user
    INSERT INTO user_contacts (user_id, contact_user_id, created_at)
    VALUES (NEW.id, bot_user_id, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;

    -- Add new user as contact for the bot
    INSERT INTO user_contacts (user_id, contact_user_id, created_at)
    VALUES (bot_user_id, NEW.id, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and recreate with new name
DROP TRIGGER IF EXISTS add_entsorgungsbot_on_user_creation ON users;
DROP TRIGGER IF EXISTS add_bl_bot_on_user_creation ON users;

CREATE TRIGGER add_bl_bot_on_user_creation
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION add_bl_bot_to_new_user();

-- Update function comments
COMMENT ON FUNCTION add_bl_bot_to_new_user() IS 'Automatically adds BL_Bot as a default contact for all new users';
COMMENT ON TRIGGER add_bl_bot_on_user_creation ON users IS 'Ensures every new user has BL_Bot in their contacts';

-- Drop old function
DROP FUNCTION IF EXISTS add_entsorgungsbot_to_new_user();
