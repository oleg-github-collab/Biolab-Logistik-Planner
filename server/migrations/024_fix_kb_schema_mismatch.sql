-- Fix KB article schema mismatch between kb_articles and kb_article_versions
-- Migration 024

-- kb_articles uses 'excerpt' but kb_article_versions uses 'summary'
-- We need to standardize on 'excerpt' to match the main table

-- Rename summary to excerpt in kb_article_versions
ALTER TABLE kb_article_versions RENAME COLUMN summary TO excerpt;

-- Update the trigger function to use excerpt instead of summary
CREATE OR REPLACE FUNCTION create_article_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content actually changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.title != NEW.title OR
    OLD.content != NEW.content OR
    OLD.excerpt != NEW.excerpt OR
    OLD.status != NEW.status
  )) OR TG_OP = 'INSERT' THEN

    -- Increment version number
    NEW.current_version := COALESCE(OLD.current_version, 0) + 1;

    -- Create version snapshot
    INSERT INTO kb_article_versions (
      article_id, version_number, title, slug, content, excerpt,
      category_id, author_id, tags, status, created_by_name
    ) VALUES (
      NEW.id, NEW.current_version, NEW.title, NEW.slug, NEW.content, NEW.excerpt,
      NEW.category_id, NEW.author_id, NEW.tags, NEW.status,
      (SELECT name FROM users WHERE id = NEW.author_id LIMIT 1)
    );

    -- Update last edited info
    NEW.last_edited_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 024 completed: Fixed KB schema mismatch - renamed summary to excerpt in kb_article_versions';
END $$;
