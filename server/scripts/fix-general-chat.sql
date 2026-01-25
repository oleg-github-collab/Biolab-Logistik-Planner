-- Fix General Chat: Add all active users to the general chat
-- This script ensures all users are members of the general chat conversation

DO $$
DECLARE
    general_chat_id INTEGER;
    user_record RECORD;
BEGIN
    -- Find the general chat conversation
    SELECT id INTO general_chat_id
    FROM message_conversations
    WHERE LOWER(name) LIKE '%allgemein%'
       OR LOWER(name) LIKE '%general%'
    LIMIT 1;

    IF general_chat_id IS NULL THEN
        RAISE NOTICE 'General chat not found. Please create it first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found general chat with ID: %', general_chat_id;

    -- Add all active users who are not yet members
    FOR user_record IN
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE u.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM message_conversation_members mcm
              WHERE mcm.conversation_id = general_chat_id
                AND mcm.user_id = u.id
          )
    LOOP
        INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
        VALUES (general_chat_id, user_record.id, 'member', NOW())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        RAISE NOTICE 'Added user % (%) to general chat', user_record.name, user_record.email;
    END LOOP;

    RAISE NOTICE 'General chat membership fixed successfully!';
END $$;
