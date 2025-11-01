-- Add default categories to knowledge base
-- First, add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_categories_name_unique'
  ) THEN
    ALTER TABLE kb_categories ADD CONSTRAINT kb_categories_name_unique UNIQUE (name);
  END IF;
END $$;

-- Insert default categories
INSERT INTO kb_categories (name, description, icon, color) VALUES
('Allgemein', 'Allgemeine Informationen und Dokumentation', '📚', '#3B82F6'),
('Labor', 'Laborverfahren und Protokolle', '🔬', '#8B5CF6'),
('Chemikalien', 'Chemikalienhandhabung und Sicherheit', '🧪', '#EC4899'),
('Sicherheit', 'Sicherheitsrichtlinien und Notfallverfahren', '⚠️', '#EF4444'),
('Geraete', 'Geraetebedienung und Wartung', '🛠️', '#F59E0B'),
('Verfahren', 'Standard Operating Procedures (SOPs)', '📋', '#10B981'),
('FAQ', 'Haeufig gestellte Fragen', '❓', '#06B6D4')
ON CONFLICT (name) DO NOTHING;
