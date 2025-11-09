-- Fix KB article version trigger - use excerpt instead of summary
CREATE OR REPLACE FUNCTION create_article_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.category_id IS DISTINCT FROM OLD.category_id OR
    NEW.tags IS DISTINCT FROM OLD.tags
  )) THEN
    INSERT INTO kb_article_versions (
      article_id, version_number, title, slug, content, excerpt,
      category_id, author_id, tags, status, created_by_name
    ) VALUES (
      NEW.id, NEW.current_version, NEW.title, NEW.slug, NEW.content, NEW.summary,
      NEW.category_id, NEW.author_id, NEW.tags, NEW.status,
      (SELECT name FROM users WHERE id = NEW.author_id LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
