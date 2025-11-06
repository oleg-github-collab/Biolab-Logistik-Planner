import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Clock
} from 'lucide-react';

const WasteManagementV2 = () => {
  const navigate = useNavigate();
  const { onTaskEvent } = useWebSocketContext();

  const [categories, setCategories] = useState([]);
  const [activeItems, setActiveItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const activeCategories = useMemo(() => categories, [categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
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
                Abfallmanagement
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition"
            >
              <Loader2 className="w-4 h-4 animate-spin mr-1 hidden" />
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
                    <span className="font-semibold">{item.template_name || item.name}</span>
                    <span className="text-xs text-slate-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
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
                          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
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
                            <span>{file.name || 'Datei'}</span>
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
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Offene Abfallposten ({activeItems.length})
            </h2>
          </header>

          {activeItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Keine offenen Posten. Alles erledigt!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {item.template_name || 'Unbekannt'}
                      </p>
                      <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                      {item.location && (
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          {item.location}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {item.quantity ? `${item.quantity} ${item.unit || ''}` : 'Erfasst'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-blue-500" />
                      {item.next_disposal_date
                        ? new Date(item.next_disposal_date).toLocaleDateString('de-DE')
                        : 'keine Frist'}
                    </span>
                    {item.task_priority && (
                      <span className="uppercase font-semibold text-orange-600">
                        {item.task_priority}
                      </span>
                    )}
                  </div>

                    {item.notes && (
                      <p className="text-sm text-slate-600 bg-slate-100 rounded-xl px-3 py-2">
                        {item.notes}
                      </p>
                    )}

                  {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={getAssetUrl(att.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          {att.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                          {att.type === 'audio' && <Mic className="w-4 h-4 text-blue-500" />}
                          <span>{att.name || att.url.split('/').pop()}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {item.kanban_task_id && (
                      <button
                        type="button"
                        onClick={() => navigate('/task-pool', { state: { highlightTask: item.kanban_task_id } })}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Kanban öffnen
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
            <div className="text-sm text-slate-500">
              Keine erledigten Abfallposten.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {historyItems.slice(0, 6).map((item) => (
                <div key={`history-${item.id}`} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {item.template_name || 'Kategorie'}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-800">{item.name}</h3>
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
    </div>
  );
};

export default WasteManagementV2;
