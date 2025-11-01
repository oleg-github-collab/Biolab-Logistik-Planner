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

-- Insert default waste categories with CORRECT spelling
INSERT INTO waste_categories (name, description, icon, color, instructions, safety_notes, disposal_frequency) VALUES
('Eluate', 'Flussige Losungen aus chromatographischen Trennungen', '🧪', '#3B82F6', 
 'Eluate in gekennzeichnete Behalter sammeln. Getrennt nach Losungsmitteltyp lagern.',
 'Keine brennbaren Stoffe in der Nahe. Gut belufteter Bereich erforderlich.',
 'Wochentlich'),

('Quecksilbereluate', 'Quecksilberhaltige Losungen', '☢️', '#EF4444',
 'Nur in speziellen Hg-Behaltern sammeln. Beschriftung mit Datum und Konzentration.',
 'HOCHGIFTIG! Handschuhe und Schutzbrille erforderlich. Sofort bei Verschuttung melden.',
 'Monatlich'),

('Kuhlcontainer', 'Kuhlpflichtige Abfalle und Proben', '❄️', '#06B6D4',
 'Temperatur konstant bei 2-8C halten. Tagliche Temperaturkontrolle dokumentieren.',
 'Verfallsdatum beachten. Nicht mit anderen Abfallen mischen.',
 'Wochentlich'),

('EBV Regal', 'Elektronische Bauteile und Verbrauchsmaterialien', '📦', '#8B5CF6',
 'Elektronikschrott getrennt sammeln. Batterien separat entsorgen.',
 'Lithium-Batterien brandgefahrlich - nicht beschadigen.',
 'Monatlich'),

('Eimer', 'Allgemeine Laborabfalle', '🪣', '#10B981',
 'Scharfe Gegenstande in Kanulenbox. Chemikalien nicht in Hausmull.',
 'Handschuhe bei Entsorgung tragen.',
 'Taglich'),

('Asphalte', 'Asphalthaltige Ruckstande', '🛢️', '#F59E0B',
 'In metallischen Behaltern sammeln. An kuhlem Ort lagern.',
 'Hei - Verbrennungsgefahr! Nicht mit Wasser mischen.',
 'Monatlich'),

('Heptane', 'Heptanhaltige Losemittel', '⚗️', '#EC4899',
 'In Losemittelbehalter im Abzug sammeln. Behalter verschlossen halten.',
 'HOCHENTZUNDLICH! Von Zundquellen fernhalten. Dampfe giftig.',
 'Wochentlich'),

('Konigswasser', 'Gemisch aus Salz- und Salpetersaure', '⚠️', '#DC2626',
 'NUR im Abzug handhaben. In spezielle saurefte Behalter fullen.',
 'ATZEND! Schutzausrustung zwingend erforderlich. Nicht mit organischen Stoffen mischen.',
 'Bei Bedarf')

ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  instructions = EXCLUDED.instructions,
  safety_notes = EXCLUDED.safety_notes,
  disposal_frequency = EXCLUDED.disposal_frequency;
