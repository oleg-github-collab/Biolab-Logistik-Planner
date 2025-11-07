import React, { useState, useEffect } from 'react';
import { Zap, Plus, X, Edit, Trash2, Save } from 'lucide-react';
import { getQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply, useQuickReply } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const QuickRepliesPanel = ({ onSelect, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    shortcut: '',
    category: 'general'
  });
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'general', 'greeting', 'closing', 'question', 'other'];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await getQuickReplies();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      showError('Fehler beim Laden der Vorlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateQuickReply(editingId, formData);
        showSuccess('Vorlage aktualisiert');
      } else {
        await createQuickReply(formData);
        showSuccess('Vorlage erstellt');
      }
      setFormData({ title: '', content: '', shortcut: '', category: 'general' });
      setShowForm(false);
      setEditingId(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      showError('Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return;
    try {
      await deleteQuickReply(id);
      showSuccess('Vorlage gelöscht');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Fehler beim Löschen');
    }
  };

  const handleSelect = async (template) => {
    try {
      await useQuickReply(template.id);
      onSelect(template.content);
    } catch (error) {
      console.error('Error using template:', error);
    }
  };

  const handleEdit = (template) => {
    setFormData({
      title: template.title,
      content: template.content,
      shortcut: template.shortcut || '',
      category: template.category || 'general'
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6" />
              <h3 className="text-lg font-bold">Schnellantworten</h3>
            </div>
            <div className="flex items-center gap-2">
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                  title="Neue Vorlage"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="p-4 border-b border-slate-200 overflow-x-auto">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'Alle' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="p-4 border-b border-slate-200 bg-blue-50">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Titel"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <textarea
                  placeholder="Nachrichtentext"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Kürzel (z.B. /hi)"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="greeting">Greeting</option>
                  <option value="closing">Closing</option>
                  <option value="question">Question</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Aktualisieren' : 'Erstellen'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ title: '', content: '', shortcut: '', category: 'general' });
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Keine Vorlagen gefunden</p>
              <p className="text-sm mt-1">Erstelle eine neue Schnellantwort</p>
            </div>
          )}

          {!loading && filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-slate-50 hover:bg-blue-50 rounded-xl transition border border-slate-200 hover:border-blue-300 group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{template.title}</h4>
                    {template.shortcut && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                        {template.shortcut}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{template.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{template.usage_count || 0}x verwendet</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleSelect(template)}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    title="Verwenden"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickRepliesPanel;
