import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  WASTE_CODES,
  WASTE_CATEGORIES,
  CONTAINER_TYPES,
  getMostCommonWaste,
  searchWaste,
  getWasteByCategory
} from '../data/wasteClassification';
import { useAuth } from '../context/AuthContext';

const QuickWasteEntry = ({ onSave }) => {
  const auth = useAuth(); const user = auth?.user;
  const [mode, setMode] = useState('quick'); // quick, search, scan
  const [wasteData, setWasteData] = useState({
    wasteCode: null,
    amount: '',
    unit: 'kg',
    container: '',
    disposalDate: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Search waste codes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = searchWaste(searchQuery);
      setSearchResults(results.slice(0, 8));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Most common waste for quick access
  const commonWaste = getMostCommonWaste();

  // Unit options
  const UNITS = [
    { value: 'kg', label: 'kg', icon: '⚖️' },
    { value: 'L', label: 'Liter', icon: '🧪' },
    { value: 'Stück', label: 'Stück', icon: '📦' },
    { value: 'Beutel', label: 'Beutel', icon: '🛍️' }
  ];

  const selectWaste = (wasteCode) => {
    const waste = WASTE_CODES[wasteCode];
    setWasteData({
      ...wasteData,
      wasteCode: wasteCode,
      container: waste.containerType
    });
    setMode('details');
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setMode('category');
  };

  const handleSave = () => {
    if (!wasteData.wasteCode) {
      alert('Bitte Abfallart wählen');
      return;
    }

    if (!wasteData.amount || parseFloat(wasteData.amount) <= 0) {
      alert('Bitte gültige Menge eingeben');
      return;
    }

    const waste = WASTE_CODES[wasteData.wasteCode];

    onSave({
      ...wasteData,
      wasteName: waste.name,
      category: waste.category,
      hazardLevel: WASTE_CATEGORIES[waste.category.toUpperCase()].hazardLevel,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      {mode === 'quick' && (
        <>
          {/* Quick Select - Common Waste */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Häufige Abfallarten
            </label>
            <div className="grid grid-cols-2 gap-2">
              {commonWaste.map(waste => {
                const category = WASTE_CATEGORIES[waste.category.toUpperCase()];
                return (
                  <button
                    key={waste.code}
                    onClick={() => selectWaste(waste.code)}
                    className="bg-white border-2 border-gray-200 rounded-lg p-3 text-left hover:border-blue-500 transition-all active:scale-95 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                          {waste.name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {waste.code}
                        </div>
                      </div>
                    </div>
                    {waste.hazardSymbols.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {waste.hazardSymbols.slice(0, 3).map((symbol, idx) => (
                          <span key={idx} className="text-sm">
                            {symbol === 'biohazard' && '☣️'}
                            {symbol === 'toxic' && '☠️'}
                            {symbol === 'sharp' && '💉'}
                            {symbol === 'flammable' && '🔥'}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Browse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Nach Kategorie
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(WASTE_CATEGORIES).slice(0, 6).map(category => (
                <button
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  className={`border-2 rounded-lg p-3 text-left transition-all active:scale-95 shadow-sm hover:shadow-md`}
                  style={{
                    borderColor: category.color,
                    background: `linear-gradient(135deg, ${category.color}15, ${category.color}05)`
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {category.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {getWasteByCategory(category.id).length} Typen
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Suchen
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) setMode('search');
                }}
                placeholder="Code oder Name eingeben..."
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* Search Results */}
      {mode === 'search' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Suchergebnisse ({searchResults.length})
            </label>
            <button
              onClick={() => {
                setMode('quick');
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Zurück
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map(waste => {
                const category = WASTE_CATEGORIES[waste.category.toUpperCase()];
                return (
                  <button
                    key={waste.code}
                    onClick={() => selectWaste(waste.code)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{category.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 mb-1">
                          {waste.name}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          {waste.description}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            {waste.code}
                          </span>
                          <span className="text-xs text-gray-500">
                            {category.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Keine Ergebnisse gefunden</p>
            </div>
          )}
        </div>
      )}

      {/* Category View */}
      {mode === 'category' && selectedCategory && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              {WASTE_CATEGORIES[selectedCategory.toUpperCase()].name}
            </label>
            <button
              onClick={() => {
                setMode('quick');
                setSelectedCategory(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Zurück
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {getWasteByCategory(selectedCategory).map(waste => (
              <button
                key={waste.code}
                onClick={() => selectWaste(waste.code)}
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="font-semibold text-gray-900 mb-1">
                  {waste.name}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {waste.description}
                </div>
                <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                  {waste.code}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Details Entry */}
      {mode === 'details' && wasteData.wasteCode && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Details eingeben
            </label>
            <button
              onClick={() => {
                setMode('quick');
                setWasteData({ ...wasteData, wasteCode: null });
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Ändern
            </button>
          </div>

          {/* Selected Waste Info */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 rounded-lg p-4"
               style={{ borderColor: WASTE_CODES[wasteData.wasteCode].color }}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">
                {WASTE_CATEGORIES[WASTE_CODES[wasteData.wasteCode].category.toUpperCase()].icon}
              </span>
              <div className="flex-1">
                <div className="font-bold text-gray-900 mb-1">
                  {WASTE_CODES[wasteData.wasteCode].name}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {WASTE_CODES[wasteData.wasteCode].description}
                </div>
                <div className="text-xs font-mono bg-white px-2 py-1 rounded inline-block">
                  {wasteData.wasteCode}
                </div>
              </div>
            </div>

            {/* Hazard Symbols */}
            {WASTE_CODES[wasteData.wasteCode].hazardSymbols.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
                {WASTE_CODES[wasteData.wasteCode].hazardSymbols.map((symbol, idx) => (
                  <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <span>
                      {symbol === 'biohazard' && '☣️'}
                      {symbol === 'toxic' && '☠️'}
                      {symbol === 'sharp' && '💉'}
                      {symbol === 'flammable' && '🔥'}
                      {symbol === 'corrosive' && '🧪'}
                      {symbol === 'radioactive' && '☢️'}
                    </span>
                    <span className="capitalize">{symbol}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Menge
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                value={wasteData.amount}
                onChange={(e) => setWasteData({ ...wasteData, amount: e.target.value })}
                placeholder="0.0"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
              />
              <select
                value={wasteData.unit}
                onChange={(e) => setWasteData({ ...wasteData, unit: e.target.value })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              >
                {UNITS.map(unit => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Container Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Behälter
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {CONTAINER_TYPES[wasteData.container].icon}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {CONTAINER_TYPES[wasteData.container].name}
                  </div>
                  <div className="text-xs text-gray-600">
                    Max: {CONTAINER_TYPES[wasteData.container].maxCapacity}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disposal Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entsorgungsdatum
            </label>
            <input
              type="date"
              value={wasteData.disposalDate}
              onChange={(e) => setWasteData({ ...wasteData, disposalDate: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notizen (optional)
            </label>
            <textarea
              value={wasteData.notes}
              onChange={(e) => setWasteData({ ...wasteData, notes: e.target.value })}
              placeholder="Zusätzliche Informationen..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Warning if max storage exceeded */}
          {WASTE_CODES[wasteData.wasteCode].maxStorageDays && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600">⚠️</span>
                <div className="flex-1 text-xs text-yellow-700">
                  <span className="font-medium">Hinweis:</span> Max. Lagerdauer{' '}
                  {WASTE_CODES[wasteData.wasteCode].maxStorageDays} Tage
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Abfall erfassen ({wasteData.amount} {wasteData.unit})
          </button>
        </div>
      )}
    </div>
  );
};

export default QuickWasteEntry;
