import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { showError, showSuccess } from '../utils/toast';
import { Upload, X, FileText, Mic, Image as ImageIcon, Plus } from 'lucide-react';

const WasteManagementV2 = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    category_id: '',
    quantity: '',
    location: '',
    notes: '',
    status: 'pending'
  });
  const [mediaFiles, setMediaFiles] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load templates (these are the categories)
      const templatesResponse = await api.get('/waste/templates');
      const templatesData = templatesResponse?.data || [];

      // Load items
      const itemsResponse = await api.get('/waste/items');
      const itemsData = itemsResponse?.data || [];

      setCategories(templatesData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading waste data:', error);
      showError('Fehler beim Laden der Abfalldaten');
      setCategories([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/uploads/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMediaFiles([...mediaFiles, ...response.data.files]);
      showSuccess(`${files.length} Datei(en) hochgeladen`);
    } catch (error) {
      console.error('Upload error:', error);
      showError('Fehler beim Hochladen');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        template_id: formData.category_id,
        name: categories.find(c => c.id === parseInt(formData.category_id))?.name || 'Abfall',
        location: formData.location,
        quantity: formData.quantity,
        unit: 'Stück',
        notes: formData.notes
      };

      await api.post('/waste/items', data);
      showSuccess('Abfallposten erstellt');
      setShowModal(false);
      setFormData({ category_id: '', quantity: '', location: '', notes: '', status: 'pending' });
      setMediaFiles([]);
      loadData();
    } catch (error) {
      console.error('Error creating waste item:', error);
      showError('Fehler beim Erstellen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Abfallmanagement</h1>
          <p className="text-gray-600 mt-1">Verwalte Abfallkategorien und Entsorgung</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Neuer Eintrag
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {categories.map(cat => (
          <div
            key={cat.id}
            onClick={() => setSelectedCategory(cat)}
            className="p-4 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all"
            style={{ borderColor: cat.color, backgroundColor: `${cat.color}10` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{cat.icon}</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{cat.name}</h3>
                <p className="text-xs text-gray-600">{cat.disposal_frequency}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">{cat.description}</p>
          </div>
        ))}
      </div>

      {/* Selected Category Details */}
      {selectedCategory && (
        <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border-2" style={{ borderColor: selectedCategory.color }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-5xl">{selectedCategory.icon}</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCategory.name}</h2>
                <p className="text-gray-600">{selectedCategory.description}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Anweisungen
              </h3>
              <p className="text-gray-700 bg-blue-50 p-3 rounded-lg">{selectedCategory.instructions}</p>
            </div>
            <div>
              <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                ⚠️ Sicherheitshinweise
              </h3>
              <p className="text-red-700 bg-red-50 p-3 rounded-lg">{selectedCategory.safety_notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Items */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Letzte Einträge</h2>
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Keine Einträge vorhanden. Erstellen Sie einen neuen Eintrag.
            </div>
          ) : (
            items.map(item => {
              const category = categories.find(c => c.id === item.template_id);
              return (
                <div key={item.id} className="p-4 bg-white rounded-lg shadow border-l-4" style={{ borderLeftColor: category?.color || '#ccc' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category?.icon || '📦'}</span>
                      <div>
                        <h4 className="font-bold text-gray-900">{item.name || category?.name}</h4>
                        <p className="text-sm text-gray-600">{item.location} • {item.quantity} {item.unit}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'disposed' ? 'bg-green-100 text-green-800' :
                      item.status === 'archived' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status === 'disposed' ? 'Entsorgt' : item.status === 'archived' ? 'Archiviert' : 'Aktiv'}
                    </span>
                  </div>
                  {item.notes && <p className="mt-2 text-sm text-gray-700">{item.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Neuer Abfallposten</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Kategorie *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Kategorie wahlen...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Menge *</label>
                  <input
                    type="text"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                    placeholder="z.B. 5 Liter"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Standort *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                    placeholder="z.B. Labor 3"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notizen</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Zusatzliche Informationen..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Medien (Fotos/Audio/Dokumente)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Dateien hochladen</p>
                  </label>
                  {mediaFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {mediaFiles.map((file, idx) => (
                        <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm flex items-center gap-2">
                          {file.mimetype?.startsWith('image/') && <ImageIcon className="w-4 h-4" />}
                          {file.mimetype?.startsWith('audio/') && <Mic className="w-4 h-4" />}
                          {file.originalname}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteManagementV2;
