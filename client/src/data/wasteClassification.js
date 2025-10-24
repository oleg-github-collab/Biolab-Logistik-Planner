/**
 * Waste Classification Database
 * Based on European Waste Catalogue (EWC) and AVV (Abfallverzeichnis-Verordnung)
 * Specifically for biomedical/laboratory waste management
 */

export const WASTE_CATEGORIES = {
  BIOLOGICAL: {
    id: 'biological',
    name: 'Biologische Abfälle',
    icon: '🧬',
    color: '#EF4444',
    hazardLevel: 'high',
    description: 'Infektiöse und biologisch kontaminierte Abfälle'
  },
  CHEMICAL: {
    id: 'chemical',
    name: 'Chemische Abfälle',
    icon: '🧪',
    color: '#F59E0B',
    hazardLevel: 'high',
    description: 'Chemikalien, Lösungsmittel und gefährliche Substanzen'
  },
  SHARPS: {
    id: 'sharps',
    name: 'Scharfe/Spitze Gegenstände',
    icon: '💉',
    color: '#DC2626',
    hazardLevel: 'critical',
    description: 'Kanülen, Skalpelle, Glasbruch'
  },
  PHARMACEUTICAL: {
    id: 'pharmaceutical',
    name: 'Pharmazeutische Abfälle',
    icon: '💊',
    color: '#8B5CF6',
    hazardLevel: 'medium',
    description: 'Medikamente und pharmazeutische Produkte'
  },
  RADIOACTIVE: {
    id: 'radioactive',
    name: 'Radioaktive Abfälle',
    icon: '☢️',
    color: '#10B981',
    hazardLevel: 'critical',
    description: 'Radioaktiv kontaminierte Materialien'
  },
  GENERAL: {
    id: 'general',
    name: 'Allgemeine Abfälle',
    icon: '🗑️',
    color: '#6B7280',
    hazardLevel: 'low',
    description: 'Nicht-gefährliche Abfälle'
  },
  RECYCLABLE: {
    id: 'recyclable',
    name: 'Wertstoffe',
    icon: '♻️',
    color: '#059669',
    hazardLevel: 'none',
    description: 'Recycelbare Materialien'
  }
};

