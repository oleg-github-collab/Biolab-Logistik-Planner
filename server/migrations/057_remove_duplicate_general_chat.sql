-- Migration: Remove duplicate general chat, keep the oldest one
-- This ensures only ONE Allgemeiner Chat exists

DO $$
DECLARE
    chats_to_delete INTEGER[];
    chat_to_keep INTEGER;
    deleted_count INTEGER := 0;
BEGIN
    -- Find all general chats, ordered by creation date (oldest first)
    SELECT ARRAY_AGG(id ORDER BY created_at ASC) INTO chats_to_delete
    FROM message_conversations
    WHERE LOWER(name) LIKE '%allgemein%'
       OR LOWER(name) LIKE '%general%';

    -- If less than 2 chats, nothing to do
    IF array_length(chats_to_delete, 1) IS NULL OR array_length(chats_to_delete, 1) < 2 THEN
        RAISE NOTICE 'Only one or zero general chats found - no duplicates to remove';
        RETURN;
    END IF;

    -- Keep the first (oldest) chat
    chat_to_keep := chats_to_delete[1];
    
    RAISE NOTICE 'Found % general chats. Keeping chat ID: %', array_length(chats_to_delete, 1), chat_to_keep;

    -- Delete all others (newer duplicates)
    FOR i IN 2..array_length(chats_to_delete, 1) LOOP
        RAISE NOTICE 'Deleting duplicate chat ID: %', chats_to_delete[i];
        
        -- Delete messages
        DELETE FROM messages WHERE conversation_id = chats_to_delete[i];
        
        -- Delete members
        DELETE FROM message_conversation_members WHERE conversation_id = chats_to_delete[i];
        
        -- Delete conversation
        DELETE FROM message_conversations WHERE id = chats_to_delete[i];
        
        deleted_count := deleted_count + 1;
    END LOOP;

    RAISE NOTICE '=== Deleted % duplicate general chat(s). Kept chat ID: % ===', deleted_count, chat_to_keep;
END $$;
