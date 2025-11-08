-- Migration: KB Article Versioning System (Fixed for existing structure)
-- Works with existing kb_article_versions table

-- Add change_summary column if not exists
ALTER TABLE kb_article_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;

-- Add created_by column that references user who created version
ALTER TABLE kb_article_versions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Add version tracking to kb_articles if not exists
ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;

-- Update current_version and version_count for existing articles
UPDATE kb_articles ka
SET
  current_version = COALESCE((SELECT MAX(version_number) FROM kb_article_versions WHERE article_id = ka.id), 1),
  version_count = COALESCE((SELECT COUNT(*) FROM kb_article_versions WHERE article_id = ka.id), 1)
WHERE current_version IS NULL OR version_count IS NULL;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article_id ON kb_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_versions_created_at ON kb_article_versions(created_at DESC);

-- Function to create initial version for existing articles (adapted to existing structure)
CREATE OR REPLACE FUNCTION create_initial_kb_versions()
RETURNS void AS $$
DECLARE
  article RECORD;
BEGIN
  FOR article IN
    SELECT * FROM kb_articles
    WHERE id NOT IN (SELECT DISTINCT article_id FROM kb_article_versions WHERE article_id IS NOT NULL)
  LOOP
    -- Use existing column names from kb_article_versions
    INSERT INTO kb_article_versions (
      article_id, version_number, title, slug, content, excerpt, category_id,
      author_id, tags, status, created_at, created_by_name, change_summary
    ) VALUES (
      article.id,
      1,
      article.title,
      article.slug,
      article.content,
      article.excerpt,
      article.category_id,
      article.author_id,
      CASE
        WHEN article.tags IS NOT NULL THEN article.tags::text[]
        ELSE ARRAY[]::text[]
      END,
      article.status,
      article.created_at,
      (SELECT name FROM users WHERE id = article.author_id),
      'Initial version'
    ) ON CONFLICT (article_id, version_number) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial versions
SELECT create_initial_kb_versions();

-- Trigger to auto-increment version when article is updated (adapted to existing structure)
CREATE OR REPLACE FUNCTION kb_article_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create new version if content or title changed
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content IS DISTINCT FROM NEW.content) THEN
    -- Increment version numbers
    NEW.current_version := COALESCE(OLD.current_version, 0) + 1;
    NEW.version_count := COALESCE(OLD.version_count, 0) + 1;

    -- Create new version record with existing structure
    INSERT INTO kb_article_versions (
      article_id, version_number, title, slug, content, excerpt, category_id,
      author_id, tags, status, created_at, created_by_name, change_summary
    ) VALUES (
      NEW.id,
      NEW.current_version,
      NEW.title,
      NEW.slug,
      NEW.content,
      NEW.excerpt,
      NEW.category_id,
      NEW.author_id,
      CASE
        WHEN NEW.tags IS NOT NULL THEN NEW.tags::text[]
        ELSE ARRAY[]::text[]
      END,
      NEW.status,
      CURRENT_TIMESTAMP,
      (SELECT name FROM users WHERE id = NEW.author_id),
      'Article updated'
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
