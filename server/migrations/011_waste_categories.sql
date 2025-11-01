-- Enhanced waste categories table
CREATE TABLE IF NOT EXISTS waste_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20) DEFAULT '#3B82F6',
  instructions TEXT,
  safety_notes TEXT,
  image_url TEXT,
  disposal_frequency VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default waste categories
INSERT INTO waste_categories (name, description, icon, color, instructions, safety_notes, disposal_frequency) VALUES
('Eluare', 'Flüssige Lösungen aus chromatographischen Trennungen', '🧪', '#3B82F6', 
 'Eluate in gekennzeichnete Behälter sammeln. Getrennt nach Lösungsmitteltyp lagern.',
 'Keine brennbaren Stoffe in der Nähe. Gut belüfteter Bereich erforderlich.',
 'Wöchentlich'),

('Quecksilbereluate', 'Quecksilberhaltige Lösungen', '☢️', '#EF4444',
 'Nur in speziellen Hg-Behältern sammeln. Beschriftung mit Datum und Konzentration.',
 'HOCHGIFTIG! Handschuhe und Schutzbrille erforderlich. Sofort bei Verschüttung melden.',
 'Monatlich'),

('Kühlcontainer', 'Kühlpflichtige Abfälle und Proben', '❄️', '#06B6D4',
 'Temperatur konstant bei 2-8°C halten. Tägliche Temperaturkontrolle dokumentieren.',
 'Verfallsdatum beachten. Nicht mit anderen Abfällen mischen.',
 'Wöchentlich'),

('EBV Regal', 'Elektronische Bauteile und Verbrauchsmaterialien', '📦', '#8B5CF6',
 'Elektronikschrott getrennt sammeln. Batterien separat entsorgen.',
 'Lithium-Batterien brandgefährlich - nicht beschädigen.',
 'Monatlich'),

('Eimer', 'Allgemeine Laborabfälle', '🪣', '#10B981',
 'Scharfe Gegenstände in Kanülenbox. Chemikalien nicht in Hausmüll.',
 'Handschuhe bei Entsorgung tragen.',
 'Täglich'),

('Asphalte', 'Asphalthaltige Rückstände', '🛢️', '#F59E0B',
 'In metallischen Behältern sammeln. An kühlem Ort lagern.',
 'Heiß - Verbrennungsgefahr! Nicht mit Wasser mischen.',
 'Monatlich'),

('Heptane', 'Heptanhaltige Lösemittel', '⚗️', '#EC4899',
 'In Lösemittelbehälter im Abzug sammeln. Behälter verschlossen halten.',
 'HOCHENTZÜNDLICH! Von Zündquellen fernhalten. Dämpfe giftig.',
 'Wöchentlich'),

('Königswasser', 'Gemisch aus Salz- und Salpetersäure', '⚠️', '#DC2626',
 'NUR im Abzug handhaben. In spezielle säurefeste Behälter füllen.',
 'ÄTZEND! Schutzausrüstung zwingend erforderlich. Nicht mit organischen Stoffen mischen.',
 'Bei Bedarf')

ON CONFLICT (name) DO NOTHING;

-- Add category reference to waste_logs
ALTER TABLE waste_logs 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES waste_categories(id) ON DELETE SET NULL;

-- Update existing waste logs to match categories (optional)
UPDATE waste_logs SET category_id = (
  SELECT id FROM waste_categories WHERE name = waste_logs.waste_type LIMIT 1
) WHERE category_id IS NULL;
