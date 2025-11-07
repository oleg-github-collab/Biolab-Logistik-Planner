-- ============================================================================
-- Migration 028: Task Templates
-- ============================================================================
-- Adds task template system for quick task creation
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_duration INTEGER, -- in minutes
  tags JSONB DEFAULT '[]'::jsonb,
  checklist JSONB DEFAULT '[]'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE, -- if true, available to all users
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_templates_created_by ON task_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_public ON task_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_task_templates_usage ON task_templates(usage_count DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_task_templates_updated_at ON task_templates;
CREATE TRIGGER trg_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default templates
INSERT INTO task_templates (name, description, category, priority, estimated_duration, tags, checklist, is_public) VALUES
  (
    'Laborgeräte reinigen',
    'Routinemäßige Reinigung und Wartung von Laborgeräten',
    'Wartung',
    'medium',
    30,
    '["Reinigung", "Wartung", "Labor"]'::jsonb,
    '[
      {"id": "1", "text": "Geräte ausschalten und abkühlen lassen", "completed": false},
      {"id": "2", "text": "Oberflächen mit geeignetem Reinigungsmittel säubern", "completed": false},
      {"id": "3", "text": "Verschleißteile überprüfen", "completed": false},
      {"id": "4", "text": "Dokumentation aktualisieren", "completed": false}
    ]'::jsonb,
    TRUE
  ),
  (
    'Chemikalienbestand prüfen',
    'Überprüfung und Aktualisierung des Chemikalienbestands',
    'Inventar',
    'high',
    45,
    '["Inventar", "Chemikalien", "Sicherheit"]'::jsonb,
    '[
      {"id": "1", "text": "Bestandsliste drucken", "completed": false},
      {"id": "2", "text": "Physischen Bestand zählen", "completed": false},
      {"id": "3", "text": "Ablaufdaten überprüfen", "completed": false},
      {"id": "4", "text": "Fehlbestände notieren", "completed": false},
      {"id": "5", "text": "Nachbestellung vorbereiten", "completed": false}
    ]'::jsonb,
    TRUE
  ),
  (
    'Sicherheitsprotokoll erstellen',
    'Erstellung eines neuen Sicherheitsprotokolls für Laborarbeiten',
    'Sicherheit',
    'high',
    60,
    '["Sicherheit", "Dokumentation", "Compliance"]'::jsonb,
    '[
      {"id": "1", "text": "Risiken identifizieren", "completed": false},
      {"id": "2", "text": "Schutzmaßnahmen definieren", "completed": false},
      {"id": "3", "text": "Notfallprozeduren festlegen", "completed": false},
      {"id": "4", "text": "Dokument reviewen lassen", "completed": false},
      {"id": "5", "text": "Team schulen", "completed": false}
    ]'::jsonb,
    TRUE
  ),
  (
    'Entsorgung planen',
    'Planung der fachgerechten Entsorgung von Labormaterialien',
    'Entsorgung',
    'medium',
    30,
    '["Entsorgung", "Umwelt", "Compliance"]'::jsonb,
    '[
      {"id": "1", "text": "Entsorgungsgüter kategorisieren", "completed": false},
      {"id": "2", "text": "Entsorgungstermin koordinieren", "completed": false},
      {"id": "3", "text": "Dokumentation vorbereiten", "completed": false},
      {"id": "4", "text": "Transport organisieren", "completed": false}
    ]'::jsonb,
    TRUE
  ),
  (
    'Schulung organisieren',
    'Organisation einer Schulungsveranstaltung für das Team',
    'Schulung',
    'medium',
    120,
    '["Schulung", "Team", "Entwicklung"]'::jsonb,
    '[
      {"id": "1", "text": "Thema und Ziele festlegen", "completed": false},
      {"id": "2", "text": "Trainer/Referenten finden", "completed": false},
      {"id": "3", "text": "Termin abstimmen", "completed": false},
      {"id": "4", "text": "Räume und Ausstattung buchen", "completed": false},
      {"id": "5", "text": "Teilnehmer einladen", "completed": false},
      {"id": "6", "text": "Materialien vorbereiten", "completed": false}
    ]'::jsonb,
    TRUE
  );

COMMENT ON TABLE task_templates IS 'Templates for quick task creation with pre-defined structure';
COMMENT ON COLUMN task_templates.usage_count IS 'Tracks how many times this template has been used';
COMMENT ON COLUMN task_templates.is_public IS 'If true, template is available to all users, otherwise only to creator';
