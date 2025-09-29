import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import AdvancedCalendar from '../components/AdvancedCalendar';
import EventDetailsPanel from '../components/EventDetailsPanel';
import KanbanBoard from '../components/KanbanBoard';
import WasteTemplateManager from '../components/WasteTemplateManager';
import { 
  getCurrentWeek, 
  getMySchedule, 
  getTeamSchedule,
  getArchivedSchedules,
  createWasteItem,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
} from '../utils/api';
import { format, addDays, addMinutes, parseISO, startOfWeek, endOfWeek, formatISO } from 'date-fns';

const EVENT_COLOR_MAP = {
  Arbeit: '#0EA5E9',
  Meeting: '#6366F1',
  Urlaub: '#F97316',
  Krankheit: '#EF4444',
  Training: '#10B981',
  Projekt: '#8B5CF6',
  Termin: '#06B6D4',
  Deadline: '#DC2626',
  Personal: '#84CC16',
  default: '#475569'
};

const getEventColor = (type = 'Arbeit') => EVENT_COLOR_MAP[type] || EVENT_COLOR_MAP.default;

const parseDbDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const isoLike = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(isoLike);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const safeParseJson = (value, fallback = []) => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

const mapApiEventToUi = (event) => {
  const start = parseDbDateTime(event.start_date) ?? new Date();
  const end = parseDbDateTime(event.end_date) ?? addMinutes(start, event.duration ?? 60);
  const allDay = Boolean(event.is_all_day) || !event.start_time;
  const type = event.type || 'Termin';

  return {
    id: event.id,
    title: event.title,
    description: event.description || '',
    start,
    end,
    start_date: format(start, 'yyyy-MM-dd'),
    end_date: format(end, 'yyyy-MM-dd'),
    start_time: allDay ? '' : (event.start_time || format(start, 'HH:mm')),
    end_time: allDay ? '' : (event.end_time || format(end, 'HH:mm')),
    all_day: allDay,
    type,
    priority: event.priority || 'medium',
    location: event.location || '',
    attendees: event.attendees
      ? event.attendees.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [],
    reminder: event.reminder ?? 15,
    status: event.status || 'confirmed',
    color: event.color || getEventColor(type),
    notes: event.notes || '',
    category: event.category || 'work',
    recurring: Boolean(event.is_recurring),
    recurring_pattern: event.recurrence_pattern || 'weekly',
    recurring_end: event.recurrence_end_date ? format(parseDbDateTime(event.recurrence_end_date), 'yyyy-MM-dd') : '',
    tags: safeParseJson(event.tags),
    raw: event
  };
};

const combineDateAndTime = (dateStr, timeStr, allDay = false) => {
  if (!dateStr) return null;
  if (allDay || !timeStr) {
    return new Date(`${dateStr}T00:00:00`);
  }
  return new Date(`${dateStr}T${timeStr}`);
};

const buildEventPayload = (event) => {
  const startDate = combineDateAndTime(event.start_date, event.start_time, event.all_day);
  const endDate = combineDateAndTime(event.end_date || event.start_date, event.end_time || event.start_time, event.all_day);

  return {
    title: event.title,
    description: event.description || '',
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    startTime: event.all_day ? null : (event.start_time || (startDate ? format(startDate, 'HH:mm') : null)),
    endTime: event.all_day ? null : (event.end_time || (endDate ? format(endDate, 'HH:mm') : null)),
    type: event.type || 'Termin',
    isAllDay: Boolean(event.all_day),
    isRecurring: Boolean(event.recurring),
    recurrencePattern: event.recurring ? event.recurring_pattern : null,
    recurrenceEndDate: event.recurring && event.recurring_end
      ? new Date(event.recurring_end).toISOString()
      : null,
    priority: event.priority || 'medium',
    location: event.location || '',
    attendees: Array.isArray(event.attendees) ? event.attendees.join(',') : (event.attendees || ''),
    reminder: event.reminder ?? 15,
    category: event.category || 'work'
  };
};

