import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, MapPin, Calendar, Package, AlertCircle, Check, X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// BUILD: 2025-01-09T00:35:00Z - FORCE REBUILD WITH TEMPLATE_ID FIX
const WasteManagementNew = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [wasteItems, setWasteItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templateGroups, setTemplateGroups] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    quantity: '',
    unit: 'Stück',
    notes: ''
  });

  // Load categories and items
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[WASTE] Loading data...');
      const [categoriesRes, itemsRes, templatesRes] = await Promise.all([
        api.get('/waste-categories').then(res => {
          console.log('[WASTE] Categories response:', res);
          return res;
        }).catch(err => {
          console.error('[WASTE] Categories error:', err);
          console.error('[WASTE] Categories error response:', err.response);
          throw err;
        }),
        api.get('/waste/items').catch(err => {
          console.error('[WASTE] Items error:', err);
          return { data: [] };
        }),
        api.get('/waste/templates').catch(err => {
          console.error('[WASTE] Templates error:', err);
          return { data: [] };
        })
      ]);

      const normalizeItems = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (payload && (Array.isArray(payload.active) || Array.isArray(payload.history))) {
          return [
            ...(Array.isArray(payload.active) ? payload.active : []),
            ...(Array.isArray(payload.history) ? payload.history : [])
          ];
        }
        return [];
      };

      // Process templates
      const templates = Array.isArray(templatesRes.data) ? templatesRes.data : [];
      const groupedTemplates = templates.reduce((map, tpl) => {
        const key = (tpl.category || tpl.name || '').toLowerCase();
        if (!key) return map;
        if (!map[key]) map[key] = [];
        map[key].push(tpl);
        return map;
      }, {});

      const templateCategories = templates.reduce((acc, tpl) => {
            const key = (tpl.category || tpl.name || '').toLowerCase();
            if (!key || acc.find((entry) => entry._key === key)) {
              return acc;
            }
            acc.push({
              id: tpl.id || `template-${key}`,
              name: tpl.category || tpl.name || 'Abfall',
              description: tpl.description || tpl.safety_instructions || 'Vorlage aus Abfalltypen',
              color: tpl.color || '#3B82F6',
              icon: tpl.icon || '♻️',
              instructions: tpl.instructions || tpl.safety_instructions || '',
              templateId: tpl.id || null,
              _key: key
            });
            return acc;
          }, []);

      const cats = Array.isArray(categoriesRes.data) && categoriesRes.data.length > 0
        ? categoriesRes.data
        : templateCategories;
      const items = normalizeItems(itemsRes.data);

      console.log('Loaded categories:', cats.length);
      console.log('Loaded items:', items.length);

      const categoriesWithTemplates = cats.map((cat) => {
        const key = (cat.name || '').toLowerCase();
        const templateMatch = key ? groupedTemplates[key]?.[0] : null;
        const resolvedTemplateId =
          cat.template_id ||
          cat.templateId ||
          templateMatch?.id ||
          null;

        return {
          ...cat,
          template_id: resolvedTemplateId,
          templateId: resolvedTemplateId,
          icon: cat.icon || templateMatch?.icon || '♻️',
          color: cat.color || templateMatch?.color || '#3B82F6',
          description: cat.description || templateMatch?.description || cat.instructions || '',
          instructions: cat.instructions || templateMatch?.instructions || ''
        };
      });

      setCategories(categoriesWithTemplates);
      setWasteItems(items);
      setTemplateGroups(groupedTemplates);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowCreateModal(true);
    setFormData({
      name: '',
      location: '',
      quantity: '',
      unit: 'Stück',
      notes: ''
    });
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!selectedCategory) return;

    let templateId = selectedCategory.templateId || selectedCategory.template_id;

    if (!templateId) {
      const normalizedName = selectedCategory.name?.toLowerCase().trim();
      const localTemplates = normalizedName ? templateGroups[normalizedName] : null;
      if (localTemplates?.length) {
        templateId = localTemplates[0].id;
      } else if (normalizedName) {
        try {
          const fallbackRes = await api.get(`/waste/templates/category/${encodeURIComponent(selectedCategory.name)}`);
          if (Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
            templateId = fallbackRes.data[0].id;
          }
        } catch (fetchErr) {
          console.error('[CREATE-ITEM] Failed to fetch template by category', fetchErr);
        }
      }
    }

    if (!templateId) {
      console.error('[CREATE-ITEM] Missing template_id for category even after fallback', selectedCategory);
      toast.error('Keine passende Vorlage für diese Kategorie gefunden');
      return;
    }

    try {
      console.log('[CREATE-ITEM] Sending:', {
        template_id: templateId,
        name: formData.name?.trim() || selectedCategory.name,
        location: formData.location?.trim() || null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit,
        notes: formData.notes?.trim() || null
      });

      await api.post('/waste/items', {
        template_id: templateId,
        name: formData.name?.trim() || selectedCategory.name,
        location: formData.location?.trim() || null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit,
        notes: formData.notes?.trim() || null,
        status: 'active'
      });

      toast.success('Abfall erfolgreich hinzugefügt');
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      console.error('[CREATE-ITEM] Error:', error);
      console.error('[CREATE-ITEM] Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Abfall wirklich löschen?')) return;

    try {
      await api.delete(`/waste/items/${itemId}`);
      toast.success('Abfall gelöscht');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleMarkDisposed = async (itemId) => {
    try {
      await api.put(`/waste/items/${itemId}`, {
        status: 'disposed',
        last_disposal_date: new Date().toISOString()
      });
      toast.success('Als entsorgt markiert');
      loadData();
    } catch (error) {
      console.error('Error marking disposed:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Trash2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Lädt Abfallverwaltung...</p>
        </div>
      </div>
    );
  }

  const activeItems = wasteItems.filter(item => item.status === 'active');
  const disposedItems = wasteItems.filter(item => item.status === 'disposed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Trash2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Entsorgungsverwaltung</h1>
              <p className="text-gray-600 mt-1">Wählen Sie eine Abfallkategorie zum Hinzufügen</p>
            </div>
          </div>
        </div>

        {/* Category Tiles */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Abfallkategorien</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {categories.map((category) => {
              const itemCount = activeItems.filter(item =>
                item.category?.toLowerCase() === category.name?.toLowerCase()
              ).length;

              const categoryColor = category.color || '#3B82F6';
              const categoryIcon = category.icon || '♻️';

              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${categoryColor}15 0%, ${categoryColor}30 100%)`,
                    borderLeft: `4px solid ${categoryColor}`
                  }}
                >
                  {/* Icon */}
                  <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">
                    {categoryIcon}
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-lg text-gray-900 mb-1">
                    {category.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {category.description}
                  </p>

                  {/* Count badge */}
                  {itemCount > 0 && (
                    <div className="absolute top-3 right-3">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shadow-lg"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {itemCount}
                      </span>
                    </div>
                  )}

                  {/* Add icon */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus
                      className="w-6 h-6 text-white p-1 rounded-full shadow-lg"
                      style={{ backgroundColor: categoryColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Items */}
        {activeItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Aktive Abfälle ({activeItems.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map((item) => {
                const category = categories.find(c =>
                  c.name?.toLowerCase() === item.category?.toLowerCase()
                );

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{category?.icon || '📦'}</span>
                        <div>
                          <h3 className="font-bold text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-500">{item.category}</p>
                        </div>
                      </div>
                    </div>

                    {item.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4" />
                        {item.location}
                      </div>
                    )}

                    {item.quantity && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Package className="w-4 h-4" />
                        {item.quantity} {item.unit}
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleMarkDisposed(item.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                      >
                        <Check className="w-4 h-4" />
                        Entsorgt
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Disposed Items */}
        {disposedItems.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Entsorgt ({disposedItems.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {disposedItems.map((item) => {
                const category = categories.find(c =>
                  c.name?.toLowerCase() === item.category?.toLowerCase()
                );

                return (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-200 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl grayscale">{category?.icon || '📦'}</span>
                        <div>
                          <h3 className="font-bold text-gray-700">{item.name}</h3>
                          <p className="text-sm text-gray-500">{item.category}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                        Entsorgt
                      </span>
                    </div>

                    {item.last_disposal_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(item.last_disposal_date), 'dd.MM.yyyy', { locale: de })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && selectedCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-5xl">{selectedCategory.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCategory.name}</h2>
                  <p className="text-gray-600">Neuen Abfall hinzufügen</p>
                </div>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name / Beschreibung *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`z.B. ${selectedCategory.name} Labor 3`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Standort
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. Lager Raum 204"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Menge
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Einheit
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Stück">Stück</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notizen
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="3"
                    placeholder="Zusätzliche Informationen..."
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold shadow-lg"
                    style={{ backgroundColor: selectedCategory.color }}
                  >
                    Hinzufügen
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

export default WasteManagementNew;