export const WASTE_CODES = {
  // Biological Waste (18 01)
  'AS180101': {
    code: 'AS180101',
    category: 'biological',
    name: 'Scharfe Gegenstände',
    description: 'Kanülen, Skalpelle, infizierte scharfe Gegenstände',
    containerType: 'sharps-container',
    disposalMethod: 'autoclave-incineration',
    requiresAutoclave: true,
    maxStorageDays: 7,
    hazardSymbols: ['biohazard', 'sharp'],
    color: '#DC2626'
  },
  'AS180102': {
    code: 'AS180102',
    category: 'biological',
    name: 'Körperteile und Organe',
    description: 'Menschliche/tierische Körperteile, Organe',
    containerType: 'sealed-bag',
    disposalMethod: 'incineration',
    requiresAutoclave: false,
    maxStorageDays: 3,
    hazardSymbols: ['biohazard'],
    color: '#EF4444',
    requiresCremation: true
  },
  'AS180103': {
    code: 'AS180103',
    category: 'biological',
    name: 'Infektiöse Abfälle',
    description: 'Mit Blut/Körperflüssigkeiten kontaminierte Materialien',
    containerType: 'yellow-bag',
    disposalMethod: 'autoclave-incineration',
    requiresAutoclave: true,
    maxStorageDays: 7,
    hazardSymbols: ['biohazard'],
    color: '#FBBF24'
  },
  'AS180104': {
    code: 'AS180104',
    category: 'biological',
    name: 'Nicht-infektiöse Abfälle',
    description: 'Nicht mit gefährlichen Stoffen kontaminiert',
    containerType: 'standard-bag',
    disposalMethod: 'standard-disposal',
    requiresAutoclave: false,
    maxStorageDays: 30,
    hazardSymbols: [],
    color: '#9CA3AF'
  },

  // Chemical Waste (16 05)
  'AS160504': {
    code: 'AS160504',
    category: 'chemical',
    name: 'Gefährliche Gase',
    description: 'Druckgasflaschen mit gefährlichen Gasen',
    containerType: 'gas-cylinder',
    disposalMethod: 'specialized-treatment',
    requiresAutoclave: false,
    maxStorageDays: 90,
    hazardSymbols: ['compressed-gas', 'toxic'],
    color: '#F59E0B',
    requiresVentilation: true
  },
  'AS160506': {
    code: 'AS160506',
    category: 'chemical',
    name: 'Laborchemikalien',
    description: 'Gefährliche organische/anorganische Chemikalien',
    containerType: 'chemical-container',
    disposalMethod: 'chemical-treatment',
    requiresAutoclave: false,
    maxStorageDays: 180,
    hazardSymbols: ['corrosive', 'toxic'],
    color: '#FB923C'
  },
  'AS140601': {
    code: 'AS140601',
    category: 'chemical',
    name: 'Halogenierte Lösemittel',
    description: 'Chloroform, Dichlormethan, etc.',
    containerType: 'solvent-container',
    disposalMethod: 'incineration',
    requiresAutoclave: false,
    maxStorageDays: 180,
    hazardSymbols: ['flammable', 'toxic', 'environmental'],
    color: '#F97316',
    requiresSeparation: true
  },
  'AS140602': {
    code: 'AS140602',
    category: 'chemical',
    name: 'Nicht-halogenierte Lösemittel',
    description: 'Aceton, Ethanol, Methanol, etc.',
    containerType: 'solvent-container',
    disposalMethod: 'recycling-incineration',
    requiresAutoclave: false,
    maxStorageDays: 180,
    hazardSymbols: ['flammable'],
    color: '#FB923C'
  },

  // Pharmaceutical Waste (18 02)
  'AS180205': {
    code: 'AS180205',
    category: 'pharmaceutical',
    name: 'Zytostatika',
    description: 'Chemotherapeutika und zytotoxische Medikamente',
    containerType: 'cytotoxic-container',
    disposalMethod: 'high-temp-incineration',
    requiresAutoclave: false,
    maxStorageDays: 30,
    hazardSymbols: ['toxic', 'carcinogenic'],
    color: '#A855F7',
    requiresSpecialHandling: true
  },
  'AS180206': {
    code: 'AS180206',
    category: 'pharmaceutical',
    name: 'Andere Medikamente',
    description: 'Abgelaufene/unbrauchbare Medikamente',
    containerType: 'pharmaceutical-container',
    disposalMethod: 'incineration',
    requiresAutoclave: false,
    maxStorageDays: 90,
    hazardSymbols: ['pharmaceutical'],
    color: '#C084FC'
  },

  // Radioactive Waste (18 01 03*)
  'AS180103S': {
    code: 'AS180103S',
    category: 'radioactive',
    name: 'Radioaktive Abfälle',
    description: 'Mit radioaktiven Stoffen kontaminierte Materialien',
    containerType: 'lead-container',
    disposalMethod: 'radioactive-disposal',
    requiresAutoclave: false,
    maxStorageDays: 365,
    hazardSymbols: ['radioactive'],
    color: '#10B981',
    requiresRadiationMonitoring: true,
    requiresLicensing: true
  },

  // Sharps (18 01 01)
  'AS180109': {
    code: 'AS180109',
    category: 'sharps',
    name: 'Nicht-kontaminierte Kanülen',
    description: 'Unbenutzte oder nicht-infektiöse Kanülen',
    containerType: 'sharps-container',
    disposalMethod: 'standard-disposal',
    requiresAutoclave: false,
    maxStorageDays: 30,
    hazardSymbols: ['sharp'],
    color: '#94A3B8'
  },

  // General Waste
  'AS200301': {
    code: 'AS200301',
    category: 'general',
    name: 'Gemischte Siedlungsabfälle',
    description: 'Allgemeine nicht-gefährliche Abfälle',
    containerType: 'standard-bin',
    disposalMethod: 'landfill',
    requiresAutoclave: false,
    maxStorageDays: 30,
    hazardSymbols: [],
    color: '#6B7280'
  },

  // Recyclable Waste
  'AS150101': {
    code: 'AS150101',
    category: 'recyclable',
    name: 'Papier und Pappe',
    description: 'Verpackungen aus Papier und Pappe',
    containerType: 'paper-bin',
    disposalMethod: 'recycling',
    requiresAutoclave: false,
    maxStorageDays: 60,
    hazardSymbols: [],
    color: '#3B82F6'
  },
  'AS150102': {
    code: 'AS150102',
    category: 'recyclable',
    name: 'Kunststoffverpackungen',
    description: 'Verpackungen aus Kunststoff',
    containerType: 'plastic-bin',
    disposalMethod: 'recycling',
    requiresAutoclave: false,
    maxStorageDays: 60,
    hazardSymbols: [],
    color: '#FBBF24'
  },
  'AS150107': {
    code: 'AS150107',
    category: 'recyclable',
    name: 'Glasverpackungen',
    description: 'Verpackungen aus Glas',
    containerType: 'glass-bin',
    disposalMethod: 'recycling',
    requiresAutoclave: false,
    maxStorageDays: 60,
    hazardSymbols: [],
    color: '#059669'
  }
};

