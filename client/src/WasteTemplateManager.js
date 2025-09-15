import React, { useState, useEffect } from 'react';

const WasteTemplateManager = ({ 
  templates = [], 
  onTemplateCreate, 
  onTemplateUpdate, 
  onTemplateDelete,
  onTemplateApply
}) => {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    disposalInstructions: '',
    color: '#A9D08E',
    icon: 'trash',
    defaultFrequency: 'weekly',
    defaultNextDate: ''
  });

  const icons = [
    { value: 'trash', label: '🗑️ Allgemein' },
    { value: 'bio', label: '🌿 Bioabfall' },
    { value: 'paper', label: '📄 Papier' },
    { value: 'plastic', label: '♻️ Plastik' },
    { value: 'glass', label: '🍾 Glas' },
    { value: 'electronics', label: '💻 Elektronik' },
    { value: 'chemical', label: '🧪 Chemikalien' },
    { value: 'medical', label: '🏥 Medizinisch' }
  ];

  const frequencies = [
    { value: 'daily', label: 'Täglich' },
    { value: 'weekly', label: 'Wöchentlich' },
    { value: 'biweekly', label: 'Alle 2 Wochen' },
    { value: 'monthly', label: 'Monatlich' },
    { value: 'quarterly', label: 'Vierteljährlich' },
    { value: 'yearly', label: 'Jährlich' }
  ];

  const handleTemplateSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return;
    }

    const templateData = {
      ...formData,
      id: selectedTemplate?.id || Date.now()
    };

    if (selectedTemplate) {
      onTemplateUpdate(templateData);
    } else {
      onTemplateCreate(templateData);
    }

    setShowTemplateModal(false);
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      disposalInstructions: '',
      color: '#A9D08E',
      icon: 'trash',
      defaultFrequency: 'weekly',
      defaultNextDate: ''
    });
  };

  const openTemplateModal = (template = null) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        disposalInstructions: template.disposalInstructions || template.disposal_instructions || '',
        color: template.color || '#A9D08E',
        icon: template.icon || 'trash',
        defaultFrequency: template.defaultFrequency || template.default_frequency || 'weekly',
        defaultNextDate: template.defaultNextDate || template.default_next_date || ''
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        name: '',
        description: '',
        disposalInstructions: '',
        color: '#A9D08E',
        icon: 'trash',
        defaultFrequency: 'weekly',
        defaultNextDate: ''
      });
    }
    setShowTemplateModal(true);
  };

  const getIconDisplay = (icon) => {
    switch (icon) {
      case 'bio': return '🌿';
      case 'paper': return '📄';
      case 'plastic': return '♻️';
      case 'glass': return '🍾';
      case 'electronics': return '💻';
      case 'chemical': return '🧪';
      case 'medical': return '🏥';
      default: return '🗑️';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nicht festgelegt';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Abfall-Vorlagen</h2>
        <button
          onClick={() => openTemplateModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Neue Vorlage</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <div 
            key={template.id} 
            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div 
              className="h-3" 
              style={{ backgroundColor: template.color || '#A9D08E' }}
            />
            
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">
                    {getIconDisplay(template.icon)}
                  </span>
                  <h3 className="text-lg font-bold text-gray-800">
                    {template.name}
                  </h3>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => openTemplateModal(template)}
                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Bearbeiten"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onTemplateDelete(template.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Löschen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {template.description && (
                <p className="text-gray-600 mb-4 text-sm">
                  {template.description}
                </p>
              )}
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-700 text-sm mb-1">Entsorgungsanleitung</h4>
                  <p className="text-gray-600 text-sm whitespace-pre-line">
                    {template.disposalInstructions || template.disposal_instructions}
                  </p>
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Standardfrequenz: {frequencies.find(f => f.value === (template.defaultFrequency || template.default_frequency))?.label || 'Wöchentlich'}</span>
                  {template.defaultNextDate && (
                    <span>Nächster Termin: {formatDate(template.defaultNextDate || template.default_next_date)}</span>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => onTemplateApply(template)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Vorlage anwenden
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {templates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center border-2 border-dashed border-gray-300">
          <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Vorlagen vorhanden</h3>
          <p className="text-gray-500 mb-4">
            Erstelle Vorlagen für verschiedene Abfallarten, um die Entsorgungsplanung zu vereinfachen
          </p>
          <button
            onClick={() => openTemplateModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Erste Vorlage erstellen
          </button>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-auto slide-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleTemplateSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. Bioabfall"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optionale Beschreibung"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symbol
                  </label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="h-10 w-10 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#A9D08E"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entsorgungsanleitung *
                  </label>
                  <textarea
                    value={formData.disposalInstructions}
                    onChange={(e) => setFormData({...formData, disposalInstructions: e.target.value})}
                    required
                    rows="4"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Wie muss dieser Abfall entsorgt werden?"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standardfrequenz
                  </label>
                  <select
                    value={formData.defaultFrequency}
                    onChange={(e) => setFormData({...formData, defaultFrequency: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {frequencies.map(freq => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standard Nächster Termin
                  </label>
                  <input
                    type="date"
                    value={formData.defaultNextDate}
                    onChange={(e) => setFormData({...formData, defaultNextDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {selectedTemplate ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteTemplateManager;