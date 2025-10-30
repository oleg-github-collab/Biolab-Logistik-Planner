import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { CalendarDays, LayoutDashboard, Recycle, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SimpleCalendar from '../components/SimpleCalendar';
import EventDetailsPanel from '../components/EventDetailsPanel';
import EventModal from '../components/EventModal';
import AbsenceModal from '../components/AbsenceModal';
import UnifiedTaskBoard from '../components/UnifiedTaskBoard';
import EnhancedWasteManager from '../components/EnhancedWasteManager';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  createAbsenceEvent
} from '../utils/api';
import { format, addDays, addMinutes, startOfWeek, endOfWeek, formatISO } from 'date-fns';

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
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      const split = value
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (split.length > 0) {
        return split;
      }
    }
    return fallback;
  }
  return fallback;
};

const normalizeAttachmentList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};

const mapApiEventToUi = (event) => {
  const start = parseDbDateTime(event.start_time) ?? new Date();
  const end = parseDbDateTime(event.end_time) ?? addMinutes(start, 60);
  const allDay = Boolean(event.all_day);
  const type = event.event_type || event.type || 'Termin';

  const attachments = normalizeAttachmentList(event.attachments);
  const attendeeList = Array.isArray(event.attendees)
    ? event.attendees
    : safeParseJson(event.attendees);
  const tags = Array.isArray(event.tags) ? event.tags : safeParseJson(event.tags);

  const recurring = Boolean(event.is_recurring);
  const recurrenceEnd = recurring && event.recurrence_end_date
    ? format(parseDbDateTime(event.recurrence_end_date), 'yyyy-MM-dd')
    : '';

  return {
    id: event.id,
    title: event.title,
    description: event.description || '',
    start,
    end,
    start_date: format(start, 'yyyy-MM-dd'),
    end_date: format(end, 'yyyy-MM-dd'),
    start_time: allDay ? '' : format(start, 'HH:mm'),
    end_time: allDay ? '' : format(end, 'HH:mm'),
    all_day: allDay,
    type,
    priority: event.priority || 'medium',
    location: event.location || '',
    attendees: attendeeList,
    reminder: event.reminder ?? 15,
    status: event.status || 'confirmed',
    color: event.color || getEventColor(type),
    notes: event.notes || '',
    category: event.category || 'work',
    recurring,
    recurring_pattern: recurring ? (event.recurrence_pattern || 'weekly') : null,
    recurring_end: recurrenceEnd,
    tags,
    attachments,
    cover_image: event.cover_image || null,
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
  const recurring = Boolean(event.recurring);
  const eventType = event.type || event.event_type || 'Termin';
  const recurrencePattern = recurring ? (event.recurring_pattern || event.recurrence_pattern || null) : null;
  const recurrenceEndIso = recurring && (event.recurring_end || event.recurrence_end)
    ? new Date(event.recurring_end || event.recurrence_end).toISOString()
    : null;
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const attachments = Array.isArray(event.attachments) ? event.attachments : [];

  return {
    title: event.title,
    description: event.description || '',
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    startTime: event.all_day ? null : (event.start_time || (startDate ? format(startDate, 'HH:mm') : null)),
    endTime: event.all_day ? null : (event.end_time || (endDate ? format(endDate, 'HH:mm') : null)),
    event_type: eventType,
    type: eventType,
    all_day: Boolean(event.all_day),
    isAllDay: Boolean(event.all_day),
    is_recurring: recurring,
    isRecurring: recurring,
    recurrence_pattern: recurrencePattern,
    recurrencePattern,
    recurrence_end_date: recurrenceEndIso,
    recurrenceEndDate: recurrenceEndIso,
    priority: event.priority || 'medium',
    status: event.status || 'confirmed',
    category: event.category || 'work',
    location: event.location || '',
    attendees,
    reminder: event.reminder ?? 15,
    notes: event.notes || '',
    color: event.color || null,
    tags,
    attachments,
    cover_image: event.cover_image || null
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

const MOBILE_NAV_TABS = [
  { id: 'calendar', label: 'Kalender', icon: CalendarDays },
  { id: 'kanban', label: 'Kanban', icon: LayoutDashboard },
  { id: 'waste-manager', label: 'Abfall', icon: Recycle }
];

// ✅ OPTIMIZED: Memoized Toast component to prevent unnecessary re-renders
const Toast = memo(({ toast, onClose }) => {
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
});

const Dashboard = () => {
  const auth = useAuth(); const user = auth?.user;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventPanelMode, setEventPanelMode] = useState('view');
  const [showEventPanel, setShowEventPanel] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 767px)').matches
    : false));
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event) => setIsMobile(event.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }

    setIsMobile(mediaQuery.matches);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

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

  // ✅ OPTIMIZED: useCallback for date and event selection handlers
  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    setEventRange((prev) => ({
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
      view: prev?.view || 'week'
    }));
  }, [setEventRange]);

  const handleEventClick = useCallback((event, mode = 'view') => {
    setSelectedEvent(event);
    setEventPanelMode(mode);
    setShowEventPanel(true);
  }, []);

  // ✅ OPTIMIZED: useCallback for event CRUD operations
  const handleEventSave = useCallback(async (eventData) => {
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
      setShowEventModal(false);
    } catch (err) {
      console.error('Error saving event:', err);
      showToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Der Termin konnte nicht gespeichert werden.' });
    }
  }, [eventPanelMode, showToast]);

  const handleEventModalClose = useCallback(() => {
    setShowEventModal(false);
    setSelectedEvent(null);
  }, []);

  const handleEventDelete = useCallback(async (eventId) => {
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      showToast({ type: 'success', title: 'Termin gelöscht' });
      setShowEventPanel(false);
    } catch (err) {
      console.error('Error deleting event:', err);
      showToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Bitte versuche es in ein paar Sekunden erneut.' });
    }
  }, [showToast]);

  const handleEventDuplicate = useCallback(async (eventData) => {
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
  }, [showToast]);

  const handleCalendarEventCreate = async (details = {}) => {
    // Set selected event for the modal
    const start = details.start ? new Date(details.start) : selectedDate || new Date();
    const end = details.end ? new Date(details.end) : addMinutes(start, 60);

    setSelectedEvent({
      title: details.title || '',
      description: details.description || '',
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
      start_time: details.all_day ? '' : format(start, 'HH:mm'),
      end_time: details.all_day ? '' : format(end, 'HH:mm'),
      all_day: Boolean(details.all_day),
      type: details.type || 'Arbeit',
      priority: details.priority || 'medium',
      location: details.location || '',
      attendees: details.attendees || [],
      reminder: details.reminder ?? 15,
      status: 'confirmed',
      category: details.category || 'work',
      notes: details.notes || ''
    });

    setEventPanelMode('create');
    setShowEventModal(true);
  };

  // ✅ OPTIMIZED: useCallback for filter change handlers
  const handleTypeFilterChange = useCallback((value) => {
    setEventTypeFilter(value);
  }, []);

  const handlePriorityFilterChange = useCallback((value) => {
    setPriorityFilter(value);
  }, []);

  const activeType = useMemo(() => EVENT_TYPES.find((type) => type.value === eventTypeFilter), [eventTypeFilter]);
  const activePriority = useMemo(() => PRIORITY_FILTERS.find((priority) => priority.value === priorityFilter), [priorityFilter]);

  const handleAbsenceSave = async (absenceData) => {
    try {
      await createAbsenceEvent(absenceData);
      showToast({
        type: 'success',
        title: 'Abwesenheit gemeldet',
        message: `${absenceData.title} wurde erfolgreich für ${absenceData.start_date} bis ${absenceData.end_date} gemeldet.`
      });

      // Refresh events to show the new absence
      const startParam = eventRange?.start ? formatISO(eventRange.start) : null;
      const endParam = eventRange?.end ? formatISO(eventRange.end) : null;
      const response = await getEvents(startParam, endParam, eventTypeFilter || undefined, priorityFilter || undefined);
      const payload = Array.isArray(response?.data) ? response.data : Array.isArray(response?.data?.data) ? response.data.data : [];
      setEvents(payload.map(mapApiEventToUi));

      setShowAbsenceModal(false);
    } catch (err) {
      console.error('Error creating absence:', err);
      showToast({
        type: 'error',
        title: 'Fehler beim Speichern',
        message: 'Die Abwesenheit konnte nicht gespeichert werden. Bitte versuche es erneut.'
      });
    }
  };

  const handleAbsenceModalClose = () => {
    setShowAbsenceModal(false);
  };

  return (
    <div className={`mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 ${isMobile ? 'pt-5 pb-24' : 'py-6'}`}>
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
        <nav className={`flex ${isMobile ? 'flex-nowrap gap-2 overflow-x-auto pb-2 -mx-1 px-1' : 'space-x-8'}`}>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } ${isMobile ? 'flex-shrink-0 px-3' : ''}`}
          >
            Kalender
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'kanban'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } ${isMobile ? 'flex-shrink-0 px-3' : ''}`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setActiveTab('waste-manager')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'waste-manager'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } ${isMobile ? 'flex-shrink-0 px-3' : ''}`}
          >
            Abfallmanagement
          </button>
        </nav>
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-lg ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Fortgeschrittener Kalender</h2>
              <p className="text-sm text-slate-500">
                Plane Schichten, Termine und Einsätze mit einer Ansicht, die sich wie eine mobile App anfühlt.
              </p>
            </div>

            <div className={`${isMobile ? 'hidden' : 'flex items-center gap-2'}`}>
              <button
                onClick={() => {
                  handleCalendarEventCreate({ start: selectedDate });
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              >
                + Neuer Termin
              </button>

              {/* Show absence button only for Vollzeit employees */}
              {user?.employment_type === 'Vollzeit' && (
                <button
                  onClick={() => setShowAbsenceModal(true)}
                  className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500"
                >
                  🏖️ Abwesenheit melden
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className={`${isMobile ? 'flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1' : 'flex flex-wrap gap-2'}`}>
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

            <div className={`${isMobile ? 'flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1' : 'flex items-center gap-2 overflow-x-auto'}`}>
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

          {isMobile && user?.employment_type === 'Vollzeit' && (
            <button
              onClick={() => setShowAbsenceModal(true)}
              className="mt-1 w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm"
            >
              🏖️ Abwesenheit melden
            </button>
          )}

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

          <div className={`relative mt-6 ${isMobile ? 'h-[520px]' : 'h-[720px]'}`}>
            {eventsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
              </div>
            )}

            <SimpleCalendar
              events={events}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onEventClick={handleEventClick}
              onEventCreate={handleCalendarEventCreate}
            />
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {activeTab === 'kanban' && (
        <UnifiedTaskBoard />
      )}

      {/* Waste Manager */}
      {activeTab === 'waste-manager' && (
        <EnhancedWasteManager />
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

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={handleEventModalClose}
        onSave={handleEventSave}
        selectedDate={selectedDate}
        event={selectedEvent}
        mode={eventPanelMode}
      />

      {/* Absence Modal */}
      <AbsenceModal
        isOpen={showAbsenceModal}
        onClose={handleAbsenceModalClose}
        onSave={handleAbsenceSave}
        selectedDate={selectedDate}
      />

      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => {
              setActiveTab('calendar');
              handleCalendarEventCreate({ start: selectedDate });
            }}
            className="fixed bottom-20 right-5 z-[1200] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200"
            aria-label="Neuen Termin erstellen"
          >
            <Plus className="h-6 w-6" />
          </button>
          <nav className="fixed bottom-4 left-1/2 z-[1190] flex w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
            {MOBILE_NAV_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
                  activeTab === id ? 'text-blue-600' : 'text-slate-500'
                }`}
                aria-label={label}
              >
                <Icon className={`h-5 w-5 ${activeTab === id ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Dashboard;