export const CONTAINER_TYPES = {
  'sharps-container': {
    id: 'sharps-container',
    name: 'Kanülenabwurfbehälter',
    icon: '🗑️',
    color: '#FBBF24',
    maxCapacity: '2L',
    isReusable: false,
    requiresSealing: true
  },
  'yellow-bag': {
    id: 'yellow-bag',
    name: 'Gelber Sack (Infektiös)',
    icon: '🟨',
    color: '#FBBF24',
    maxCapacity: '60L',
    isReusable: false,
    requiresSealing: true
  },
  'sealed-bag': {
    id: 'sealed-bag',
    name: 'Versiegelter Beutel',
    icon: '📦',
    color: '#DC2626',
    maxCapacity: '30L',
    isReusable: false,
    requiresSealing: true
  },
  'chemical-container': {
    id: 'chemical-container',
    name: 'Chemikalienbehälter',
    icon: '🧪',
    color: '#F59E0B',
    maxCapacity: '20L',
    isReusable: true,
    requiresLabeling: true
  },
  'solvent-container': {
    id: 'solvent-container',
    name: 'Lösemittelbehälter',
    icon: '⚗️',
    color: '#FB923C',
    maxCapacity: '20L',
    isReusable: true,
    requiresLabeling: true
  },
  'cytotoxic-container': {
    id: 'cytotoxic-container',
    name: 'Zytostatika-Behälter',
    icon: '☠️',
    color: '#A855F7',
    maxCapacity: '10L',
    isReusable: false,
    requiresSealing: true,
    requiresSpecialHandling: true
  },
  'lead-container': {
    id: 'lead-container',
    name: 'Blei-Abschirmbehälter',
    icon: '☢️',
    color: '#10B981',
    maxCapacity: '5L',
    isReusable: true,
    requiresRadiationShielding: true
  },
  'standard-bag': {
    id: 'standard-bag',
    name: 'Standard Müllsack',
    icon: '🗑️',
    color: '#6B7280',
    maxCapacity: '120L',
    isReusable: false
  }
};

