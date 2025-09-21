import React, { useState } from 'react';

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
    color: '#5D8AA8',
    icon: 'trash',
    defaultFrequency: 'weekly',
    defaultNextDate: ''
  });

  const colorSuggestions = ['#5D8AA8', '#A9D08E', '#F4B084', '#D9E1F2', '#7DD3FC', '#FECACA', '#C4B5FD'];

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

  const adjustColor = (hex, amount) => {
    const clamp = (num) => Math.min(255, Math.max(0, num));
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00ff) + amount);
    const b = clamp((num & 0x0000ff) + amount);
    return `#${(b | (g << 8) | (r << 16)).toString(16).padStart(6, '0')}`;
  };

  const buildGradient = (color) => {
    try {
      return `linear-gradient(135deg, ${adjustColor(color, -20)} 0%, ${adjustColor(color, 20)} 100%)`;
    } catch (error) {
      return `linear-gradient(135deg, ${color}, ${color})`;
    }
  };

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
      color: '#5D8AA8',
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
        color: template.color || '#5D8AA8',
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
        color: '#5D8AA8',
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Abfall-Vorlagen</h2>
          <p className="text-sm text-slate-500">
            Speichere Routinen für dein Team – farblich codiert, selbsterklärend und bereit zur Anwendung.
          </p>
        </div>
        <button
          onClick={() => openTemplateModal()}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Neue Vorlage</span>
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map(template => (
          <div
            key={template.id}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1.5 hover:shadow-xl"
          >
            <div
              className="absolute inset-0 h-32"
              style={{ background: buildGradient(template.color || '#5D8AA8') }}
            />

            <div className="relative p-5 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-inner">
                    {getIconDisplay(template.icon)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold leading-tight drop-shadow-sm">
                      {template.name}
                    </h3>
                    <p className="text-xs uppercase tracking-wide text-white/80">
                      {frequencies.find(f => f.value === (template.defaultFrequency || template.default_frequency))?.label || 'Wöchentlich'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => openTemplateModal(template)}
                    className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
                    title="Bearbeiten"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onTemplateDelete(template.id)}
                    className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
                    title="Löschen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="mt-4 text-sm text-white/90">
                  {template.description}
                </p>
              )}
            </div>

            <div className="relative mt-2 space-y-4 rounded-t-3xl bg-white p-5 text-sm text-slate-600">
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Entsorgungsanleitung</h4>
                <p className="rounded-2xl bg-slate-50/80 p-3 leading-relaxed">
                  {template.disposalInstructions || template.disposal_instructions}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                  ⏱️ {frequencies.find(f => f.value === (template.defaultFrequency || template.default_frequency))?.label || 'Wöchentlich'}
                </span>
                {(template.defaultNextDate || template.default_next_date) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-600">
                    📅 Nächster Termin: {formatDate(template.defaultNextDate || template.default_next_date)}
                  </span>
                )}
              </div>

              <button
                onClick={() => onTemplateApply(template)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-400"
              >
                <span>Vorlage anwenden</span>
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {templates.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white/80 p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
            ♻️
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Noch keine Vorlagen</h3>
          <p className="mt-2 text-sm text-slate-500">
            Erstelle Vorlagen für Bioabfall, Papier, Restmüll & Co. und halte dein Team mit einem Tipp auf Kurs.
          </p>
          <button
            onClick={() => openTemplateModal()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
          >
            <span>Erste Vorlage erstellen</span>
          </button>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleTemplateSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="z.B. Bioabfall"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Beschreibung
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Optionale Beschreibung"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Symbol
                  </label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {icons.map(icon => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Farbe
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="h-10 w-10 rounded border border-slate-200"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="#A9D08E"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {colorSuggestions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({...formData, color})}
                        className={`h-8 w-8 rounded-full border border-white shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                          formData.color === color ? 'ring-2 ring-blue-400' : ''
                        }`}
                        style={{ background: buildGradient(color) }}
                        aria-label={`Farbe ${color} wählen`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Entsorgungsanleitung *
                  </label>
                  <textarea
                    value={formData.disposalInstructions}
                    onChange={(e) => setFormData({...formData, disposalInstructions: e.target.value})}
                    required
                    rows="4"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Wie muss dieser Abfall entsorgt werden?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Standardfrequenz
                  </label>
                  <select
                    value={formData.defaultFrequency}
                    onChange={(e) => setFormData({...formData, defaultFrequency: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {frequencies.map(freq => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Standard Nächster Termin
                  </label>
                  <input
                    type="date"
                    value={formData.defaultNextDate}
                    onChange={(e) => setFormData({...formData, defaultNextDate: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-500"
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
