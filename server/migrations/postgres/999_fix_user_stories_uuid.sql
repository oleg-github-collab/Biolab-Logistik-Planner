-- Fix user_stories table to auto-generate UUIDs
-- Migration: 999_fix_user_stories_uuid.sql

-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add default UUID generation to id column
ALTER TABLE user_stories
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Make media_path optional (can be NULL for external URLs)
ALTER TABLE user_stories
  ALTER COLUMN media_path DROP NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN user_stories.id IS 'Auto-generated UUID for story identification';
COMMENT ON COLUMN user_stories.media_path IS 'Local file path (optional, can be NULL for external URLs)';
COMMENT ON COLUMN user_stories.media_url IS 'Public URL for accessing the story media';
