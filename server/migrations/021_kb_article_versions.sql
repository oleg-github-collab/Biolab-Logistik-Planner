-- Knowledge Base article versioning system

CREATE TABLE IF NOT EXISTS kb_article_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[],
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_name VARCHAR(255),
  UNIQUE(article_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article ON kb_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_versions_created ON kb_article_versions(created_at DESC);

-- Add version tracking to kb_articles
ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP;

-- Tags table for autocomplete
CREATE TABLE IF NOT EXISTS kb_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_tags_name ON kb_tags(name);
CREATE INDEX IF NOT EXISTS idx_kb_tags_usage ON kb_tags(usage_count DESC);

-- Function to create version snapshot on article update
CREATE OR REPLACE FUNCTION create_article_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content actually changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.title != NEW.title OR
    OLD.content != NEW.content OR
    OLD.summary != NEW.summary OR
    OLD.status != NEW.status
  )) OR TG_OP = 'INSERT' THEN

    -- Increment version number
    NEW.current_version := COALESCE(OLD.current_version, 0) + 1;

    -- Create version snapshot
    INSERT INTO kb_article_versions (
      article_id, version_number, title, slug, content, summary,
      category_id, author_id, tags, status, created_by_name
    ) VALUES (
      NEW.id, NEW.current_version, NEW.title, NEW.slug, NEW.content, NEW.summary,
      NEW.category_id, NEW.author_id, NEW.tags, NEW.status,
      (SELECT name FROM users WHERE id = NEW.author_id LIMIT 1)
    );

    -- Update last edited info
    NEW.last_edited_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic versioning
DROP TRIGGER IF EXISTS kb_articles_versioning_trigger ON kb_articles;
CREATE TRIGGER kb_articles_versioning_trigger
  BEFORE INSERT OR UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION create_article_version();

COMMENT ON TABLE kb_article_versions IS 'Stores historical versions of knowledge base articles for version control';
COMMENT ON TABLE kb_tags IS 'Stores unique tags for autocomplete and filtering';
