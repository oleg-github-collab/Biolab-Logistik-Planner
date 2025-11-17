-- Create General Chat group conversation
-- This is a permanent group chat where all users are automatically added

-- First, get or create BL_Bot user ID
DO $$
DECLARE
  bot_user_id INTEGER;
BEGIN
  -- Get BL_Bot user ID
  SELECT id INTO bot_user_id
  FROM users
  WHERE email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de')
  AND is_system_user = true
  LIMIT 1;

  -- Create the General Chat conversation with BL_Bot as creator
  IF bot_user_id IS NOT NULL THEN
    INSERT INTO message_conversations (
      name,
      description,
      conversation_type,
      created_by,
      is_temporary,
      created_at,
      updated_at
    )
    VALUES (
      'General Chat',
      'Allgemeiner Team-Chat für alle Mitarbeiter und BL_Bot',
      'group',
      bot_user_id,
      false,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ General Chat conversation created by BL_Bot';
  ELSE
    RAISE EXCEPTION 'BL_Bot user not found! Please run migration 050 first.';
  END IF;
END $$;

-- Add all existing users (including BL_Bot) to General Chat
DO $$
DECLARE
  general_chat_id INTEGER;
  bot_user_id INTEGER;
BEGIN
  -- Get General Chat conversation ID
  SELECT id INTO general_chat_id
  FROM message_conversations
  WHERE name = 'General Chat' AND conversation_type = 'group'
  LIMIT 1;

  -- Get BL_Bot user ID
  SELECT id INTO bot_user_id
  FROM users
  WHERE email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de')
  AND is_system_user = true
  LIMIT 1;

  IF general_chat_id IS NOT NULL THEN
    -- Add all active users to General Chat
    INSERT INTO message_conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      last_read_at
    )
    SELECT
      general_chat_id,
      u.id,
      CASE
        WHEN u.role = 'superadmin' THEN 'moderator'
        ELSE 'member'
      END,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM users u
    WHERE u.is_active = true
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- Send welcome message from BL_Bot
    IF bot_user_id IS NOT NULL THEN
      INSERT INTO messages (
        sender_id,
        conversation_id,
        message,
        message_type,
        is_group,
        read_status,
        delivered_status,
        created_at
      )
      VALUES (
        bot_user_id,
        general_chat_id,
        '👋 Willkommen im General Chat!

Hier können alle Teammitglieder kommunizieren und Informationen austauschen.

**💡 Tipps:**
- Erwähne mich mit @BL_Bot wenn du Fragen hast
- Ich antworte nur, wenn ich erwähnt werde
- Nutze diesen Chat für Team-Ankündigungen und Koordination

Viel Erfolg beim Zusammenarbeiten! 🚀',
        'text',
        true,
        true,
        true,
        CURRENT_TIMESTAMP
      );
    END IF;

    RAISE NOTICE '✅ General Chat created with % members', (SELECT COUNT(*) FROM message_conversation_members WHERE conversation_id = general_chat_id);
  END IF;
END $$;

-- Create trigger function to add new users to General Chat automatically
CREATE OR REPLACE FUNCTION add_user_to_general_chat()
RETURNS TRIGGER AS $$
DECLARE
  general_chat_id INTEGER;
BEGIN
  -- Get General Chat conversation ID
  SELECT id INTO general_chat_id
  FROM message_conversations
  WHERE name = 'General Chat' AND conversation_type = 'group'
  LIMIT 1;

  -- Add new user to General Chat (skip system users)
  IF general_chat_id IS NOT NULL AND NOT NEW.is_system_user THEN
    INSERT INTO message_conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      last_read_at
    )
    VALUES (
      general_chat_id,
      NEW.id,
      CASE
        WHEN NEW.role = 'superadmin' THEN 'moderator'
        ELSE 'member'
      END,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    RAISE NOTICE '✅ User % added to General Chat', NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS add_user_to_general_chat_trigger ON users;

-- Create trigger to automatically add new users to General Chat
CREATE TRIGGER add_user_to_general_chat_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION add_user_to_general_chat();

-- Add metadata to conversation for easy identification
UPDATE message_conversations
SET description = 'Allgemeiner Team-Chat für alle Mitarbeiter und BL_Bot. Automatisch für alle neuen Benutzer.'
WHERE name = 'General Chat' AND conversation_type = 'group';

COMMENT ON FUNCTION add_user_to_general_chat() IS 'Automatically adds new users to General Chat group conversation';
COMMENT ON TRIGGER add_user_to_general_chat_trigger ON users IS 'Ensures every new user is added to General Chat';
