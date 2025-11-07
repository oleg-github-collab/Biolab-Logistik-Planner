import React, { useState, useEffect } from 'react';
import {
  FileText, X, Search, Clock, Tag, CheckSquare, TrendingUp,
  Zap, Plus, Trash2, Edit, Save
} from 'lucide-react';
import {
  getTaskTemplates,
  createTaskFromTemplate,
  deleteTaskTemplate,
  createTaskTemplate
} from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const PRIORITIES = [
  { value: 'low', label: 'Niedrig', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Mittel', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Hoch', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Dringend', color: 'bg-red-100 text-red-700' }
];

const TaskTemplateSelector = ({ onClose, onTemplateUsed, users = [] }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [categories, setCategories] = useState(['all']);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    priority: 'medium',
    estimated_duration: 30,
    tags: [],
    is_public: false
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await getTaskTemplates();
      const templateList = response.data || [];
      setTemplates(templateList);

      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(templateList.map(t => t.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading templates:', error);
      showError('Fehler beim Laden der Vorlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (template) => {
    try {
      const response = await createTaskFromTemplate(template.id);
      showSuccess(`Aufgabe aus Vorlage "${template.name}" erstellt`);
      if (onTemplateUsed) {
        onTemplateUsed(response.data);
      }
      onClose();
    } catch (error) {
      console.error('Error using template:', error);
      showError('Fehler beim Erstellen der Aufgabe');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return;

    try {
      await deleteTaskTemplate(templateId);
      showSuccess('Vorlage gelöscht');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Fehler beim Löschen');
    }
  };

  const handleCreateTemplate = async () => {
    if (!formData.name.trim()) {
      showError('Name ist erforderlich');
      return;
    }

    try {
      await createTaskTemplate(formData);
      showSuccess('Vorlage erstellt');
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        category: '',
        priority: 'medium',
        estimated_duration: 30,
        tags: [],
        is_public: false
      });
      loadTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      showError('Fehler beim Erstellen');
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (template.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getPriorityBadge = (priority) => {
    const priorityObj = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityObj.color}`}>
        {priorityObj.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-7 h-7" />
              <div>
                <h3 className="text-xl font-bold">Aufgabenvorlagen</h3>
                <p className="text-sm text-purple-100">Schnelles Erstellen aus Vorlagen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                Neue Vorlage
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Vorlagen durchsuchen..."
                className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:bg-white/30 focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white font-medium focus:bg-white/30 focus:outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="text-slate-900">
                  {cat === 'all' ? 'Alle Kategorien' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-6 bg-purple-50 border-b border-purple-200">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              Neue Vorlage erstellen
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Vorlagenname"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder="Kategorie"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <textarea
                placeholder="Beschreibung"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
              />
              <div className="col-span-2 flex gap-3">
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm">Öffentlich</span>
                </label>
                <button
                  onClick={handleCreateTemplate}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold">Keine Vorlagen gefunden</p>
              <p className="text-sm mt-1">Erstelle eine neue Vorlage oder ändere die Filter</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="group bg-white border-2 border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-purple-300 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-slate-900 text-lg">{template.name}</h4>
                      {template.is_public && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                          Öffentlich
                        </span>
                      )}
                    </div>
                    {template.category && (
                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium mb-2">
                        {template.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{template.usage_count || 0}×</span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {template.description || 'Keine Beschreibung'}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {getPriorityBadge(template.priority)}
                  {template.estimated_duration && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {template.estimated_duration} Min
                    </span>
                  )}
                  {template.checklist && template.checklist.length > 0 && (
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" />
                      {template.checklist.length} Schritte
                    </span>
                  )}
                  {template.tags && template.tags.length > 0 && (
                    <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {template.tags.length} Tags
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2 font-semibold"
                  >
                    <Zap className="w-4 h-4" />
                    Verwenden
                  </button>
                  {!template.is_public && (
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskTemplateSelector;
