-- Migration 050: Create user_stories and user_story_views tables

CREATE TABLE IF NOT EXISTS user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_path TEXT,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) DEFAULT 'image',
  caption TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS user_story_views (
  id SERIAL PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stories_user ON user_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_expires ON user_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_story_views_story ON user_story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_user_story_views_viewer ON user_story_views(viewer_id);
