-- Migration: Create public holidays table
-- Purpose: Store company-wide public holidays and non-working days

CREATE TABLE IF NOT EXISTS public_holidays (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE, -- For annually recurring holidays (e.g., Christmas)
  recurrence_month INTEGER, -- Month for recurring holidays (1-12)
  recurrence_day INTEGER, -- Day for recurring holidays (1-31)
  country_code VARCHAR(2) DEFAULT 'DE', -- ISO country code
  region VARCHAR(100), -- Optional region/state (e.g., 'Bayern', 'Berlin')
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_country ON public_holidays(country_code);
CREATE INDEX IF NOT EXISTS idx_public_holidays_recurring ON public_holidays(is_recurring, recurrence_month, recurrence_day);

-- Insert common German public holidays for 2025
INSERT INTO public_holidays (date, name, description, is_recurring, recurrence_month, recurrence_day, country_code) VALUES
  ('2025-01-01', 'Neujahr', 'Neujahrstag', true, 1, 1, 'DE'),
  ('2025-04-18', 'Karfreitag', 'Karfreitag 2025', false, NULL, NULL, 'DE'),
  ('2025-04-21', 'Ostermontag', 'Ostermontag 2025', false, NULL, NULL, 'DE'),
  ('2025-05-01', 'Tag der Arbeit', 'Maifeiertag', true, 5, 1, 'DE'),
  ('2025-05-29', 'Christi Himmelfahrt', 'Christi Himmelfahrt 2025', false, NULL, NULL, 'DE'),
  ('2025-06-09', 'Pfingstmontag', 'Pfingstmontag 2025', false, NULL, NULL, 'DE'),
  ('2025-10-03', 'Tag der Deutschen Einheit', 'Nationalfeiertag', true, 10, 3, 'DE'),
  ('2025-12-25', 'Erster Weihnachtstag', '1. Weihnachtsfeiertag', true, 12, 25, 'DE'),
  ('2025-12-26', 'Zweiter Weihnachtstag', '2. Weihnachtsfeiertag', true, 12, 26, 'DE')
ON CONFLICT (date) DO NOTHING;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_public_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_public_holidays_timestamp
  BEFORE UPDATE ON public_holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_public_holidays_updated_at();

COMMENT ON TABLE public_holidays IS 'Company-wide public holidays and non-working days';
COMMENT ON COLUMN public_holidays.is_recurring IS 'Whether this holiday recurs annually (e.g., Christmas)';
COMMENT ON COLUMN public_holidays.recurrence_month IS 'Month for recurring holidays (1-12)';
COMMENT ON COLUMN public_holidays.recurrence_day IS 'Day for recurring holidays (1-31)';