const EVENT_TYPES = [
  { value: null, label: 'Alle', chipClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { value: 'Arbeit', label: 'Arbeit', chipClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
  { value: 'Meeting', label: 'Meetings', chipClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
  { value: 'Urlaub', label: 'Urlaub', chipClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { value: 'Krankheit', label: 'Ausfälle', chipClass: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { value: 'Projekt', label: 'Projekt', chipClass: 'bg-violet-100 text-violet-700 hover:bg-violet-200' }
];

const PRIORITY_FILTERS = [
  { value: null, label: 'Alle', badgeClass: 'bg-slate-200 text-slate-700' },
  { value: 'low', label: '⏱️ Locker', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'medium', label: '⚡ Normal', badgeClass: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: '🔥 Hoch', badgeClass: 'bg-rose-100 text-rose-700' }
];

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className="fixed right-4 top-24 z-[1200] max-w-sm rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur" role="status">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
            toast.type === 'error'
              ? 'bg-rose-100 text-rose-600'
              : toast.type === 'success'
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-sky-100 text-sky-600'
          }`}
        >
          {toast.type === 'error' ? '!' : toast.type === 'success' ? '✓' : 'ℹ️'}
        </div>
        <div className="flex-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{toast.title}</p>
          {toast.message && <p className="mt-1 leading-relaxed">{toast.message}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition hover:text-slate-600"
          aria-label="Hinweis schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(null);
  const [mySchedule, setMySchedule] = useState([]);
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [archivedSchedules, setArchivedSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarView, setCalendarView] = useState('week');
  const [tasks, setTasks] = useState([]);
  const [wasteTemplates, setWasteTemplates] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventPanelMode, setEventPanelMode] = useState('view');
  const [showEventPanel, setShowEventPanel] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [eventTypeFilter, setEventTypeFilter] = useState(EVENT_TYPES[0].value);
  const [priorityFilter, setPriorityFilter] = useState(PRIORITY_FILTERS[0].value);
  const [eventRange, setEventRange] = useState(() => {
    const today = new Date();
    return {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
      view: 'week'
    };
  });

  const showToast = useCallback((payload) => {
    setToast({ id: Date.now(), ...payload });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const [weekRes, scheduleRes, teamRes, archivedRes] = await Promise.all([
        getCurrentWeek(),
        getMySchedule(),
        // FIX: Replaced invalid JavaScript syntax { [] } with a valid object { data: [] }
        ['admin', 'superadmin'].includes(user.role) ? getTeamSchedule() : Promise.resolve({ data: [] }),
        getArchivedSchedules()
      ]);
      
      setCurrentWeek(weekRes.data);
      setMySchedule(scheduleRes.data || []);
      setTeamSchedule(teamRes.data || []);
      setArchivedSchedules(archivedRes.data || []);
      
      setTasks([
        {
          id: 1,
          title: 'Wochenplanung abschließen',
          description: 'Stelle sicher, dass alle Arbeitszeiten für die kommende Woche eingetragen sind',
          status: 'todo',
          priority: 'high',
          assignee: user.name,
          dueDate: new Date(),
          tags: ['planung', 'dringend']
        },
        {
          id: 2,
          title: 'Abfallentsorgung planen',
          description: 'Überprüfe die nächsten Entsorgungstermine für alle Abfallarten',
          status: 'inprogress',
          priority: 'medium',
          assignee: user.name,
          dueDate: addDays(new Date(), 3),
          tags: ['abfall', 'logistik']
        }
      ]);
      
      setWasteTemplates([
        {
          id: 1,
          name: 'Bioabfall',
          description: 'Organische Abfälle aus Küche und Garten',
          disposalInstructions: 'Bioabfallbehälter alle 2 Wochen am Dienstag rausstellen.\nNicht erlaubt: Plastik, Metall, Glas.',
          color: '#A9D08E',
          icon: 'bio',
          defaultFrequency: 'biweekly',
          defaultNextDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
        },
        {
          id: 2,
          name: 'Papiermüll',
          description: 'Altpapier und Kartonagen',
          disposalInstructions: 'Papiertonnen monatlich am Freitag rausstellen.\nNicht erlaubt: verschmutztes Papier, Tapeten, Foto- und Faxpapier.',
          color: '#D9E1F2',
          icon: 'paper',
          defaultFrequency: 'monthly',
          defaultNextDate: format(addDays(new Date(), 14), 'yyyy-MM-dd')
        },
        {
          id: 3,
          name: 'Restmüll',
          description: 'Nicht-recyclebare Abfälle',
          disposalInstructions: 'Restmülltonnen wöchentlich am Montag rausstellen.\nNicht erlaubt: Wertstoffe, Elektroschrott, Sondermüll.',
          color: '#F4B084',
          icon: 'trash',
          defaultFrequency: 'weekly',
          defaultNextDate: format(new Date(), 'yyyy-MM-dd')
        }
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEventsLoading(true);
        const startParam = eventRange?.start ? formatISO(eventRange.start) : null;
        const endParam = eventRange?.end ? formatISO(eventRange.end) : null;
        const response = await getEvents(startParam, endParam, eventTypeFilter || undefined, priorityFilter || undefined);

        if (response?.status === 304) {
          return; // retain current events when upstream indicates no change
        }

        const payload = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

        setEvents(payload.map(mapApiEventToUi));
      } catch (err) {
        console.error('Error loading events:', err);
        showToast({ type: 'error', title: 'Termine konnten nicht geladen werden', message: 'Bitte überprüfe deine Verbindung und versuche es erneut.' });
      } finally {
        setEventsLoading(false);
      }
    };

    fetchEvents();
  }, [eventRange?.start, eventRange?.end, eventTypeFilter, priorityFilter, showToast]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event, mode = 'view') => {
    setSelectedEvent(event);
    setEventPanelMode(mode);
    setShowEventPanel(true);
  };

  const handleEventSave = async (eventData) => {
    if (!eventData?.title?.trim()) {
      showToast({ type: 'error', title: 'Titel fehlt', message: 'Bitte gib einen aussagekräftigen Titel für den Termin an.' });
      return;
    }

    try {
      if (eventPanelMode === 'create') {
        const response = await createEvent(buildEventPayload(eventData));
        setEvents((prev) => [...prev, mapApiEventToUi(response.data)]);
        showToast({ type: 'success', title: 'Termin erstellt', message: `${eventData.title} wurde hinzugefügt.` });
      } else {
        const response = await updateEvent(eventData.id, buildEventPayload(eventData));
        setEvents((prev) => prev.map((event) => (event.id === eventData.id ? mapApiEventToUi(response.data) : event)));
        showToast({ type: 'success', title: 'Termin aktualisiert' });
      }
      setShowEventPanel(false);
    } catch (err) {
      console.error('Error saving event:', err);
      showToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Der Termin konnte nicht gespeichert werden.' });
    }
  };

  const handleEventDelete = async (eventId) => {
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      showToast({ type: 'success', title: 'Termin gelöscht' });
      setShowEventPanel(false);
    } catch (err) {
      console.error('Error deleting event:', err);
      showToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Bitte versuche es in ein paar Sekunden erneut.' });
    }
  };

  const handleEventDuplicate = async (eventData) => {
    try {
      const start = combineDateAndTime(eventData.start_date, eventData.start_time, eventData.all_day) ?? new Date();
      const end = combineDateAndTime(eventData.end_date || eventData.start_date, eventData.end_time || eventData.start_time, eventData.all_day) ?? addMinutes(start, 60);
      const duplicateStart = addDays(start, 1);
      const duplicateEnd = addDays(end, 1);
      const payload = buildEventPayload({
        ...eventData,
        title: `${eventData.title || 'Termin'} (Kopie)`,
        start_date: format(duplicateStart, 'yyyy-MM-dd'),
        end_date: format(duplicateEnd, 'yyyy-MM-dd'),
        start_time: eventData.all_day ? '' : format(duplicateStart, 'HH:mm'),
        end_time: eventData.all_day ? '' : format(duplicateEnd, 'HH:mm')
      });
      const response = await createEvent(payload);
      setEvents((prev) => [...prev, mapApiEventToUi(response.data)]);
      showToast({ type: 'success', title: 'Termin dupliziert', message: `${eventData.title} wurde auf den Folgetag kopiert.` });
      setShowEventPanel(false);
    } catch (err) {
      console.error('Error duplicating event:', err);
      showToast({ type: 'error', title: 'Duplizieren fehlgeschlagen' });
    }
  };

  const handleCreateNewEvent = (defaults = {}) => {
    const start = defaults.start ? new Date(defaults.start) : new Date();
    const end = defaults.end ? new Date(defaults.end) : addMinutes(start, 60);

    setSelectedEvent({
      title: defaults.title || '',
      description: defaults.description || '',
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
      start_time: defaults.all_day ? '' : format(start, 'HH:mm'),
      end_time: defaults.all_day ? '' : format(end, 'HH:mm'),
      all_day: Boolean(defaults.all_day),
      type: defaults.type || 'Termin',
      priority: defaults.priority || 'medium',
      attendees: defaults.attendees || [],
      reminder: defaults.reminder ?? 15,
      status: defaults.status || 'confirmed',
      color: getEventColor(defaults.type || 'Termin'),
      tags: defaults.tags || [],
      location: defaults.location || ''
    });
    setEventPanelMode('create');
    setShowEventPanel(true);
  };

  const handleCalendarEventCreate = async (details = {}) => {
    if (details.title) {
      try {
        const start = details.start ? new Date(details.start) : new Date();
        const end = details.end ? new Date(details.end) : addMinutes(start, 60);
        const draft = {
          title: details.title,
          description: details.description || '',
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
          start_time: details.all_day ? '' : format(start, 'HH:mm'),
          end_time: details.all_day ? '' : format(end, 'HH:mm'),
          all_day: Boolean(details.all_day),
          type: details.type || 'Termin',
          priority: details.priority || 'medium',
          attendees: details.attendees || [],
          reminder: details.reminder ?? 15,
          status: 'confirmed',
          category: details.category || 'work'
        };

        const response = await createEvent(buildEventPayload(draft));
        setEvents((prev) => [...prev, mapApiEventToUi(response.data)]);
        showToast({ type: 'success', title: 'Termin erstellt', message: `${draft.title} wurde hinzugefügt.` });
      } catch (err) {
        console.error('Error creating event:', err);
        showToast({ type: 'error', title: 'Erstellen fehlgeschlagen', message: 'Ein neuer Termin konnte nicht angelegt werden.' });
      }
      return;
    }

    handleCreateNewEvent(details);
  };

  const handleTaskUpdate = (taskId, updates) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const handleTaskCreate = (newTask) => {
    setTasks(prev => [...prev, { ...newTask, id: Date.now() }]);
  };

  const handleTaskDelete = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleRangeChange = (range) => {
    if (!range) return;

    const normaliseDate = (value) => {
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    };

    const sameTimestamp = (a, b) => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return a.getTime() === b.getTime();
    };

    const nextStart = normaliseDate(range.start);
    const nextEnd = normaliseDate(range.end);
    const nextView = range.view || calendarView;

    setEventRange((prev) => {
      const sameStart = sameTimestamp(prev?.start, nextStart);
      const sameEnd = sameTimestamp(prev?.end, nextEnd);
      const sameView = (prev?.view || calendarView) === nextView;

      if (sameStart && sameEnd && sameView) {
        return prev;
      }

      return {
        start: nextStart,
        end: nextEnd,
        view: nextView
      };
    });

    if (range.view && range.view !== calendarView) {
      setCalendarView(range.view);
    }

    if (nextStart) {
      setSelectedDate((prev) => (sameTimestamp(prev, nextStart) ? prev : nextStart));
    }
  };

  const handleTypeFilterChange = (value) => {
    setEventTypeFilter(value);
  };

  const handlePriorityFilterChange = (value) => {
    setPriorityFilter(value);
  };

  const activeType = useMemo(() => EVENT_TYPES.find((type) => type.value === eventTypeFilter), [eventTypeFilter]);
  const activePriority = useMemo(() => PRIORITY_FILTERS.find((priority) => priority.value === priorityFilter), [priorityFilter]);

  const handleTemplateCreate = (newTemplate) => {
    setWasteTemplates(prev => [...prev, { ...newTemplate, id: Date.now() }]);
  };

  const handleTemplateUpdate = (updatedTemplate) => {
    setWasteTemplates(prev => 
      prev.map(template => 
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    );
  };

  const handleTemplateDelete = (templateId) => {
    setWasteTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  const handleTemplateApply = async (template) => {
    try {
      // Create waste item from template
      await createWasteItem(
        template.name,
        template.description,
        template.disposalInstructions,
        template.defaultNextDate
      );
      
      // Show success message
      alert(`Vorlage "${template.name}" erfolgreich angewendet!`);
    } catch (err) {
      console.error('Error applying template:', err);
      setError('Fehler beim Anwenden der Vorlage.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="mt-4 text-gray-600">Daten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600">
          Willkommen zurück, {user.name}! Hier ist dein Überblick für heute.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Kalender
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'kanban'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setActiveTab('waste-templates')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'waste-templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Abfall-Vorlagen
          </button>
        </nav>
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Fortgeschrittener Kalender</h2>
              <p className="text-sm text-slate-500">
                Plane Schichten, Termine und Einsätze mit einer Ansicht, die sich wie eine mobile App anfühlt.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreateNewEvent({ start: selectedDate })}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              >
                + Neuer Termin
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.label}
                  onClick={() => handleTypeFilterChange(type.value)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                    eventTypeFilter === type.value ? `${type.chipClass} ring-2 ring-blue-200` : `${type.chipClass} opacity-70`
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {PRIORITY_FILTERS.map((priority) => (
                <button
                  key={priority.label}
                  onClick={() => handlePriorityFilterChange(priority.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    priorityFilter === priority.value
                      ? `${priority.badgeClass} ring-2 ring-offset-1 ring-offset-white`
                      : `${priority.badgeClass} opacity-60`
                  }`}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {(activeType?.value || activePriority?.value) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                <span className="font-semibold text-slate-700">Filter aktiv:</span>
                <span>{activeType?.label}</span>
                <span>•</span>
                <span>{activePriority?.label}</span>
                <button
                  onClick={() => {
                    setEventTypeFilter(EVENT_TYPES[0].value);
                    setPriorityFilter(PRIORITY_FILTERS[0].value);
                  }}
                  className="ml-2 text-slate-400 hover:text-slate-600"
                  aria-label="Filter zurücksetzen"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          <div className="relative mt-6 h-[720px]">
            {eventsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
              </div>
            )}

            <AdvancedCalendar
              events={events}
              view={calendarView}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onEventClick={handleEventClick}
              onEventCreate={handleCalendarEventCreate}
              onRangeChange={handleRangeChange}
              onViewChange={setCalendarView}
            />
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {activeTab === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskCreate={handleTaskCreate}
          onTaskDelete={handleTaskDelete}
        />
      )}

      {/* Waste Templates */}
      {activeTab === 'waste-templates' && (
        <WasteTemplateManager
          templates={wasteTemplates}
          onTemplateCreate={handleTemplateCreate}
          onTemplateUpdate={handleTemplateUpdate}
          onTemplateDelete={handleTemplateDelete}
          onTemplateApply={handleTemplateApply}
        />
      )}

      {/* Event Details Panel */}
      <EventDetailsPanel
        event={selectedEvent}
        isOpen={showEventPanel}
        onClose={() => setShowEventPanel(false)}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        onDuplicate={handleEventDuplicate}
        mode={eventPanelMode}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Dashboard;
