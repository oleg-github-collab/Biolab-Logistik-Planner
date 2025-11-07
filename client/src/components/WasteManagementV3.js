import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import api from '../utils/api';
import { showError, showSuccess } from '../utils/toast';
import { useWebSocketContext } from '../context/WebSocketContext';
import { getAssetUrl } from '../utils/media';
import {
  Leaf,
  PlusCircle,
  MapPin,
  Hash,
  Upload,
  X,
  Loader2,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
  ArrowUpRight,
  Image as ImageIcon,
  Mic,
  Clock,
  User,
  UserCheck,
  CheckCircle2,
  Trash2,
  Filter,
  Search,
  GripVertical,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

const WasteManagementV3 = () => {
  const navigate = useNavigate();
  const { onTaskEvent } = useWebSocketContext();

  const [categories, setCategories] = useState([]);
  const [activeItems, setActiveItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const enrichItems = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      ...item,
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map((attachment) => ({
            ...attachment,
            url: getAssetUrl(attachment.url)
          }))
        : []
    }));
  }, []);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const [templatesResponse, itemsResponse] = await Promise.all([
        api.get('/waste/templates'),
        api.get('/waste/items')
      ]);

      const templates = templatesResponse?.data || [];
      const payload = itemsResponse?.data;

      setCategories(templates);

      if (Array.isArray(payload)) {
        setActiveItems(enrichItems(payload));
        setHistoryItems([]);
      } else {
        setActiveItems(enrichItems(payload?.active));
        setHistoryItems(enrichItems(payload?.history));
      }
    } catch (error) {
      console.error('Error loading waste data:', error);
      showError('Fehler beim Laden der Abfalldaten');
      setCategories([]);
      setActiveItems([]);
      setHistoryItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [enrichItems]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const response = await api.get('/users');
      setUsers(response?.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Fehler beim Laden der Benutzerliste');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadUsers();
  }, [loadData, loadUsers]);

  useEffect(() => {
    if (!onTaskEvent) {
      return undefined;
    }

    const cleanupFns = [];

    const handleTaskChange = (data) => {
      const task = data?.task || data;
      if (!task || task.category !== 'waste') {
        return;
      }

      const relevantStatuses = ['done', 'todo', 'in_progress', 'backlog'];
      if (relevantStatuses.includes(task.status)) {
        loadData({ silent: true });
      }
    };

    const handleTaskDeleted = (data) => {
      const deletedTaskId = data?.taskId || data?.task?.id;
      if (!deletedTaskId) {
        return;
      }
      setActiveItems((prev) => prev.filter((item) => item.kanban_task_id !== deletedTaskId));
      setHistoryItems((prev) => prev.filter((item) => item.kanban_task_id !== deletedTaskId));
    };

    cleanupFns.push(onTaskEvent('task:created', handleTaskChange));
    cleanupFns.push(onTaskEvent('task:updated', handleTaskChange));
    cleanupFns.push(onTaskEvent('task:deleted', handleTaskDeleted));

    return () => {
      cleanupFns.forEach((cleanup) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [onTaskEvent, loadData]);

  const resetForm = () => {
    setQuantity('');
    setLocation('');
    setNotes('');
    setNextDate('');
    setAttachments([]);
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    resetForm();
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('context', 'task');

    try {
      setUploading(true);
      const response = await api.post('/uploads/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = response.data?.files || [];
      if (!uploaded.length) {
        showError('Keine Dateien hochgeladen');
        return;
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      showSuccess(`${uploaded.length} Datei(en) hinzugefügt`);
    } catch (error) {
      console.error('Upload error:', error);
      showError('Fehler beim Hochladen');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCategory) {
      showError('Bitte zuerst eine Kategorie auswählen');
      return;
    }

    try {
      setSaving(true);

      const generatedNameParts = [
        selectedCategory.name,
        quantity ? `${quantity} ${selectedCategory.default_unit || 'Stück'}` : null,
        location ? `@ ${location}` : null
      ].filter(Boolean);
      const generatedName = generatedNameParts.join(' ');

      const payload = {
        template_id: selectedCategory.id,
        name: generatedName || selectedCategory.name,
        location,
        quantity,
        unit: selectedCategory.default_unit || 'Stück',
        next_disposal_date: nextDate || null,
        notes,
        attachments
      };

      const response = await api.post('/waste/items', payload);
      const createdItem = response?.data;
      if (createdItem) {
        const [normalizedCreated] = enrichItems([createdItem]);
        setActiveItems((prev) => [normalizedCreated, ...prev]);
      }

      showSuccess('Abfallposten erfasst & Kanban-Aufgabe erstellt');
      resetForm();
      await loadData({ silent: true });
    } catch (error) {
      console.error('Error creating waste item:', error);
      const message = error?.response?.data?.error || 'Fehler beim Erstellen';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToUser = async (userId) => {
    if (!selectedItemForAction) return;

    const itemId = selectedItemForAction.id;
    setActionLoading((prev) => ({ ...prev, [itemId]: true }));

    try {
      await api.put(`/waste/items/${itemId}`, { assigned_to: userId });
      showSuccess('Benutzer zugewiesen');
      setAssignModalOpen(false);
      setSelectedItemForAction(null);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Error assigning user:', error);
      showError('Fehler beim Zuweisen');
    } finally {
      setActionLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleMarkAsDisposed = async (item) => {
    const itemId = item.id;
    setActionLoading((prev) => ({ ...prev, [itemId]: true }));

    try {
      await api.put(`/waste/items/${itemId}`, { status: 'disposed' });
      showSuccess('Als erledigt markiert');
      setActiveItems((prev) => prev.filter((i) => i.id !== itemId));
      await loadData({ silent: true });
    } catch (error) {
      console.error('Error marking as disposed:', error);
      showError('Fehler beim Erledigen');
    } finally {
      setActionLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItemForAction) return;

    const itemId = selectedItemForAction.id;
    setActionLoading((prev) => ({ ...prev, [itemId]: true }));

    try {
      await api.delete(`/waste/items/${itemId}`);
      showSuccess('Abfallposten gelöscht');
      setDeleteConfirmOpen(false);
      setSelectedItemForAction(null);
      setActiveItems((prev) => prev.filter((i) => i.id !== itemId));
      await loadData({ silent: true });
    } catch (error) {
      console.error('Error deleting item:', error);
      showError('Fehler beim Löschen');
    } finally {
      setActionLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(filteredActiveItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setActiveItems(items);

    try {
      const orderUpdates = items.map((item, index) => ({
        id: item.id,
        priority: index
      }));

      await api.put('/waste/items/reorder', { items: orderUpdates });
      showSuccess('Reihenfolge gespeichert');
    } catch (error) {
      console.error('Error saving order:', error);
      showError('Fehler beim Speichern der Reihenfolge');
      await loadData({ silent: true });
    }
  };

  const getFilteredItemsByDate = useCallback((items) => {
    if (dateFilter === 'all') return items;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return items.filter((item) => {
      if (!item.next_disposal_date) return false;

      const itemDate = new Date(item.next_disposal_date);
      const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      switch (dateFilter) {
        case 'today': {
          return itemDateOnly.getTime() === today.getTime();
        }
        case 'week': {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          return itemDateOnly >= today && itemDateOnly <= weekEnd;
        }
        case 'month': {
          const monthEnd = new Date(today);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          return itemDateOnly >= today && itemDateOnly <= monthEnd;
        }
        default:
          return true;
      }
    });
  }, [dateFilter]);

  const filteredActiveItems = useMemo(() => {
    let items = [...activeItems];

    if (categoryFilter !== 'all') {
      items = items.filter((item) => item.template_id === parseInt(categoryFilter, 10));
    }

    if (statusFilter === 'active') {
      items = items.filter((item) => item.status !== 'disposed');
    } else if (statusFilter === 'disposed') {
      items = items.filter((item) => item.status === 'disposed');
    }

    items = getFilteredItemsByDate(items);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          (item.name || '').toLowerCase().includes(query) ||
          (item.location || '').toLowerCase().includes(query) ||
          (item.template_name || '').toLowerCase().includes(query)
      );
    }

    return items;
  }, [activeItems, categoryFilter, statusFilter, searchQuery, getFilteredItemsByDate]);

  const getUserById = (userId) => {
    return users.find((u) => u.id === userId);
  };

  const activeCategories = useMemo(() => categories, [categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <section className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 sm:p-8 space-y-6">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                <Leaf className="w-4 h-4" />
                Abfallmanagement V3
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                Schnellerfassung & Nachverfolgung
              </h1>
              <p className="text-slate-500 max-w-2xl">
                Wähle eine Kategorie, erfasse Menge & Ort, füge Belege hinzu – der Rest landet automatisch im Kanban und verschwindet nach Abschluss.
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Aktualisieren
            </button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Kategorie wählen
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activeCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelectCategory(category)}
                    className={`p-4 text-left rounded-2xl border transition ${
                      selectedCategory?.id === category.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{category.icon || '♻️'}</span>
                      <div>
                        <p className="font-semibold text-slate-900">{category.name}</p>
                        <p className="text-xs text-slate-500">
                          {category.hazard_level ? category.hazard_level.toUpperCase() : 'Standard'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{category.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Heute fällig
              </h3>
              <p className="text-sm text-slate-200">
                Diese Kategorien sollten laut Plan innerhalb der nächsten Tage entsorgt werden.
              </p>
              <ul className="space-y-2">
                {activeItems.slice(0, 5).map((item) => (
                  <li
                    key={`timeline-${item.id}`}
                    className="flex items-center justify-between text-sm bg-white/10 rounded-xl px-3 py-2"
                  >
                    <span className="font-semibold truncate">{item.template_name || item.name}</span>
                    <span className="text-xs text-slate-200 flex items-center gap-1 ml-2">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {item.next_disposal_date
                        ? new Date(item.next_disposal_date).toLocaleDateString('de-DE')
                        : 'sofort'}
                    </span>
                  </li>
                ))}
                {activeItems.length === 0 && (
                  <li className="text-xs text-slate-300">Keine offenen Einträge.</li>
                )}
              </ul>
            </div>
          </div>

          {selectedCategory ? (
            <form onSubmit={handleSubmit} className="bg-slate-50 rounded-3xl border border-slate-200 p-5 space-y-5">
              <header className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow">
                  {selectedCategory.icon || '♻️'}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedCategory.name}</h3>
                  <p className="text-sm text-slate-600">
                    {selectedCategory.description ||
                      'Erfasse die Details und füge optional Nachweise hinzu.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-600" />
                    Menge
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="z. B. 5"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Standort
                  </span>
                  <input
                    type="text"
                    placeholder="Lagerraum, Regal, etc."
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    Spätestens entsorgen bis
                  </span>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(event) => setNextDate(event.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  Hinweise
                </span>
                <textarea
                  rows="4"
                  placeholder="Spezifische Informationen zur Entsorgung, Ansprechpartner, etc."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition resize-none"
                />
              </label>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 inline-flex items-center gap-2 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 transition">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">
                      {uploading ? 'Lade hoch...' : 'Foto oder Audio anhängen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,audio/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  {attachments.length > 0 && (
                    <span className="text-xs text-slate-500">{attachments.length} Datei(en) angehängt</span>
                  )}
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((file, index) => (
                      <div
                        key={`${file.id || file.url}-${index}`}
                        className="relative bg-white border border-slate-200 rounded-xl p-3 shadow-sm w-40"
                      >
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {file.type === 'image' ? (
                          <img
                            src={getAssetUrl(file.url)}
                            alt={file.name || 'Anhang'}
                            className="h-28 w-full object-cover rounded-lg"
                          />
                        ) : file.type === 'audio' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Mic className="w-4 h-4 text-blue-600" />
                              {file.name || 'Audio'}
                            </div>
                            <audio controls src={file.url} className="w-full" />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                            <ImageIcon className="w-5 h-5 text-blue-600" />
                            <span className="truncate w-full text-center">{file.name || 'Datei'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-5 h-5" />
                    Abfallposten erfassen
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Wähle links eine Kategorie aus, um einen neuen Eintrag zu erstellen.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Offene Abfallposten ({filteredActiveItems.length})
            </h2>
          </header>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="w-4 h-4 text-blue-600" />
              Filter & Suche
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Kategorie</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition text-sm"
                >
                  <option value="all">Alle Kategorien</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Zeitraum</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition text-sm"
                >
                  <option value="all">Alle</option>
                  <option value="today">Heute</option>
                  <option value="week">Diese Woche</option>
                  <option value="month">Dieser Monat</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition text-sm"
                >
                  <option value="active">Aktiv</option>
                  <option value="disposed">Erledigt</option>
                  <option value="all">Alle</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Suche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Name, Ort..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {filteredActiveItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              {activeItems.length === 0 ? 'Keine offenen Posten. Alles erledigt!' : 'Keine Ergebnisse für die gewählten Filter.'}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="waste-items">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`grid grid-cols-1 gap-4 transition-colors ${
                      snapshot.isDraggingOver ? 'bg-blue-50 rounded-2xl p-2' : ''
                    }`}
                  >
                    {filteredActiveItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white rounded-2xl border border-slate-200 shadow-sm transition-shadow ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:shadow-md'
                            }`}
                          >
                            <div className="p-5 space-y-4">
                              <div className="flex items-start gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="mt-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs uppercase tracking-wide text-slate-400">
                                        {item.template_name || 'Unbekannt'}
                                      </p>
                                      <h3 className="text-lg font-semibold text-slate-900 truncate">
                                        {item.name}
                                      </h3>
                                      {item.location && (
                                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                          <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                          {item.location}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                      {item.quantity ? `${item.quantity} ${item.unit || ''}` : 'Erfasst'}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4 text-blue-500" />
                                      {item.next_disposal_date
                                        ? new Date(item.next_disposal_date).toLocaleDateString('de-DE')
                                        : 'keine Frist'}
                                    </span>
                                    {item.task_priority && (
                                      <span className="uppercase font-semibold text-orange-600">
                                        {item.task_priority}
                                      </span>
                                    )}
                                    {item.assigned_to && (
                                      <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                        <UserCheck className="w-3 h-3" />
                                        {getUserById(item.assigned_to)?.username || 'Zugewiesen'}
                                      </span>
                                    )}
                                  </div>

                                  {item.notes && (
                                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 mt-3">
                                      {item.notes}
                                    </p>
                                  )}

                                  {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {item.attachments.map((att) => (
                                        <a
                                          key={att.id}
                                          href={getAssetUrl(att.url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 transition"
                                        >
                                          {att.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                                          {att.type === 'audio' && <Mic className="w-4 h-4 text-blue-500" />}
                                          <span className="truncate max-w-[100px]">{att.name || att.url.split('/').pop()}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedItemForAction(item);
                                        setAssignModalOpen(true);
                                      }}
                                      disabled={actionLoading[item.id]}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                      {actionLoading[item.id] ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <User className="w-4 h-4" />
                                      )}
                                      Zuweisen
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleMarkAsDisposed(item)}
                                      disabled={actionLoading[item.id]}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                                    >
                                      {actionLoading[item.id] ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                      )}
                                      Erledigen
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedItemForAction(item);
                                        setDeleteConfirmOpen(true);
                                      }}
                                      disabled={actionLoading[item.id]}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
                                    >
                                      {actionLoading[item.id] ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                      Löschen
                                    </button>

                                    {item.kanban_task_id && (
                                      <button
                                        type="button"
                                        onClick={() => navigate('/task-pool', { state: { highlightTask: item.kanban_task_id } })}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition"
                                      >
                                        Kanban öffnen
                                        <ArrowUpRight className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </section>

        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Historie</h2>
            <span className="text-xs text-slate-500">
              Zuletzt erledigt: {historyItems.length}
            </span>
          </header>
          {historyItems.length === 0 ? (
            <div className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-6">
              Keine erledigten Abfallposten.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {historyItems.slice(0, 6).map((item) => (
                <div key={`history-${item.id}`} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {item.template_name || 'Kategorie'}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-800 mt-1">{item.name}</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    Erledigt am{' '}
                    {item.last_disposal_date
                      ? new Date(item.last_disposal_date).toLocaleDateString('de-DE')
                      : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <header className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Benutzer zuweisen</h3>
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setSelectedItemForAction(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Keine Benutzer verfügbar</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAssignToUser(user.id)}
                    disabled={actionLoading[selectedItemForAction?.id]}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                      {user.username ? user.username[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-900">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    {selectedItemForAction?.assigned_to === user.id && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <header className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900">Abfallposten löschen?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Möchten Sie "{selectedItemForAction?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </header>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setSelectedItemForAction(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={actionLoading[selectedItemForAction?.id]}
                className="flex-1 px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading[selectedItemForAction?.id] ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird gelöscht...
                  </>
                ) : (
                  'Löschen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

WasteManagementV3.propTypes = {
  initialFilters: PropTypes.shape({
    category: PropTypes.string,
    date: PropTypes.string,
    status: PropTypes.string
  })
};

WasteManagementV3.defaultProps = {
  initialFilters: null
};

export default WasteManagementV3;
