const { pool } = require('./config/database');

const wasteCategories = [
  {
    name: 'Biologischer Abfall',
    category: 'biological',
    icon: '🧬',
    color: '#10b981',
    hazard_level: 'high',
    disposal_frequency_days: 7,
    description: 'Biologische Laborabfälle, kontaminierte Kulturen',
    safety_instructions: 'Autoklavieren vor der Entsorgung. Biohazard-Behälter verwenden.'
  },
  {
    name: 'Chemische Abfälle',
    category: 'chemical',
    icon: '⚗️',
    color: '#f59e0b',
    hazard_level: 'critical',
    disposal_frequency_days: 14,
    description: 'Lösungsmittel, Säuren, Basen, Chemikalien',
    safety_instructions: 'Nach Gefahrstoffklasse trennen. Behälter beschriften. Nie mischen!'
  },
  {
    name: 'Scharfe Gegenstände',
    category: 'sharps',
    icon: '💉',
    color: '#ef4444',
    hazard_level: 'high',
    disposal_frequency_days: 7,
    description: 'Nadeln, Skalpelle, Glasbruch, Pipetten',
    safety_instructions: 'Nur in durchstichsicheren Sharps-Containern entsorgen!'
  },
  {
    name: 'Radioaktiver Abfall',
    category: 'radioactive',
    icon: '☢️',
    color: '#8b5cf6',
    hazard_level: 'critical',
    disposal_frequency_days: 30,
    description: 'Materialien mit radioaktiven Isotopen',
    safety_instructions: 'Strahlenschutzbeauftragten informieren. Abklingzeit beachten.'
  },
  {
    name: 'Allgemeiner Labormüll',
    category: 'general',
    icon: '🗑️',
    color: '#6b7280',
    hazard_level: 'low',
    disposal_frequency_days: 3,
    description: 'Papier, Verpackungen, unkontaminierte Materialien',
    safety_instructions: 'Recycling beachten. Keine kontaminierten Materialien!'
  },
  {
    name: 'Elektronikschrott',
    category: 'electronic',
    icon: '🔌',
    color: '#3b82f6',
    hazard_level: 'medium',
    disposal_frequency_days: 90,
    description: 'Alte Geräte, Batterien, elektronische Bauteile',
    safety_instructions: 'Batterien separat entsorgen. WEEE-Richtlinien beachten.'
  },
  {
    name: 'Pathologischer Abfall',
    category: 'pathological',
    icon: '🩸',
    color: '#dc2626',
    hazard_level: 'critical',
    disposal_frequency_days: 1,
    description: 'Gewebe, Körperflüssigkeiten, Organe',
    safety_instructions: 'Sofort kühlen. Nur zugelassene Entsorger. Doppelt verpacken!'
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
