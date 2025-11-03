const { pool } = require('./config/database');

const wasteCategories = [
  {
    name: 'Acetone',
    category: 'acetone',
    icon: '🧪',
    color: '#ef4444',
    hazard_level: 'high',
    disposal_frequency_days: 14,
    description: 'Aceton-haltige Lösungsmittel und Abfälle',
    safety_instructions: 'Hochentzündlich! Gut verschließen. Von Zündquellen fernhalten.'
  },
  {
    name: 'Heptane',
    category: 'heptane',
    icon: '⚗️',
    color: '#f59e0b',
    hazard_level: 'high',
    disposal_frequency_days: 14,
    description: 'Heptan und heptanhaltige Lösungen',
    safety_instructions: 'Leichtentzündlich! Nur in zugelassenen Behältern lagern.'
  },
  {
    name: 'Koenigwasser',
    category: 'koenigwasser',
    icon: '⚠️',
    color: '#dc2626',
    hazard_level: 'critical',
    disposal_frequency_days: 7,
    description: 'Königswasser (HCl + HNO3) und ähnliche stark ätzende Säuregemische',
    safety_instructions: 'EXTREM ÄTZEND! Nur unter Abzug handhaben. Separate Entsorgung!'
  },
  {
    name: 'Eluate',
    category: 'eluate',
    icon: '💧',
    color: '#3b82f6',
    hazard_level: 'medium',
    disposal_frequency_days: 30,
    description: 'Chromatographie-Eluate und Extraktionslösungen',
    safety_instructions: 'Inhaltsstoffe dokumentieren. pH-Wert prüfen.'
  },
  {
    name: 'Kuehlcontainer',
    category: 'kuehlcontainer',
    icon: '❄️',
    color: '#06b6d4',
    hazard_level: 'medium',
    disposal_frequency_days: 60,
    description: 'Kühlbehälter und temperaturempfindliche Proben',
    safety_instructions: 'Kühlkette einhalten. Vor Entsorgung dokumentieren.'
  },
  {
    name: 'Wasserproben',
    category: 'wasserproben',
    icon: '🌊',
    color: '#0ea5e9',
    hazard_level: 'low',
    disposal_frequency_days: 21,
    description: 'Wasser- und Umweltproben',
    safety_instructions: 'Kontamination prüfen. Bei Auffälligkeiten gesondert entsorgen.'
  },
  {
    name: 'EBV Regal',
    category: 'ebv_regal',
    icon: '📦',
    color: '#8b5cf6',
    hazard_level: 'medium',
    disposal_frequency_days: 90,
    description: 'Elektronik- und Batterieabfälle aus Regalbestand',
    safety_instructions: 'Batterien separat sammeln. WEEE-Richtlinien beachten.'
  },
  {
    name: 'Eimer',
    category: 'eimer',
    icon: '🪣',
    color: '#6b7280',
    hazard_level: 'low',
    disposal_frequency_days: 30,
    description: 'Eimer mit Restinhalten und kontaminierten Behältern',
    safety_instructions: 'Inhalt kennzeichnen. Dicht verschließen.'
  },
  {
    name: 'Asphalte',
    category: 'asphalte',
    icon: '🛣️',
    color: '#404040',
    hazard_level: 'medium',
    disposal_frequency_days: 90,
    description: 'Asphaltproben und bitumenhaltige Materialien',
    safety_instructions: 'PAK-Gehalt beachten. Separate Entsorgung als Bauschutt.'
  },
  {
    name: 'Quecksilber',
    category: 'quecksilber',
    icon: '☢️',
    color: '#71717a',
    hazard_level: 'critical',
    disposal_frequency_days: 7,
    description: 'Quecksilber und quecksilberhaltige Abfälle',
    safety_instructions: 'HOCHGIFTIG! Sofort verschließen. Nur Fachpersonal! Keine Dämpfe einatmen!'
  },
  {
    name: 'Asbest und Materialproben',
    category: 'asbest',
    icon: '🧱',
    color: '#78716c',
    hazard_level: 'critical',
    disposal_frequency_days: 1,
    description: 'Asbest-verdächtige Materialien und Baustoffproben',
    safety_instructions: 'KREBSERREGEND! Sofort verpacken. Nur zertifizierte Entsorger!'
  },
  {
    name: 'Sondermüll',
    category: 'sondermuell',
    icon: '☣️',
    color: '#b91c1c',
    hazard_level: 'high',
    disposal_frequency_days: 14,
    description: 'Verschiedene Sonderabfälle und gefährliche Stoffe',
    safety_instructions: 'Genau kennzeichnen! Sicherheitsdatenblatt beifügen.'
  },
  {
    name: 'Sonstiges',
    category: 'sonstiges',
    icon: '📋',
    color: '#64748b',
    hazard_level: 'low',
    disposal_frequency_days: 30,
    description: 'Sonstige Abfälle die keiner anderen Kategorie zugeordnet werden',
    safety_instructions: 'Inhalt dokumentieren. Bei Unsicherheit Vorgesetzten fragen.'
  }
];

async function seedWasteCategories() {
  const client = await pool.connect();
  try {
    console.log('Seeding waste categories...');

    for (const category of wasteCategories) {
      const existingCheck = await client.query(
        'SELECT id FROM waste_templates WHERE name = $1',
        [category.name]
      );

      if (existingCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO waste_templates (
            name, category, icon, color, hazard_level,
            disposal_frequency_days, description, safety_instructions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            category.name,
            category.category,
            category.icon,
            category.color,
            category.hazard_level,
            category.disposal_frequency_days,
            category.description,
            category.safety_instructions
          ]
        );
        console.log(`✓ Added: ${category.name}`);
      } else {
        console.log(`- Exists: ${category.name}`);
      }
    }

    console.log('\n✅ Waste categories seeded successfully!');
  } catch (error) {
    console.error('Error seeding waste categories:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedWasteCategories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedWasteCategories;
