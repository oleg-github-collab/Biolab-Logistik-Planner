-- Ensure kb_article_versions.created_by does not block user deletions

ALTER TABLE IF EXISTS kb_article_versions
  ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE IF EXISTS kb_article_versions
  DROP CONSTRAINT IF EXISTS kb_article_versions_created_by_fkey;

ALTER TABLE IF EXISTS kb_article_versions
  ADD CONSTRAINT kb_article_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
