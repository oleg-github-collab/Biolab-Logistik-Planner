-- Clear all data except users - safe version with IF EXISTS checks

-- Messages and conversations
DELETE FROM messages WHERE TRUE;
DELETE FROM conversation_participants WHERE TRUE;

-- Calendar events
DELETE FROM calendar_events WHERE TRUE;

-- Tasks and related data
DELETE FROM task_comments WHERE TRUE;
DELETE FROM task_attachments WHERE TRUE;
DELETE FROM tasks WHERE TRUE;

-- Waste management
DELETE FROM waste_disposal_schedule WHERE TRUE;
DELETE FROM waste_items WHERE TRUE;

-- Storage bins (Kisten)
DELETE FROM storage_bin_audit WHERE TRUE;
DELETE FROM storage_bins WHERE TRUE;

-- Knowledge Base
DELETE FROM kb_media WHERE TRUE;
DELETE FROM kb_articles WHERE TRUE;
DELETE FROM kb_categories WHERE TRUE;

-- User stories
DELETE FROM user_story_views WHERE TRUE;
DELETE FROM user_stories WHERE TRUE;

-- Notifications
DELETE FROM notifications WHERE TRUE;

-- Schedule data
DELETE FROM schedule_entries WHERE TRUE;

-- Reset sequences safely
DO $$
DECLARE
    seq RECORD;
BEGIN
    FOR seq IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        AND sequence_name NOT LIKE '%users%'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq.sequence_name || ' RESTART WITH 1';
    END LOOP;
END $$;

SELECT 'Database cleared! Users preserved.' AS status;
