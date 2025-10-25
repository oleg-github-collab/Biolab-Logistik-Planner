import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WasteTemplatesView = ({ onUseTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterHazardLevel, setFilterHazardLevel] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'chemical',
    hazardLevel: 'low',
    description: '',
    disposalInstructions: '',
    requiredEquipment: ''
  });

  const categories = [
    { value: 'chemical', label: 'Chemikalien', icon: '⚗️', color: 'orange' },
    { value: 'biological', label: 'Biologisch', icon: '🦠', color: 'green' },
    { value: 'radioactive', label: 'Radioaktiv', icon: '☢️', color: 'yellow' },
    { value: 'general', label: 'Allgemein', icon: '🗑️', color: 'gray' }
  ];

  const hazardLevels = [
    { value: 'low', label: 'Niedrig', dots: 1, color: 'green' },
    { value: 'medium', label: 'Mittel', dots: 2, color: 'yellow' },
    { value: 'high', label: 'Hoch', dots: 3, color: 'orange' },
    { value: 'critical', label: 'Kritisch', dots: 4, color: 'red' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/waste-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching waste templates:', error);
      // Use mock data for now if API not available
      setTemplates([
        {
          id: 1,
          name: 'Chemische Abfälle',
          category: 'chemical',
          hazardLevel: 'high',
          description: 'Lösungsmittel und chemische Reagenzien',
          disposalInstructions: 'In gekennzeichneten Behältern sammeln',
          requiredEquipment: 'Schutzbrille, Handschuhe',
          usageCount: 23
        },
        {
          id: 2,
          name: 'Biologische Abfälle',
          category: 'biological',
          hazardLevel: 'low',
          description: 'Organische Materialien aus Experimenten',
          disposalInstructions: 'Autoklavieren vor Entsorgung',
          requiredEquipment: 'Schutzhandschuhe',
          usageCount: 45
        },
        {
          id: 3,
          name: 'Radioaktive Materialien',
          category: 'radioactive',
          hazardLevel: 'critical',
          description: 'Schwach radioaktive Isotope',
          disposalInstructions: 'Spezielle Strahlenschutzbehälter verwenden',
          requiredEquipment: 'Vollschutz, Dosimeter',
          usageCount: 7
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      category: 'chemical',
      hazardLevel: 'low',
      description: '',
      disposalInstructions: '',
      requiredEquipment: ''
    });
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      hazardLevel: template.hazardLevel,
      description: template.description || '',
      disposalInstructions: template.disposalInstructions || '',
      requiredEquipment: template.requiredEquipment || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await axios.put(`/api/waste-templates/${editingTemplate.id}`, formData);
      } else {
        await axios.post('/api/waste-templates', formData);
      }
      await fetchTemplates();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Fehler beim Speichern der Vorlage');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      return;
    }
    try {
      await axios.delete(`/api/waste-templates/${id}`);
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Fehler beim Löschen der Vorlage');
    }
  };

  const handleUse = (template) => {
    if (onUseTemplate) {
      onUseTemplate(template);
    }
  };

  const getCategoryInfo = (category) => {
    return categories.find(c => c.value === category) || categories[0];
  };

  const getHazardInfo = (level) => {
    return hazardLevels.find(h => h.value === level) || hazardLevels[0];
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
    const matchesHazard = filterHazardLevel === 'all' || template.hazardLevel === filterHazardLevel;
    return matchesSearch && matchesCategory && matchesHazard;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span>
            Abfallvorlagen
          </h2>
          <button
            onClick={handleCreateNew}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium btn-touch"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Vorlage
          </button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>

          <select
            value={filterHazardLevel}
            onChange={(e) => setFilterHazardLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Alle Gefahrenstufen</option>
            {hazardLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {searchQuery || filterCategory !== 'all' || filterHazardLevel !== 'all'
              ? 'Keine passenden Vorlagen gefunden'
              : 'Noch keine Vorlagen erstellt'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || filterCategory !== 'all' || filterHazardLevel !== 'all'
              ? 'Versuchen Sie andere Suchkriterien'
              : 'Erstellen Sie Ihre erste Vorlage!'}
          </p>
          {!searchQuery && filterCategory === 'all' && filterHazardLevel === 'all' && (
            <button
              onClick={handleCreateNew}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium btn-touch"
            >
              Erste Vorlage erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => {
            const categoryInfo = getCategoryInfo(template.category);
            const hazardInfo = getHazardInfo(template.hazardLevel);

            return (
              <div
                key={template.id}
                className={`border-2 border-${categoryInfo.color}-200 bg-${categoryInfo.color}-50 rounded-lg p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryInfo.icon}</span>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Kategorie:</span>
                    <span className="font-medium text-gray-900">{categoryInfo.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Gefahrenstufe:</span>
                    <div className="flex items-center gap-1">
                      {[...Array(4)].map((_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < hazardInfo.dots
                              ? `bg-${hazardInfo.color}-600`
                              : 'bg-gray-300'
                          }`}
                        ></span>
                      ))}
                      <span className={`ml-1 font-medium text-${hazardInfo.color}-700`}>
                        {hazardInfo.label}
                      </span>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    Verwendet: {template.usageCount || 0} mal
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(template)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors btn-touch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleUse(template)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors btn-touch"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Verwenden
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowModal(false)}
            ></div>

            <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl modal-mobile">
              <form onSubmit={handleSave}>
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                      {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="text-white hover:text-gray-200 transition-colors btn-touch"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="z.B. Chemische Abfälle"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 form-row-mobile">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kategorie <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gefahrenstufe <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.hazardLevel}
                        onChange={(e) => setFormData({ ...formData, hazardLevel: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {hazardLevels.map(level => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beschreibung
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Beschreibung des Abfalltyps..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Entsorgungshinweise
                    </label>
                    <textarea
                      value={formData.disposalInstructions}
                      onChange={(e) => setFormData({ ...formData, disposalInstructions: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Spezielle Anweisungen zur Entsorgung..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Erforderliche Ausrüstung
                    </label>
                    <input
                      type="text"
                      value={formData.requiredEquipment}
                      onChange={(e) => setFormData({ ...formData, requiredEquipment: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="z.B. Schutzbrille, Handschuhe"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-between safe-area-bottom">
                  {editingTemplate && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingTemplate.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium btn-touch"
                    >
                      Löschen
                    </button>
                  )}
                  <div className="flex gap-3 sm:ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors btn-touch"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium btn-touch"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteTemplatesView;
