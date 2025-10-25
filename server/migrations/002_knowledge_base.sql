-- Knowledge Base System for Biolab Logistik Planner
-- Stores articles, guides, procedures with media support

-- Knowledge Base Categories
CREATE TABLE IF NOT EXISTS kb_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100), -- emoji or icon name
  color VARCHAR(50), -- hex color for UI
  parent_id INTEGER REFERENCES kb_categories(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT, -- Short description for search results

  -- Article metadata
  author_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,

  -- Permissions
  visibility VARCHAR(50) DEFAULT 'all', -- all, admin_only, role_specific
  allowed_roles TEXT[], -- Array of roles that can view

  -- SEO and search
  slug VARCHAR(500) UNIQUE,
  tags TEXT[], -- Array of tags for search

  -- Timestamps
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TIMESTAMP
);

-- Media files (images, videos, PDFs)
CREATE TABLE IF NOT EXISTS kb_media (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,

  -- File info
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size BIGINT NOT NULL, -- in bytes
  mime_type VARCHAR(100) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- image, video, pdf, document

  -- Media metadata
  width INTEGER, -- for images/videos
  height INTEGER,
  duration INTEGER, -- for videos (seconds)
  thumbnail_path VARCHAR(1000), -- thumbnail for videos

  -- Upload info
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Display order in article
  display_order INTEGER DEFAULT 0,
  caption TEXT,

  -- Storage info
  storage_provider VARCHAR(50) DEFAULT 'local', -- local, s3, cloudinary
  storage_url TEXT
);

-- Article revisions (version history)
CREATE TABLE IF NOT EXISTS kb_article_revisions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Revision metadata
  revision_number INTEGER NOT NULL,
  edited_by INTEGER NOT NULL REFERENCES users(id),
  edit_summary VARCHAR(500), -- What was changed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Article feedback
CREATE TABLE IF NOT EXISTS kb_article_feedback (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Feedback
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(article_id, user_id) -- One feedback per user per article
);

-- Article views tracking
CREATE TABLE IF NOT EXISTS kb_article_views (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- View metadata
  ip_address INET,
  user_agent TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_spent INTEGER, -- seconds spent on article

  -- Search context
  search_query VARCHAR(500), -- If user came from search
  referrer VARCHAR(1000)
);

-- Related articles (manual linking)
CREATE TABLE IF NOT EXISTS kb_article_relations (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  related_article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) DEFAULT 'related', -- related, prerequisite, see_also
  display_order INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(article_id, related_article_id)
);

-- Article comments (discussion)
CREATE TABLE IF NOT EXISTS kb_article_comments (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  parent_comment_id INTEGER REFERENCES kb_article_comments(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- Moderation
  is_approved BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarks (saved articles)
CREATE TABLE IF NOT EXISTS kb_bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  folder VARCHAR(255), -- Optional folder name
  notes TEXT, -- Personal notes about the article
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, article_id)
);

-- Search history for analytics
CREATE TABLE IF NOT EXISTS kb_search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  query VARCHAR(500) NOT NULL,
  results_count INTEGER,
  clicked_article_id INTEGER REFERENCES kb_articles(id) ON DELETE SET NULL,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET
);

-- Create indexes for performance
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_author ON kb_articles(author_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_published ON kb_articles(published_at);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_tags ON kb_articles USING GIN(tags);
CREATE INDEX idx_kb_media_article ON kb_media(article_id);
CREATE INDEX idx_kb_media_type ON kb_media(file_type);
CREATE INDEX idx_kb_revisions_article ON kb_article_revisions(article_id);
CREATE INDEX idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX idx_kb_views_article ON kb_article_views(article_id);
CREATE INDEX idx_kb_views_user ON kb_article_views(user_id);
CREATE INDEX idx_kb_comments_article ON kb_article_comments(article_id);
CREATE INDEX idx_kb_bookmarks_user ON kb_bookmarks(user_id);
CREATE INDEX idx_kb_search_query ON kb_search_history(query);

-- Full-text search indexes
CREATE INDEX idx_kb_articles_search ON kb_articles USING GIN(to_tsvector('english', title || ' ' || content || ' ' || COALESCE(summary, '')));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_kb_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_categories_updated_at
  BEFORE UPDATE ON kb_categories
  FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

CREATE TRIGGER kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

CREATE TRIGGER kb_comments_updated_at
  BEFORE UPDATE ON kb_article_comments
  FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

-- Trigger to create revision on article update
CREATE OR REPLACE FUNCTION create_kb_article_revision()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create revision if content actually changed
  IF OLD.title != NEW.title OR OLD.content != NEW.content OR OLD.summary != NEW.summary THEN
    INSERT INTO kb_article_revisions (
      article_id, title, content, summary, revision_number, edited_by
    )
    SELECT
      OLD.id,
      OLD.title,
      OLD.content,
      OLD.summary,
      COALESCE((SELECT MAX(revision_number) FROM kb_article_revisions WHERE article_id = OLD.id), 0) + 1,
      NEW.author_id -- In real implementation, would be current_user
    ;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_article_revision_trigger
  AFTER UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION create_kb_article_revision();

-- Sample data removed - will be created via first-setup or admin panel

COMMENT ON TABLE kb_categories IS 'Categories for organizing knowledge base articles';
COMMENT ON TABLE kb_articles IS 'Main knowledge base articles with full content';
COMMENT ON TABLE kb_media IS 'Media files (images, videos, PDFs) attached to articles';
COMMENT ON TABLE kb_article_revisions IS 'Version history of articles';
COMMENT ON TABLE kb_article_feedback IS 'User feedback (helpful/not helpful) on articles';
COMMENT ON TABLE kb_article_views IS 'Analytics tracking for article views';
COMMENT ON TABLE kb_article_relations IS 'Links between related articles';
COMMENT ON TABLE kb_article_comments IS 'Discussion/comments on articles';
COMMENT ON TABLE kb_bookmarks IS 'User bookmarks/saved articles';
COMMENT ON TABLE kb_search_history IS 'Search query history for analytics';
