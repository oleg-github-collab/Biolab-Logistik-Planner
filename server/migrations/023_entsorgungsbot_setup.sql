-- Create EntsorgungsBot user and add as default contact for all users

-- Add is_system_user column first if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_system_user'
  ) THEN
    ALTER TABLE users ADD COLUMN is_system_user BOOLEAN DEFAULT false;
    COMMENT ON COLUMN users.is_system_user IS 'Indicates if this user is a system bot/service account';
  END IF;
END $$;

-- Create EntsorgungsBot system user if not exists
INSERT INTO users (name, email, password, role, employment_type, is_system_user, created_at, updated_at)
VALUES (
  'EntsorgungsBot',
  'entsorgungsbot@biolab.de',
  '$2a$10$dummyHashForSystemUser.EntsorgungsBot.NoLogin',
  'employee',
  'Werkstudent',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

-- Update EntsorgungsBot to be a system user
UPDATE users
SET is_system_user = true
WHERE email = 'entsorgungsbot@biolab.de';

-- Add EntsorgungsBot to all users' contacts (user_contacts table)
-- First, get the bot user ID
DO $$
DECLARE
  bot_user_id INTEGER;
BEGIN
  SELECT id INTO bot_user_id FROM users WHERE email = 'entsorgungsbot@biolab.de';

  IF bot_user_id IS NOT NULL THEN
    -- Add bot as contact for all users who don't already have it
    INSERT INTO user_contacts (user_id, contact_user_id, created_at)
    SELECT u.id, bot_user_id, CURRENT_TIMESTAMP
    FROM users u
    WHERE u.id != bot_user_id
    AND NOT EXISTS (
      SELECT 1 FROM user_contacts uc
      WHERE uc.user_id = u.id AND uc.contact_user_id = bot_user_id
    )
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;

    -- Also add bot's reverse contacts so users appear in bot's contact list
    INSERT INTO user_contacts (user_id, contact_user_id, created_at)
    SELECT bot_user_id, u.id, CURRENT_TIMESTAMP
    FROM users u
    WHERE u.id != bot_user_id
    AND NOT EXISTS (
      SELECT 1 FROM user_contacts uc
      WHERE uc.user_id = bot_user_id AND uc.contact_user_id = u.id
    )
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;
  END IF;
END $$;

-- Create a function to automatically add EntsorgungsBot to new users
CREATE OR REPLACE FUNCTION add_entsorgungsbot_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  bot_user_id INTEGER;
BEGIN
  -- Get EntsorgungsBot ID
  SELECT id INTO bot_user_id FROM users WHERE email = 'entsorgungsbot@biolab.de';

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

-- Create trigger to run the function when new users are created
DROP TRIGGER IF EXISTS add_entsorgungsbot_on_user_creation ON users;
CREATE TRIGGER add_entsorgungsbot_on_user_creation
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION add_entsorgungsbot_to_new_user();

COMMENT ON FUNCTION add_entsorgungsbot_to_new_user() IS 'Automatically adds EntsorgungsBot as a default contact for all new users';
COMMENT ON TRIGGER add_entsorgungsbot_on_user_creation ON users IS 'Ensures every new user has EntsorgungsBot in their contacts';
