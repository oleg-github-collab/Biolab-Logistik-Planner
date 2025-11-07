-- Clear all data except users and user preferences
-- This script preserves user accounts and their settings

BEGIN;

-- Delete in order to respect foreign key constraints

-- Messages and conversations
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM conversation_participants;

-- Calendar events
DELETE FROM calendar_events;

-- Tasks and related data
DELETE FROM task_comments;
DELETE FROM task_attachments;
DELETE FROM tasks;

-- Waste management
DELETE FROM waste_disposal_schedule;
DELETE FROM waste_items;

-- Storage bins (Kisten)
DELETE FROM storage_bin_audit;
DELETE FROM storage_bins;

-- Knowledge Base
DELETE FROM kb_media;
DELETE FROM kb_articles;
DELETE FROM kb_categories;

-- User stories
DELETE FROM user_story_views;
DELETE FROM user_stories;

-- Notifications
DELETE FROM notifications;

-- Schedule data
DELETE FROM schedule_entries;

-- Keep users and user_preferences
-- DELETE FROM user_preferences;
-- DELETE FROM users;

COMMIT;

-- Reset sequences (optional - keeps IDs low)
ALTER SEQUENCE messages_id_seq RESTART WITH 1;
ALTER SEQUENCE conversations_id_seq RESTART WITH 1;
ALTER SEQUENCE calendar_events_id_seq RESTART WITH 1;
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE waste_items_id_seq RESTART WITH 1;
ALTER SEQUENCE storage_bins_id_seq RESTART WITH 1;
ALTER SEQUENCE kb_articles_id_seq RESTART WITH 1;
ALTER SEQUENCE kb_categories_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;

SELECT 'Database cleared! Users and preferences preserved.' AS status;
