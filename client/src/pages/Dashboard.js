import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useWebSocketContext } from '../context/WebSocketContext';
import CalendarView from '../components/CalendarView';
import MobileEventCalendar from '../components/MobileEventCalendar';
import EventDetailsModal from '../components/EventDetailsModal';
import EventFormModal from '../components/EventFormModal';
import AbsenceModal from '../components/AbsenceModal';
import {
  fetchEvents,
  createEventWithRefetch,
  updateEventWithRefetch,
  deleteEventWithRefetch,
  duplicateEventWithRefetch,
  setupCalendarWebSocketListeners,
  transformApiEventToUi,
  transformUiEventToApi,
  getEventColor
} from '../utils/calendarApi';
import { createAbsenceEvent } from '../utils/api';
import { format, addDays, addMinutes, startOfDay, startOfWeek, endOfWeek, formatISO } from 'date-fns';

// Helper functions moved to calendarApi.js - using transformApiEventToUi and transformUiEventToApi

const EVENT_TYPES = [
  { value: null, label: 'Alle', chipClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { value: 'Arbeit', label: 'Arbeit', chipClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
  { value: 'Meeting', label: 'Meetings', chipClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
  { value: 'Urlaub', label: 'Urlaub', chipClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { value: 'Krankheit', label: 'Ausfälle', chipClass: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { value: 'Projekt', label: 'Projekt', chipClass: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  { value: 'inspection', label: 'Kisten', chipClass: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { value: 'disposal', label: 'Entsorgung', chipClass: 'bg-green-100 text-green-700 hover:bg-green-200' }
];

const PRIORITY_FILTERS = [
  { value: null, label: 'Alle', badgeClass: 'bg-slate-200 text-slate-700' },
  { value: 'low', label: '⏱️ Locker', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'medium', label: '⚡ Normal', badgeClass: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: '🔥 Hoch', badgeClass: 'bg-rose-100 text-rose-700' }
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
  const auth = useAuth();
  const user = auth?.user;
  const websocketContext = useWebSocketContext();
  const socket = websocketContext?.socket;
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventFormMode, setEventFormMode] = useState('create');
  const [showEventFormModal, setShowEventFormModal] = useState(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
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

  // Refetch function for calendar operations
  const refetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const startParam = eventRange?.start ? formatISO(eventRange.start) : null;
      const endParam = eventRange?.end ? formatISO(eventRange.end) : null;
      const result = await fetchEvents(startParam, endParam, eventTypeFilter || undefined, priorityFilter || undefined);

      if (!result.noChange) {
        setEvents(result.data.map(transformApiEventToUi));
      }
    } catch (err) {
      console.error('Error loading events:', err);
      showToast({ type: 'error', title: 'Termine konnten nicht geladen werden', message: 'Bitte überprüfe deine Verbindung und versuche es erneut.' });
    } finally {
      setEventsLoading(false);
    }
  }, [eventRange?.start, eventRange?.end, eventTypeFilter, priorityFilter, showToast]);

  // Fetch events on mount and when filters change
  useEffect(() => {
    refetchEvents();
  }, [refetchEvents]);

  // Setup WebSocket listeners for real-time updates
  useEffect(() => {
    if (socket) {
      const cleanup = setupCalendarWebSocketListeners(socket, refetchEvents);
      return cleanup;
    }
  }, [socket, refetchEvents]);

  // Handle focusEventId from navigation state (when coming from messages)
  useEffect(() => {
    if (location.state?.focusEventId && events.length > 0) {
      const eventId = location.state.focusEventId;
      const event = events.find(e => e.id === eventId);

      if (event) {
        // Switch to calendar tab
        setActiveTab('calendar');
        // Open event details modal
        setSelectedEvent(event);
        setShowEventDetailsModal(true);
        // Clear the navigation state so it doesn't persist on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, location.pathname, navigate, events]);

  // Handle calendar range changes (for view changes like month/week/day)
  const handleRangeChange = useCallback((range) => {
    setEventRange(range);
  }, []);

  const handleMobileWeekChange = useCallback((weekStartDate, weekEndDate) => {
    if (!weekStartDate || !weekEndDate) return;

    setEventRange((prev) => {
      const sameStart = prev?.start && prev.start.getTime() === weekStartDate.getTime();
      const sameEnd = prev?.end && prev.end.getTime() === weekEndDate.getTime();
      if (sameStart && sameEnd && prev?.view === 'week') {
        return prev;
      }
      return {
        start: weekStartDate,
        end: weekEndDate,
        view: 'week'
      };
    });

    setActiveTab('calendar');
    setSelectedDate(weekStartDate);
  }, [setEventRange, setActiveTab, setSelectedDate]);

  const handleMobileDayOpen = useCallback((day) => {
    if (!day) return;
    const start = startOfDay(day);
    const end = addDays(start, 1);

    setEventRange((prev) => {
      const sameStart = prev?.start && prev.start.getTime() === start.getTime();
      const sameEnd = prev?.end && prev.end.getTime() === end.getTime();
      if (sameStart && sameEnd && prev?.view === 'day') {
        return prev;
      }
      return {
        start,
        end,
        view: 'day'
      };
    });

    setActiveTab('calendar');
    setSelectedDate(start);
  }, [setEventRange, setActiveTab, setSelectedDate]);

  // Handle event click (opens details modal)
  const handleEventClick = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  }, []);

  // Handle event save (create or update)
  const handleEventSave = useCallback(async (eventData) => {
    if (!eventData?.title?.trim()) {
      showToast({ type: 'error', title: 'Titel fehlt', message: 'Bitte gib einen aussagekräftigen Titel für den Termin an.' });
      return;
    }

    try {
      const payload = transformUiEventToApi(eventData);

      if (eventFormMode === 'create') {
        await createEventWithRefetch(payload, refetchEvents);
        showToast({ type: 'success', title: 'Termin erstellt', message: `${eventData.title} wurde hinzugefügt.` });
      } else {
        await updateEventWithRefetch(eventData.id, payload, refetchEvents);
        showToast({ type: 'success', title: 'Termin aktualisiert' });
      }

      setShowEventFormModal(false);
      setShowEventDetailsModal(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error saving event:', err);
      showToast({ type: 'error', title: 'Speichern fehlgeschlagen', message: 'Der Termin konnte nicht gespeichert werden.' });
    }
  }, [eventFormMode, refetchEvents, showToast]);

  // Handle event update (for drag-and-drop and resize)
  const handleEventUpdate = useCallback(async (eventId, updatedData) => {
    try {
      const payload = transformUiEventToApi(updatedData);
      await updateEventWithRefetch(eventId, payload, refetchEvents);
      showToast({ type: 'success', title: 'Termin verschoben' });
    } catch (err) {
      console.error('Error updating event:', err);
      showToast({ type: 'error', title: 'Aktualisierung fehlgeschlagen', message: 'Der Termin konnte nicht verschoben werden.' });
    }
  }, [refetchEvents, showToast]);

  // Handle event delete
  const handleEventDelete = useCallback(async (eventId) => {
    try {
      await deleteEventWithRefetch(eventId, refetchEvents);
      showToast({ type: 'success', title: 'Termin gelöscht' });
      setShowEventDetailsModal(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      showToast({ type: 'error', title: 'Löschen fehlgeschlagen', message: 'Bitte versuche es in ein paar Sekunden erneut.' });
    }
  }, [refetchEvents, showToast]);

  const handleEventEdit = useCallback((event) => {
    setSelectedEvent(event);
    setEventFormMode('edit');
    setShowEventFormModal(true);
    setShowEventDetailsModal(false);
  }, []);

  // Handle event duplicate
  const handleEventDuplicate = useCallback(async (eventData) => {
    try {
      const start = eventData.start instanceof Date ? eventData.start : new Date(eventData.start);
      const end = eventData.end instanceof Date ? eventData.end : new Date(eventData.end);
      const duplicateStart = addDays(start, 1);
      const duplicateEnd = addDays(end, 1);

      const duplicateData = {
        ...eventData,
        title: `${eventData.title || 'Termin'} (Kopie)`,
        start: duplicateStart,
        end: duplicateEnd,
        start_date: format(duplicateStart, 'yyyy-MM-dd'),
        end_date: format(duplicateEnd, 'yyyy-MM-dd'),
        start_time: eventData.all_day ? '' : format(duplicateStart, 'HH:mm'),
        end_time: eventData.all_day ? '' : format(duplicateEnd, 'HH:mm')
      };

      const payload = transformUiEventToApi(duplicateData);
      await createEventWithRefetch(payload, refetchEvents);
      showToast({ type: 'success', title: 'Termin dupliziert', message: `${eventData.title} wurde auf den Folgetag kopiert.` });
      setShowEventDetailsModal(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error duplicating event:', err);
      showToast({ type: 'error', title: 'Duplizieren fehlgeschlagen' });
    }
  }, [refetchEvents, showToast]);

  // Handle create event from calendar slot
  const handleCalendarEventCreate = useCallback((details = {}) => {
    const start = details.start ? new Date(details.start) : selectedDate || new Date();
    const end = details.end ? new Date(details.end) : addMinutes(start, 60);

    setSelectedDate(start);

    setSelectedEvent({
      title: details.title || '',
      description: details.description || '',
      start,
      end,
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
      notes: details.notes || '',
      attachments: [],
      audio_url: null
    });

    setEventFormMode('create');
    setShowEventFormModal(true);
  }, [selectedDate, setSelectedDate]);

  // ✅ OPTIMIZED: useCallback for filter change handlers
  const handleTypeFilterChange = useCallback((value) => {
    setEventTypeFilter(value);
  }, []);

  const handlePriorityFilterChange = useCallback((value) => {
    setPriorityFilter(value);
  }, []);

  const activeType = useMemo(() => EVENT_TYPES.find((type) => type.value === eventTypeFilter), [eventTypeFilter]);
  const activePriority = useMemo(() => PRIORITY_FILTERS.find((priority) => priority.value === priorityFilter), [priorityFilter]);

  // Handle absence save
  const handleAbsenceSave = useCallback(async (absenceData) => {
    try {
      await createAbsenceEvent(absenceData);
      showToast({
        type: 'success',
        title: 'Abwesenheit gemeldet',
        message: `${absenceData.title} wurde erfolgreich für ${absenceData.start_date} bis ${absenceData.end_date} gemeldet.`
      });

      // Refresh events to show the new absence
      await refetchEvents();
      setShowAbsenceModal(false);
    } catch (err) {
      console.error('Error creating absence:', err);
      showToast({
        type: 'error',
        title: 'Fehler beim Speichern',
        message: 'Die Abwesenheit konnte nicht gespeichert werden. Bitte versuche es erneut.'
      });
    }
  }, [refetchEvents, showToast]);

  const handleAbsenceModalClose = useCallback(() => {
    setShowAbsenceModal(false);
  }, []);

  return (
    <div className={`mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 ${isMobile ? 'pt-5 pb-24' : 'py-6'}`}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600">
          Willkommen zurück, {user?.name || 'User'}! Hier ist dein Überblick für heute.
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
          <Link
            to="/kanban"
            className="py-4 px-1 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            Kanban Board
          </Link>
        </nav>
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className={`relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-100 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Kalender</h2>
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

          <div className="relative mt-6 w-full">
            {isMobile ? (
              <MobileEventCalendar
                events={events}
                onSlotSelect={handleCalendarEventCreate}
                onDaySelect={(day) => handleCalendarEventCreate({ start: day })}
                onEventClick={handleEventClick}
                onWeekChange={handleMobileWeekChange}
                onDayOpen={handleMobileDayOpen}
              />
            ) : (
              <CalendarView
                events={events}
                onEventClick={handleEventClick}
                onEventCreate={handleCalendarEventCreate}
                onEventUpdate={handleEventUpdate}
                onRangeChange={handleRangeChange}
                onEventEdit={handleEventEdit}
                onEventDelete={handleEventDelete}
                loading={eventsLoading}
                isMobile={isMobile}
              />
            )}
          </div>
        </div>
      )}

      {/* Event Form Modal (for create/edit) */}
      <EventFormModal
        isOpen={showEventFormModal}
        onClose={() => {
          setShowEventFormModal(false);
          setSelectedEvent(null);
        }}
        onSave={handleEventSave}
        event={selectedEvent}
        selectedDate={selectedDate}
        mode={eventFormMode}
      />

      {/* Event Details Modal (for viewing) */}
      {selectedEvent && (
        <EventDetailsModal
          isOpen={showEventDetailsModal}
          onClose={() => {
            setShowEventDetailsModal(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onEdit={(event) => {
            setShowEventDetailsModal(false);
            setSelectedEvent(event);
            setEventFormMode('edit');
            setShowEventFormModal(true);
          }}
          onDelete={handleEventDelete}
          onDuplicate={handleEventDuplicate}
        />
      )}

      {/* Absence Modal */}
      <AbsenceModal
        isOpen={showAbsenceModal}
        onClose={handleAbsenceModalClose}
        onSave={handleAbsenceSave}
        selectedDate={selectedDate}
      />

      {isMobile && (
        <button
          type="button"
          onClick={() => {
            setActiveTab('calendar');
            handleCalendarEventCreate({ start: selectedDate });
          }}
          className={`fixed bottom-24 right-5 z-[1200] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 ${showEventFormModal || showEventDetailsModal ? 'pointer-events-none opacity-0' : ''}`}
          aria-label="Neuen Termin erstellen"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Dashboard;
