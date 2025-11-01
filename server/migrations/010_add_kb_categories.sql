-- Add default categories to knowledge base
INSERT INTO kb_categories (name, description, icon, color) VALUES
('📚 Allgemein', 'Allgemeine Informationen und Dokumentation', '📚', '#3B82F6'),
('🔬 Labor', 'Laborverfahren und Protokolle', '🔬', '#8B5CF6'),
('🧪 Chemikalien', 'Chemikalienhandhabung und Sicherheit', '🧪', '#EC4899'),
('⚠️ Sicherheit', 'Sicherheitsrichtlinien und Notfallverfahren', '⚠️', '#EF4444'),
('🛠️ Geräte', 'Gerätebedienung und Wartung', '🛠️', '#F59E0B'),
('📋 Verfahren', 'Standard Operating Procedures (SOPs)', '📋', '#10B981'),
('❓ FAQ', 'Häufig gestellte Fragen', '❓', '#06B6D4')
ON CONFLICT (name) DO NOTHING;