export const DISPOSAL_METHODS = {
  'autoclave-incineration': {
    name: 'Autoklavierung + Verbrennung',
    steps: ['Autoklavierung bei 121°C', 'Verbrennung'],
    cost: 'high',
    duration: '2-3 days'
  },
  'incineration': {
    name: 'Verbrennung',
    steps: ['Direkte Verbrennung bei >1000°C'],
    cost: 'high',
    duration: '1-2 days'
  },
  'high-temp-incineration': {
    name: 'Hochtemperatur-Verbrennung',
    steps: ['Verbrennung bei >1200°C'],
    cost: 'very-high',
    duration: '2-3 days'
  },
  'chemical-treatment': {
    name: 'Chemische Behandlung',
    steps: ['Neutralisation', 'Fällung', 'Entsorgung'],
    cost: 'high',
    duration: '3-5 days'
  },
  'radioactive-disposal': {
    name: 'Radioaktive Entsorgung',
    steps: ['Abklingen', 'Endlagerung'],
    cost: 'very-high',
    duration: '30-365 days'
  },
  'recycling': {
    name: 'Recycling',
    steps: ['Sortierung', 'Wiederverwertung'],
    cost: 'low',
    duration: '7-14 days'
  },
  'standard-disposal': {
    name: 'Standardentsorgung',
    steps: ['Sammlung', 'Müllverbrennung'],
    cost: 'low',
    duration: '1-2 days'
  }
};

export const HAZARD_SYMBOLS = {
  'biohazard': {
    symbol: '☣️',
    name: 'Biogefährdung',
    color: '#EF4444',
    description: 'Biologisch gefährlich'
  },
  'radioactive': {
    symbol: '☢️',
    name: 'Radioaktiv',
    color: '#10B981',
    description: 'Radioaktive Strahlung'
  },
  'toxic': {
    symbol: '☠️',
    name: 'Giftig',
    color: '#DC2626',
    description: 'Giftige Substanz'
  },
  'corrosive': {
    symbol: '🧪',
    name: 'Ätzend',
    color: '#F59E0B',
    description: 'Ätzende Wirkung'
  },
  'flammable': {
    symbol: '🔥',
    name: 'Entzündlich',
    color: '#F97316',
    description: 'Leicht entzündlich'
  },
  'compressed-gas': {
    symbol: '💨',
    name: 'Druckgas',
    color: '#6B7280',
    description: 'Unter Druck stehendes Gas'
  },
  'sharp': {
    symbol: '💉',
    name: 'Stich-/Schnittverletzung',
    color: '#DC2626',
    description: 'Scharfe/spitze Gegenstände'
  },
  'carcinogenic': {
    symbol: '⚠️',
    name: 'Krebserregend',
    color: '#A855F7',
    description: 'Krebserregende Substanz'
  },
  'environmental': {
    symbol: '🌍',
    name: 'Umweltgefährdend',
    color: '#059669',
    description: 'Gefährlich für Umwelt'
  }
};

// Quick search/filter helpers
export const getWasteByCategory = (categoryId) => {
  return Object.values(WASTE_CODES).filter(
    waste => waste.category === categoryId
  );
};

export const getWasteByHazardLevel = (level) => {
  return Object.values(WASTE_CODES).filter(
    waste => WASTE_CATEGORIES[waste.category.toUpperCase()]?.hazardLevel === level
  );
};

export const searchWaste = (query) => {
  const lowerQuery = query.toLowerCase();
  return Object.values(WASTE_CODES).filter(
    waste =>
      waste.code.toLowerCase().includes(lowerQuery) ||
      waste.name.toLowerCase().includes(lowerQuery) ||
      waste.description.toLowerCase().includes(lowerQuery)
  );
};

export const getMostCommonWaste = () => {
  // Most commonly used waste types in biolab
  return [
    'AS180103', // Infektiöse Abfälle
    'AS180101', // Scharfe Gegenstände
    'AS140602', // Nicht-halogenierte Lösemittel
    'AS180104', // Nicht-infektiöse Abfälle
    'AS150101', // Papier
    'AS150102'  // Kunststoff
  ].map(code => WASTE_CODES[code]);
};

export default {
  WASTE_CATEGORIES,
  WASTE_CODES,
  CONTAINER_TYPES,
  DISPOSAL_METHODS,
  HAZARD_SYMBOLS,
  getWasteByCategory,
  getWasteByHazardLevel,
  searchWaste,
  getMostCommonWaste
};
