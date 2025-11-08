-- Migration: KB Article Versioning System
-- Creates version history for knowledge base articles

-- KB Article Versions table
CREATE TABLE IF NOT EXISTS kb_article_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category_id INTEGER REFERENCES kb_categories(id),
  tags JSONB DEFAULT '[]'::jsonb,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_summary TEXT,
  UNIQUE(article_id, version_number)
);

-- Add version tracking to kb_articles
ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;

-- Create index for faster version lookups
CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article_id ON kb_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_versions_created_at ON kb_article_versions(created_at DESC);

-- Function to create initial version for existing articles
CREATE OR REPLACE FUNCTION create_initial_kb_versions()
RETURNS void AS $$
DECLARE
  article RECORD;
BEGIN
  FOR article IN SELECT * FROM kb_articles WHERE id NOT IN (SELECT DISTINCT article_id FROM kb_article_versions)
  LOOP
    INSERT INTO kb_article_versions (
      article_id, version_number, title, content, category_id, tags, created_by, created_at, change_summary
    ) VALUES (
      article.id, 1, article.title, article.content, article.category_id, article.tags, article.author_id, article.created_at, 'Initial version'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial versions for existing articles
SELECT create_initial_kb_versions();

-- Trigger to auto-increment version when article is updated
CREATE OR REPLACE FUNCTION kb_article_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create new version if content or title changed
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content IS DISTINCT FROM NEW.content) THEN
    -- Increment version numbers
    NEW.current_version := OLD.current_version + 1;
    NEW.version_count := OLD.version_count + 1;

    -- Create new version record
    INSERT INTO kb_article_versions (
      article_id, version_number, title, content, category_id, tags, created_by, created_at, change_summary
    ) VALUES (
      NEW.id, NEW.current_version, NEW.title, NEW.content, NEW.category_id, NEW.tags, NEW.author_id, CURRENT_TIMESTAMP, 'Article updated'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS kb_article_version_update ON kb_articles;
CREATE TRIGGER kb_article_version_update
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION kb_article_version_trigger();

-- Add comments
COMMENT ON TABLE kb_article_versions IS 'Version history for KB articles with full content snapshots';
COMMENT ON COLUMN kb_article_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN kb_article_versions.change_summary IS 'Brief description of changes made in this version';
