-- Migration: Ensure all users are in general chat
-- This migration adds all active users to the general chat if they aren't already members

DO $$
DECLARE
    general_chat_id INTEGER;
    user_record RECORD;
    users_added INTEGER := 0;
BEGIN
    -- Find the general chat conversation
    SELECT id INTO general_chat_id
    FROM message_conversations
    WHERE LOWER(name) LIKE '%allgemein%'
       OR LOWER(name) LIKE '%general%'
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no general chat exists, log and exit
    IF general_chat_id IS NULL THEN
        RAISE NOTICE 'No general chat found. It will be created automatically when users access messenger.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found general chat with ID: %', general_chat_id;

    -- Add all active users who are not yet members
    FOR user_record IN
        SELECT u.id, u.name, u.email, u.role
        FROM users u
        WHERE u.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM message_conversation_members mcm
              WHERE mcm.conversation_id = general_chat_id
                AND mcm.user_id = u.id
          )
        ORDER BY u.id
    LOOP
        -- Insert user into general chat
        INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
        VALUES (general_chat_id, user_record.id, 'member', NOW())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        users_added := users_added + 1;
        RAISE NOTICE 'Added user: % (ID: %, Email: %, Role: %)', 
            user_record.name, user_record.id, user_record.email, user_record.role;
    END LOOP;

    RAISE NOTICE '=== Migration complete: % users added to general chat ===', users_added;
END $$;
