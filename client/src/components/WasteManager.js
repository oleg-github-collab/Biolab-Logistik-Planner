import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

const WasteManager = () => {
  const [wasteItems, setWasteItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('items');

  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    disposalInstructions: '',
    nextDisposalDate: '',
    color: '#A9D08E',
    icon: 'trash',
    category: 'general'
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    disposalInstructions: '',
    color: '#A9D08E',
    icon: 'trash',
    defaultFrequency: 'weekly',
    category: 'general'
  });

  // Categories and icons
  const categories = [
    { value: 'general', label: 'Allgemein', color: '#A9D08E' },
    { value: 'organic', label: 'Bio/Organisch', color: '#8FBC8F' },
    { value: 'recycling', label: 'Recycling', color: '#87CEEB' },
    { value: 'hazardous', label: 'Sondermüll', color: '#FFB6C1' },
    { value: 'electronic', label: 'Elektronik', color: '#DDA0DD' }
  ];

  const icons = [
    { value: 'trash', label: '🗑️ Allgemein' },
    { value: 'bio', label: '🥬 Bio' },
    { value: 'paper', label: '📄 Papier' },
    { value: 'plastic', label: '🥤 Plastik' },
    { value: 'glass', label: '🍺 Glas' },
    { value: 'electronic', label: '🔌 Elektronik' },
    { value: 'battery', label: '🔋 Batterien' },
    { value: 'chemical', label: '⚗️ Chemikalien' }
  ];

  const frequencies = [
    { value: 'daily', label: 'Täglich' },
    { value: 'weekly', label: 'Wöchentlich' },
    { value: 'biweekly', label: 'Alle 2 Wochen' },
    { value: 'monthly', label: 'Monatlich' },
    { value: 'quarterly', label: 'Vierteljährlich' },
    { value: 'yearly', label: 'Jährlich' }
  ];

  // Load data
  useEffect(() => {
    loadWasteItems();
    loadTemplates();
  }, []);

  const loadWasteItems = async () => {
    try {
      setLoading(true);
      // Mock API call - replace with actual API
      const mockItems = [
        {
          id: 1,
          name: 'Bioabfall',
          description: 'Organische Abfälle aus Küche',
          disposalInstructions: 'Alle 2 Wochen am Dienstag',
          nextDisposalDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
          color: '#8FBC8F',
          icon: 'bio',
          category: 'organic',
          lastDisposalDate: format(addDays(new Date(), -11), 'yyyy-MM-dd')
        },
        {
          id: 2,
          name: 'Gelber Sack',
          description: 'Verpackungen aus Kunststoff und Metall',
          disposalInstructions: 'Alle 2 Wochen am Mittwoch',
          nextDisposalDate: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
          color: '#FFD700',
          icon: 'plastic',
          category: 'recycling',
          lastDisposalDate: format(addDays(new Date(), -9), 'yyyy-MM-dd')
        }
      ];
      setWasteItems(mockItems);
    } catch (error) {
      setError('Fehler beim Laden der Abfall-Items');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const mockTemplates = [
        {
          id: 1,
          name: 'Standard Bioabfall',
          description: 'Vorlage für organischen Abfall',
          disposalInstructions: 'Alle 2 Wochen am Dienstag rausstellen',
          color: '#8FBC8F',
          icon: 'bio',
          defaultFrequency: 'biweekly',
          category: 'organic'
        },
        {
          id: 2,
          name: 'Restmüll Standard',
          description: 'Vorlage für allgemeinen Restmüll',
          disposalInstructions: 'Wöchentlich am Montag rausstellen',
          color: '#A9D08E',
          icon: 'trash',
          defaultFrequency: 'weekly',
          category: 'general'
        }
      ];
      setTemplates(mockTemplates);
    } catch (error) {
      setError('Fehler beim Laden der Vorlagen');
    }
  };

  const handleSaveItem = async () => {
    try {
      setLoading(true);

      if (editingItem) {
        // Update existing item
        const updatedItems = wasteItems.map(item =>
          item.id === editingItem.id ? { ...itemForm, id: editingItem.id } : item
        );
        setWasteItems(updatedItems);
      } else {
        // Create new item
        const newItem = {
          ...itemForm,
          id: Date.now(),
          lastDisposalDate: null
        };
        setWasteItems([...wasteItems, newItem]);
      }

      setShowAddModal(false);
      setEditingItem(null);
      resetItemForm();
    } catch (error) {
      setError('Fehler beim Speichern des Items');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setLoading(true);

      if (editingTemplate) {
        // Update existing template
        const updatedTemplates = templates.map(template =>
          template.id === editingTemplate.id
            ? { ...templateForm, id: editingTemplate.id }
            : template
        );
        setTemplates(updatedTemplates);
      } else {
        // Create new template
        const newTemplate = {
          ...templateForm,
          id: Date.now()
        };
        setTemplates([...templates, newTemplate]);
      }

      setShowTemplateModal(false);
      setEditingTemplate(null);
      resetTemplateForm();
    } catch (error) {
      setError('Fehler beim Speichern der Vorlage');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('Sind Sie sicher, dass Sie dieses Item löschen möchten?')) {
      try {
        setWasteItems(wasteItems.filter(item => item.id !== id));
      } catch (error) {
        setError('Fehler beim Löschen des Items');
      }
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Vorlage löschen möchten?')) {
      try {
        setTemplates(templates.filter(template => template.id !== id));
      } catch (error) {
        setError('Fehler beim Löschen der Vorlage');
      }
    }
  };

  const handleCreateFromTemplate = (template) => {
    const nextDate = calculateNextDate(template.defaultFrequency);
    setItemForm({
      name: template.name.replace('Standard ', ''),
      description: template.description,
      disposalInstructions: template.disposalInstructions,
      nextDisposalDate: format(nextDate, 'yyyy-MM-dd'),
      color: template.color,
      icon: template.icon,
      category: template.category
    });
    setShowAddModal(true);
  };

  const handleMarkAsDisposed = (id) => {
    const item = wasteItems.find(w => w.id === id);
    if (item) {
      const frequency = getFrequencyFromInstructions(item.disposalInstructions);
      const nextDate = calculateNextDate(frequency);

      const updatedItems = wasteItems.map(w =>
        w.id === id
          ? {
              ...w,
              lastDisposalDate: format(new Date(), 'yyyy-MM-dd'),
              nextDisposalDate: format(nextDate, 'yyyy-MM-dd')
            }
          : w
      );
      setWasteItems(updatedItems);
    }
  };

  const calculateNextDate = (frequency) => {
    const today = new Date();
    switch (frequency) {
      case 'daily': return addDays(today, 1);
      case 'weekly': return addDays(today, 7);
      case 'biweekly': return addDays(today, 14);
      case 'monthly': return addDays(today, 30);
      case 'quarterly': return addDays(today, 90);
      case 'yearly': return addDays(today, 365);
      default: return addDays(today, 7);
    }
  };

  const getFrequencyFromInstructions = (instructions) => {
    const lower = instructions.toLowerCase();
    if (lower.includes('täglich')) return 'daily';
    if (lower.includes('wöchentlich') && !lower.includes('2')) return 'weekly';
    if (lower.includes('2 wochen') || lower.includes('alle 2')) return 'biweekly';
    if (lower.includes('monatlich')) return 'monthly';
    if (lower.includes('vierteljährlich')) return 'quarterly';
    if (lower.includes('jährlich')) return 'yearly';
    return 'weekly';
  };

  const getDaysUntilDisposal = (nextDate) => {
    const days = differenceInDays(new Date(nextDate), new Date());
    return days;
  };

  const getStatusColor = (days) => {
    if (days < 0) return 'text-red-600 bg-red-100';
    if (days <= 1) return 'text-orange-600 bg-orange-100';
    if (days <= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      disposalInstructions: '',
      nextDisposalDate: '',
      color: '#A9D08E',
      icon: 'trash',
      category: 'general'
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      disposalInstructions: '',
      color: '#A9D08E',
      icon: 'trash',
      defaultFrequency: 'weekly',
      category: 'general'
    });
  };

  const editItem = (item) => {
    setItemForm({
      name: item.name,
      description: item.description,
      disposalInstructions: item.disposalInstructions,
      nextDisposalDate: item.nextDisposalDate,
      color: item.color,
      icon: item.icon,
      category: item.category
    });
    setEditingItem(item);
    setShowAddModal(true);
  };

  const editTemplate = (template) => {
    setTemplateForm({
      name: template.name,
      description: template.description,
      disposalInstructions: template.disposalInstructions,
      color: template.color,
      icon: template.icon,
      defaultFrequency: template.defaultFrequency,
      category: template.category
    });
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Abfallmanagement
        </h1>
        <p className="text-gray-600">
          Verwalten Sie Ihre Abfälle, Termine und Vorlagen effizient
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 text-red-800 hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'items'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Abfall-Items ({wasteItems.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Vorlagen ({templates.length})
          </button>
        </nav>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  resetItemForm();
                  setEditingItem(null);
                  setShowAddModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Neues Item</span>
              </button>
              <button
                onClick={loadWasteItems}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Aktualisieren
              </button>
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wasteItems.map(item => {
              const days = getDaysUntilDisposal(item.nextDisposalDate);
              const category = categories.find(c => c.value === item.category);
              const icon = icons.find(i => i.value === item.icon);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-lg border-l-4 overflow-hidden hover:shadow-xl transition-shadow"
                  style={{ borderLeftColor: item.color }}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          {icon?.label.split(' ')[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-500">{category?.label}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editItem(item)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{item.description}</p>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nächste Entsorgung
                        </label>
                        <div className={`text-sm font-medium px-2 py-1 rounded-md ${getStatusColor(days)}`}>
                          {days < 0 ? `${Math.abs(days)} Tage überfällig` :
                           days === 0 ? 'Heute' :
                           days === 1 ? 'Morgen' :
                           `In ${days} Tagen`}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(item.nextDisposalDate), 'dd.MM.yyyy - EEEE', { locale: de })}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Anweisungen
                        </label>
                        <p className="text-sm text-gray-700 mt-1">{item.disposalInstructions}</p>
                      </div>

                      {item.lastDisposalDate && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Letzte Entsorgung
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(item.lastDisposalDate), 'dd.MM.yyyy', { locale: de })}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => handleMarkAsDisposed(item.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 transition-colors"
                      >
                        ✓ Entsorgt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => {
                resetTemplateForm();
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <span>+</span>
              <span>Neue Vorlage</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => {
              const category = categories.find(c => c.value === template.category);
              const icon = icons.find(i => i.value === template.icon);
              const frequency = frequencies.find(f => f.value === template.defaultFrequency);

              return (
                <div
                  key={template.id}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${template.color}20` }}
                        >
                          {icon?.label.split(' ')[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500">{category?.label}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editTemplate(template)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{template.description}</p>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Standard-Häufigkeit
                        </label>
                        <p className="text-sm font-medium text-gray-900">{frequency?.label}</p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entsorgungsanweisungen
                        </label>
                        <p className="text-sm text-gray-700">{template.disposalInstructions}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleCreateFromTemplate(template)}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
                      >
                        Item aus Vorlage erstellen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingItem ? 'Item bearbeiten' : 'Neues Item erstellen'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Symbol
                    </label>
                    <select
                      value={itemForm.icon}
                      onChange={(e) => setItemForm({...itemForm, icon: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {icons.map(icon => (
                        <option key={icon.value} value={icon.value}>
                          {icon.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farbe
                    </label>
                    <input
                      type="color"
                      value={itemForm.color}
                      onChange={(e) => setItemForm({...itemForm, color: e.target.value})}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entsorgungsanweisungen *
                  </label>
                  <textarea
                    value={itemForm.disposalInstructions}
                    onChange={(e) => setItemForm({...itemForm, disposalInstructions: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="z.B. Alle 2 Wochen am Dienstag"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nächste Entsorgung *
                  </label>
                  <input
                    type="date"
                    value={itemForm.nextDisposalDate}
                    onChange={(e) => setItemForm({...itemForm, nextDisposalDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveItem}
                  disabled={loading || !itemForm.name || !itemForm.disposalInstructions || !itemForm.nextDisposalDate}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {loading ? 'Speichere...' : editingItem ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
                </h2>
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vorlagen-Name *
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({...templateForm, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Symbol
                    </label>
                    <select
                      value={templateForm.icon}
                      onChange={(e) => setTemplateForm({...templateForm, icon: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {icons.map(icon => (
                        <option key={icon.value} value={icon.value}>
                          {icon.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farbe
                    </label>
                    <input
                      type="color"
                      value={templateForm.color}
                      onChange={(e) => setTemplateForm({...templateForm, color: e.target.value})}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standard-Häufigkeit
                  </label>
                  <select
                    value={templateForm.defaultFrequency}
                    onChange={(e) => setTemplateForm({...templateForm, defaultFrequency: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {frequencies.map(frequency => (
                      <option key={frequency.value} value={frequency.value}>
                        {frequency.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entsorgungsanweisungen *
                  </label>
                  <textarea
                    value={templateForm.disposalInstructions}
                    onChange={(e) => setTemplateForm({...templateForm, disposalInstructions: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="z.B. Alle 2 Wochen am Dienstag rausstellen"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={loading || !templateForm.name || !templateForm.disposalInstructions}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  {loading ? 'Speichere...' : editingTemplate ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteManager;