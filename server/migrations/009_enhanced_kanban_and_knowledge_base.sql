-- Enhanced Kanban with Media Support and Knowledge Base
-- Migration 009

-- ============================================
-- KANBAN ENHANCEMENTS
-- ============================================

-- Task attachments table (photos, audio, files)
CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'audio', 'video', 'document')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_size INTEGER, -- in bytes
  mime_type VARCHAR(100),
  duration INTEGER, -- for audio/video in seconds
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_type ON task_attachments(file_type);

-- Task comments with audio support
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT,
  audio_url TEXT,
  audio_duration INTEGER, -- in seconds
  parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);
CREATE INDEX idx_task_comments_parent ON task_comments(parent_comment_id);

-- Task activity log for better tracking
CREATE TABLE IF NOT EXISTS task_activity_log (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'created', 'updated', 'deleted', 'moved', 'assigned',
    'status_changed', 'priority_changed', 'comment_added',
    'attachment_added', 'attachment_removed'
  )),
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_activity_task ON task_activity_log(task_id);
CREATE INDEX idx_task_activity_user ON task_activity_log(user_id);
CREATE INDEX idx_task_activity_type ON task_activity_log(action_type);
CREATE INDEX idx_task_activity_created ON task_activity_log(created_at DESC);

-- Add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(5,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[]; -- Array of labels/tags
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist JSONB; -- Checklist items
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS watchers INTEGER[]; -- User IDs watching this task

-- ============================================
-- KNOWLEDGE BASE
-- ============================================

-- Knowledge base categories
CREATE TABLE IF NOT EXISTS kb_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50), -- emoji or icon name
  color VARCHAR(20), -- hex color
  parent_category_id INTEGER REFERENCES kb_categories(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_categories_parent ON kb_categories(parent_category_id);
CREATE INDEX idx_kb_categories_active ON kb_categories(is_active);

-- Knowledge base articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  visibility VARCHAR(20) DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'employees', 'admins')),
  tags TEXT[],
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  search_vector tsvector, -- Full-text search
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_author ON kb_articles(author_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_search ON kb_articles USING GIN(search_vector);
CREATE INDEX idx_kb_articles_tags ON kb_articles USING GIN(tags);
CREATE INDEX idx_kb_articles_featured ON kb_articles(featured) WHERE featured = TRUE;

-- Article media attachments
CREATE TABLE IF NOT EXISTS kb_article_media (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'document')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  duration INTEGER, -- for audio/video
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_media_article ON kb_article_media(article_id);
CREATE INDEX idx_kb_media_type ON kb_article_media(media_type);

-- Article comments
CREATE TABLE IF NOT EXISTS kb_article_comments (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  parent_comment_id INTEGER REFERENCES kb_article_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_comments_article ON kb_article_comments(article_id);
CREATE INDEX idx_kb_comments_user ON kb_article_comments(user_id);
CREATE INDEX idx_kb_comments_parent ON kb_article_comments(parent_comment_id);

-- Article helpful votes
CREATE TABLE IF NOT EXISTS kb_article_votes (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(article_id, user_id)
);

CREATE INDEX idx_kb_votes_article ON kb_article_votes(article_id);

-- Article revision history
CREATE TABLE IF NOT EXISTS kb_article_revisions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_revisions_article ON kb_article_revisions(article_id);
CREATE INDEX idx_kb_revisions_created ON kb_article_revisions(created_at DESC);

-- ============================================
-- TRIGGERS FOR SEARCH
-- ============================================

-- Update search vector on article changes
CREATE OR REPLACE FUNCTION update_kb_article_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('german', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('german', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('german', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('german', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_article_search_vector_update
  BEFORE INSERT OR UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_article_search_vector();

-- ============================================
-- TRIGGERS FOR TIMESTAMPS
-- ============================================

CREATE TRIGGER update_task_attachments_updated_at
  BEFORE UPDATE ON task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_categories_updated_at
  BEFORE UPDATE ON kb_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_comments_updated_at
  BEFORE UPDATE ON kb_article_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert default KB categories
INSERT INTO kb_categories (name, description, icon, color, display_order) VALUES
  ('Allgemein', 'Allgemeine Informationen und Richtlinien', '📚', '#3B82F6', 1),
  ('Verfahren', 'Schritt-für-Schritt-Anleitungen', '📋', '#10B981', 2),
  ('Sicherheit', 'Sicherheitsrichtlinien und Protokolle', '🔒', '#EF4444', 3),
  ('Geräte', 'Geräteanweisungen und Wartung', '⚙️', '#F59E0B', 4),
  ('FAQ', 'Häufig gestellte Fragen', '❓', '#8B5CF6', 5)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT ALL ON task_attachments TO postgres;
GRANT ALL ON task_comments TO postgres;
GRANT ALL ON task_activity_log TO postgres;
GRANT ALL ON kb_categories TO postgres;
GRANT ALL ON kb_articles TO postgres;
GRANT ALL ON kb_article_media TO postgres;
GRANT ALL ON kb_article_comments TO postgres;
GRANT ALL ON kb_article_votes TO postgres;
GRANT ALL ON kb_article_revisions TO postgres;

GRANT ALL ON SEQUENCE task_attachments_id_seq TO postgres;
GRANT ALL ON SEQUENCE task_comments_id_seq TO postgres;
GRANT ALL ON SEQUENCE task_activity_log_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_categories_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_articles_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_article_media_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_article_comments_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_article_votes_id_seq TO postgres;
GRANT ALL ON SEQUENCE kb_article_revisions_id_seq TO postgres;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 009 completed: Enhanced Kanban and Knowledge Base created successfully';
END $$;
