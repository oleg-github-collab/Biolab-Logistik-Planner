import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Trash2, Edit2, Plus, AlertTriangle, Info } from 'lucide-react';

const WasteTemplatesAdmin = () => {
  const { state } = useAuth();
  const { user } = state;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    hazard_level: 'medium',
    disposal_frequency_days: '',
    disposal_instructions: '',
    default_frequency: 'weekly',
    waste_code: '',
    color: '#3B82F6',
    icon: '🗑️',
    description: '',
    safety_instructions: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/waste/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Vorlagen:', error);
      toast.error('Fehler beim Laden der Abfallvorlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.hazard_level) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      if (editingTemplate) {
        await api.put(`/waste/templates/${editingTemplate.id}`, formData);
        toast.success('Vorlage erfolgreich aktualisiert');
      } else {
        await api.post('/waste/templates', formData);
        toast.success('Vorlage erfolgreich erstellt');
      }

      loadTemplates();
      closeModal();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Speichern der Vorlage');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sind Sie sicher, dass Sie diese Vorlage löschen möchten?')) {
      return;
    }

    try {
      await api.delete(`/waste/templates/${id}`);
      toast.success('Vorlage erfolgreich gelöscht');
      loadTemplates();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Löschen der Vorlage');
    }
  };

  const openModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData(template);
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        category: '',
        hazard_level: 'medium',
        disposal_frequency_days: '',
        disposal_instructions: '',
        default_frequency: 'weekly',
        waste_code: '',
        color: '#3B82F6',
        icon: '🗑️',
        description: '',
        safety_instructions: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const getHazardColor = (level) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      critical: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[level] || colors.medium;
  };

  const getHazardLabel = (level) => {
    const labels = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
      critical: 'Kritisch'
    };
    return labels[level] || level;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Abfallvorlagen verwalten
            </h1>
            <p className="text-gray-600">
              Erstellen und bearbeiten Sie Vorlagen für verschiedene Abfalltypen
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-md"
          >
            <Plus className="w-5 h-5" />
            Neue Vorlage
          </button>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Keine Vorlagen vorhanden</p>
            <p className="text-gray-400 text-sm mt-2">
              Erstellen Sie Ihre erste Abfallvorlage
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
                style={{ borderLeft: `4px solid ${template.color || '#3B82F6'}` }}
              >
                {/* Icon & Name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{template.icon || '🗑️'}</span>
                    <div>
                      <h3 className="font-bold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600">{template.category}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getHazardColor(template.hazard_level)}`}>
                    {getHazardLabel(template.hazard_level)}
                  </span>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Waste Code */}
                {template.waste_code && (
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-700">Code: {template.waste_code}</span>
                  </div>
                )}

                {/* Frequency */}
                {template.disposal_frequency_days && (
                  <p className="text-sm text-gray-600 mb-4">
                    Entsorgung alle {template.disposal_frequency_days} Tage
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openModal(template)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Usage Count */}
                {template.usage_count > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Verwendet in {template.usage_count} Einträgen
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Category & Hazard Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategorie <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gefahrenstufe <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.hazard_level}
                      onChange={(e) => setFormData({ ...formData, hazard_level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                      <option value="critical">Kritisch</option>
                    </select>
                  </div>
                </div>

                {/* Icon & Color */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icon (Emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="🗑️"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farbe
                    </label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Waste Code & Frequency Days */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Abfallcode (AVV)
                    </label>
                    <input
                      type="text"
                      value={formData.waste_code}
                      onChange={(e) => setFormData({ ...formData, waste_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="z.B. 18 01 01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Entsorgungsintervall (Tage)
                    </label>
                    <input
                      type="number"
                      value={formData.disposal_frequency_days}
                      onChange={(e) => setFormData({ ...formData, disposal_frequency_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="z.B. 7"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Allgemeine Informationen über diesen Abfalltyp..."
                  />
                </div>

                {/* Disposal Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entsorgungsprotokoll
                  </label>
                  <textarea
                    value={formData.disposal_instructions}
                    onChange={(e) => setFormData({ ...formData, disposal_instructions: e.target.value })}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Schritt-für-Schritt Anleitung zur Entsorgung..."
                  />
                </div>

                {/* Safety Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sicherheitshinweise
                  </label>
                  <textarea
                    value={formData.safety_instructions}
                    onChange={(e) => setFormData({ ...formData, safety_instructions: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Wichtige Sicherheitshinweise beim Umgang mit diesem Abfall..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                  >
                    {editingTemplate ? 'Aktualisieren' : 'Erstellen'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WasteTemplatesAdmin;
