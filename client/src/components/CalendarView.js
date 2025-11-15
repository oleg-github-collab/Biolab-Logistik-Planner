import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfWeek,
  addDays,
  startOfDay,
  endOfWeek,
  isSameDay
} from 'date-fns';
import { de } from 'date-fns/locale';
import { safeEventDates, formatTimeRange } from '../utils/dateHelpers';

// Initialize moment with German locale
moment.locale('de');
const localizer = momentLocalizer(moment);

// Create drag-and-drop enabled calendar
const DragAndDropCalendar = withDragAndDrop(BigCalendar);

/**
 * CalendarView Component
 * A robust calendar component with drag-and-drop, resize, and real-time update capabilities
 *
 * @param {Array} events - Array of event objects to display
 * @param {Function} onEventClick - Callback when an event is clicked
 * @param {Function} onEventCreate - Callback when a new event is created
 * @param {Function} onEventUpdate - Callback when an event is updated (moved/resized)
 * @param {Function} onSelectSlot - Callback when a time slot is selected
 * @param {Function} onRangeChange - Callback when the calendar view range changes
 * @param {Boolean} loading - Loading state
 * @param {Boolean} isMobile - Mobile view flag
 */
const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
const normalizeDate = (value, fallback = new Date()) => {
  const candidate = value ? (value instanceof Date ? value : new Date(value)) : null;
  if (isValidDate(candidate)) {
    return candidate;
  }
  return fallback;
};

const CalendarView = ({
  events = [],
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onSelectSlot,
  onRangeChange,
  onEventEdit,
  onEventDelete,
  loading = false,
  isMobile = false
}) => {
  const [view, setView] = useState(isMobile ? 'agenda' : 'month');
  const [date, setDate] = useState(() => new Date());
  const setSafeDate = useCallback((value) => {
    setDate(normalizeDate(value));
  }, []);
  const [draggedEvent, setDraggedEvent] = useState(null);

  // Transform events for BigCalendar with proper date parsing
  const calendarEvents = useMemo(() => {
    return events.map(event => {
      // Parse dates safely with validation
      const startValue = event.start_date || event.start;
      const endValue = event.end_date || event.end || event.start_date || event.start;

      let start = event.start instanceof Date ? event.start : new Date(startValue);
      let end = event.end instanceof Date ? event.end : new Date(endValue);

      // Validate dates - if invalid, use current date
      if (isNaN(start.getTime())) {
        console.warn(`Invalid start date for event ${event.id}:`, startValue);
        start = new Date();
      }
      if (isNaN(end.getTime())) {
        console.warn(`Invalid end date for event ${event.id}:`, endValue);
        end = new Date(start.getTime() + 3600000); // Add 1 hour
    }

      return {
        ...event,
        id: event.id,
        title: event.title || 'Unbenannt',
        start: start,
        end: end,
        allDay: Boolean(event.all_day || event.isAllDay),
        resource: event,
      };
    });
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((event) => event.start >= now)
      .sort((a, b) => a.start - b.start)
      .slice(0, 3);
  }, [calendarEvents]);

  const heroWeekStart = useMemo(
    () => startOfWeek(normalizeDate(date), { weekStartsOn: 1 }),
    [date]
  );
  const heroWeekEnd = useMemo(
    () => endOfWeek(normalizeDate(date), { weekStartsOn: 1 }),
    [date]
  );
  const mobileWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      days.push(addDays(heroWeekStart, i));
    }
    return days;
  }, [heroWeekStart]);

  const getEventsForDay = useCallback(
    (day) => {
      if (!isValidDate(day)) return [];
      return calendarEvents.filter(
        (event) => isValidDate(event.start) && isSameDay(event.start, day)
      );
    },
    [calendarEvents]
  );

  const upcomingMobileEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return calendarEvents
      .filter((event) => event.start >= today)
      .sort((a, b) => a.start - b.start)
      .slice(0, 4);
  }, [calendarEvents]);

  const handleMobileDayFocus = useCallback((day) => {
    setView('day');
    setSafeDate(day);
  }, [setSafeDate]);

  const handleMobileQuickCreate = useCallback(() => {
    if (!onEventCreate) return;
    const start = new Date();
    const end = addMinutes(start, 60);
    onEventCreate({
      start,
      end
    });
  }, [onEventCreate]);

  // Handle event drag-and-drop (move)
  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    if (!onEventUpdate) return;

    try {
      setDraggedEvent(event.id);

      // Calculate the time difference
      const originalStart = event.start;
      const originalEnd = event.end;
      const duration = differenceInMinutes(originalEnd, originalStart);

      // Create updated event data
      const updatedEvent = {
        ...event.resource,
        start,
        end: end || addMinutes(start, duration),
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end || addMinutes(start, duration), 'yyyy-MM-dd'),
        start_time: event.allDay ? '' : format(start, 'HH:mm'),
        end_time: event.allDay ? '' : format(end || addMinutes(start, duration), 'HH:mm'),
      };

      // Call the update callback - it will handle API call and refetch
      await onEventUpdate(event.id, updatedEvent);

    } catch (error) {
      console.error('Error moving event:', error);
    } finally {
      setDraggedEvent(null);
    }
  }, [onEventUpdate]);

  // Handle event resize
  const handleEventResize = useCallback(async ({ event, start, end }) => {
    if (!onEventUpdate) return;

    try {
      setDraggedEvent(event.id);

      // Create updated event data with new times
      const updatedEvent = {
        ...event.resource,
        start,
        end,
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        start_time: event.allDay ? '' : format(start, 'HH:mm'),
        end_time: event.allDay ? '' : format(end, 'HH:mm'),
      };

      // Call the update callback - it will handle API call and refetch
      await onEventUpdate(event.id, updatedEvent);

    } catch (error) {
      console.error('Error resizing event:', error);
    } finally {
      setDraggedEvent(null);
    }
  }, [onEventUpdate]);

  // Handle event click
  const handleSelectEvent = useCallback((event) => {
    if (onEventClick) {
      // Pass the original event resource data
      onEventClick(event.resource || event);
    }
  }, [onEventClick]);

  // Handle slot selection (click to create)
  const handleSelectSlot = useCallback((slotInfo) => {
    if (onEventCreate) {
      onEventCreate({
        start: slotInfo.start,
        end: slotInfo.end,
        all_day: slotInfo.action === 'select' && slotInfo.slots.length > 1,
      });
    }
    if (onSelectSlot) {
      onSelectSlot(slotInfo);
    }
  }, [onEventCreate, onSelectSlot]);

  // Handle navigation (prev/next/today)
  const handleNavigate = useCallback(
    (direction) => {
      const unit = view === 'agenda' ? 'day' : view;
      const nextDate = moment(normalizeDate(date))[direction](1, unit).toDate();
      setSafeDate(nextDate);
    },
    [view, date, setSafeDate]
  );

  const handleToday = useCallback(() => {
    setSafeDate(new Date());
  }, [setSafeDate]);

  // Handle view change
  const handleViewChange = useCallback((newView) => {
    setView(newView);
  }, []);

  // Handle date change
  const handleDateChange = useCallback(
    (newDate) => {
      setSafeDate(newDate);
    },
    [setSafeDate]
  );

  const safeFormat = useCallback(
    (value, fmt, options = {}) => (isValidDate(value) ? format(value, fmt, options) : '--'),
    []
  );

  const heroWeekLabel = `${safeFormat(heroWeekStart, 'dd.MM')} – ${safeFormat(
    heroWeekEnd,
    'dd.MM'
  )}`;

  const MobileCalendarHero = ({
    days = [],
    selectedDate,
    weekLabel,
    onPrev,
    onNext,
    onToday,
    onDayFocus,
    onEventCreate,
    upcomingEvents,
    onEventClick,
    onEventEdit,
    onEventDelete
  }) => (
    <div className="mobile-calendar-hero">
      <div className="mobile-calendar-hero__header">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-500">Kalender</p>
          <h3 className="text-lg font-semibold text-slate-900">{weekLabel}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="mobile-calendar-hero__nav"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="mobile-calendar-hero__nav mobile-calendar-hero__nav--solid"
          >
            Heute
          </button>
          <button
            type="button"
            onClick={onNext}
            className="mobile-calendar-hero__nav"
            aria-label="Nächste Woche"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mobile-calendar-hero__days">
        {days.filter(isValidDate).map((day) => {
          const dayEvents = getEventsForDay(day);
          const isActiveDay = isSameDay(day, normalizeDate(selectedDate));
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayFocus(day)}
              className={`mobile-calendar-day-card ${
                isActiveDay ? 'mobile-calendar-day-card--active' : ''
              }`}
            >
              <span className="mobile-calendar-day-card__weekday">
                {safeFormat(day, 'EEE', { locale: de })}
              </span>
              <span className="mobile-calendar-day-card__date">{safeFormat(day, 'dd')}</span>
              <span className="mobile-calendar-day-card__count">{dayEvents.length} Termine</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onEventCreate}
          className="mobile-calendar-day-card mobile-calendar-day-card--cta"
        >
          + Termin
        </button>
      </div>

      <div className="calendar-mobile-glance">
        {upcomingEvents.length === 0 ? (
          <div className="calendar-mobile-glance__card">
            <span className="calendar-mobile-glance__accent" aria-hidden="true" />
            <div className="calendar-mobile-glance__body">
              <p className="calendar-mobile-glance__title">Noch nichts geplant</p>
              <p className="calendar-mobile-glance__time">
                Tippe auf „+ Termin“ oder wähle eine Woche aus.
              </p>
              <span className="calendar-mobile-glance__tag">Bereit</span>
            </div>
          </div>
        ) : (
          upcomingEvents.map((event) => {
            const resource = event.resource || event;
            const { validStart, validEnd } = safeEventDates(event);
            const timeLabel = formatTimeRange(validStart, validEnd, event.allDay);
            const tagLabel = resource.type || resource.category || 'Termin';
            const titleLabel = event.title || 'Kalendertermin';
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick?.(event)}
                className="calendar-mobile-glance__card text-left"
              >
                <span className="calendar-mobile-glance__accent" aria-hidden="true" />
                <div className="calendar-mobile-glance__body">
                  <p className="calendar-mobile-glance__title truncate">{titleLabel}</p>
                  <p className="calendar-mobile-glance__time">{timeLabel}</p>
                  <span className="calendar-mobile-glance__tag">{tagLabel}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // Notify parent of range changes for data fetching
  useEffect(() => {
    if (onRangeChange) {
      const getRange = () => {
        const currentDate = moment(date);
        switch (view) {
          case 'month':
            return {
              start: currentDate.clone().startOf('month').startOf('week').toDate(),
              end: currentDate.clone().endOf('month').endOf('week').toDate(),
              view: 'month'
            };
          case 'week':
            return {
              start: currentDate.clone().startOf('week').toDate(),
              end: currentDate.clone().endOf('week').toDate(),
              view: 'week'
            };
          case 'day':
            return {
              start: currentDate.clone().startOf('day').toDate(),
              end: currentDate.clone().endOf('day').toDate(),
              view: 'day'
            };
          case 'agenda':
            return {
              start: currentDate.clone().startOf('day').toDate(),
              end: currentDate.clone().add(30, 'days').endOf('day').toDate(),
              view: 'agenda'
            };
          default:
            return {
              start: currentDate.clone().startOf('month').toDate(),
              end: currentDate.clone().endOf('month').toDate(),
              view: 'month'
            };
        }
      };

      onRangeChange(getRange());
    }
  }, [date, view, onRangeChange]);

  // German translations for calendar
  const messages = {
    today: 'Heute',
    previous: 'Zurück',
    next: 'Weiter',
    month: 'Monat',
    week: 'Woche',
    day: 'Tag',
    agenda: 'Agenda',
    date: 'Datum',
    time: 'Zeit',
    event: 'Ereignis',
    noEventsInRange: 'Keine Ereignisse in diesem Zeitraum.',
    showMore: total => `+ ${total} mehr`,
    allDay: 'Ganztägig',
    yesterday: 'Gestern',
    tomorrow: 'Morgen',
    work_week: 'Arbeitswoche',
  };

  // View options based on device
  const desktopViewOptions = ['month', 'week', 'day', 'agenda'];
  const mobileViewOptions = ['month', 'week', 'agenda'];
  const calendarViews = isMobile ? mobileViewOptions : desktopViewOptions;
  const viewOptions = isMobile ? mobileViewOptions : desktopViewOptions;

  // Calendar height responsive to device
  const calendarHeight = isMobile ? 'min(680px, calc(100vh - 220px))' : 'min(840px, calc(100vh - 260px))';
  const calendarMinHeight = isMobile ? '420px' : '600px';

  // Custom event style getter
  const eventStyleGetter = useCallback((event) => {
    const isDragging = draggedEvent === event.id;

    return {
      style: {
        backgroundColor: event.color || '#3b82f6',
        borderRadius: '6px',
        opacity: isDragging ? 0.5 : 0.95,
        color: 'white',
        border: '0px',
        display: 'block',
        fontWeight: 600,
        padding: '2px 6px',
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
      }
    };
  }, [draggedEvent]);

  // Day prop getter for custom styling
  const dayPropGetter = useCallback((date) => {
    const isToday = moment(date).isSame(moment(), 'day');
    return {
      style: {
        backgroundColor: isToday ? '#eff6ff' : undefined,
      }
    };
  }, []);

  // Slot prop getter for custom styling
  const slotPropGetter = useCallback((date) => {
    const isToday = moment(date).isSame(moment(), 'day');
    return {
      style: {
        backgroundColor: isToday ? '#fafafa' : undefined,
      }
    };
  }, []);

  return (
    <div className={`${isMobile ? 'calendar-mobile-card' : 'bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden'}`}>
      {/* Custom Toolbar */}
      {isMobile ? (
        <div className="calendar-mobile-toolbar">
          <div className="calendar-mobile-toolbar__top">
            <button
              type="button"
              onClick={() => handleNavigate('subtract')}
              aria-label="Vorheriger Zeitraum"
              disabled={loading}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="calendar-mobile-toolbar__date">
              <p>{moment(date).format('MMMM YYYY')}</p>
              <span>{moment(date).format('dddd, DD.MM')}</span>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('add')}
              aria-label="Nächster Zeitraum"
              disabled={loading}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="calendar-mobile-toolbar__views">
            {mobileViewOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleViewChange(option)}
                className={view === option ? 'active' : ''}
                disabled={loading}
              >
                {messages[option]}
              </button>
            ))}
            <button
              type="button"
              className="today"
              onClick={handleToday}
              disabled={loading}
            >
              Heute
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-4 p-4 sm:p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('subtract')}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 w-10 h-10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Vorheriger Zeitraum"
              disabled={loading}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-[200px]">
              <p className="text-sm text-slate-500">
                {moment(date).format('dddd, DD.MM.YYYY')}
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {view === 'month' ? moment(date).format('MMMM YYYY') : moment(date).format('DD. MMM YYYY')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('add')}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 w-10 h-10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Nächster Zeitraum"
              disabled={loading}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              Heute
            </button>

            <div className="flex gap-2 overflow-x-auto">
              {viewOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleViewChange(option)}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    view === option
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  disabled={loading}
                >
                  {messages[option]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Laden...</span>
            </div>
          </div>
        )}
      </div>
      )}

      {isMobile && (
        <MobileCalendarHero
          days={mobileWeekDays}
          selectedDate={date}
          weekLabel={heroWeekLabel}
          onPrev={() => handleNavigate('subtract')}
          onNext={() => handleNavigate('add')}
          onToday={handleToday}
          onDayFocus={handleMobileDayFocus}
          onEventCreate={handleMobileQuickCreate}
          upcomingEvents={upcomingMobileEvents}
          onEventClick={handleSelectEvent}
          onEventEdit={onEventEdit}
          onEventDelete={onEventDelete}
        />
      )}

      {/* Calendar */}
      <div className="rounded-xl overflow-hidden">
        <div className="relative">
          <DragAndDropCalendar
            localizer={localizer}
            events={calendarEvents}
            view={view}
            date={date}
            onView={handleViewChange}
            onNavigate={handleDateChange}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            resizable
            draggableAccessor={() => true}
            resizableAccessor={() => true}
            messages={messages}
            style={{
              height: calendarHeight,
              minHeight: calendarMinHeight,
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s ease'
            }}
            views={calendarViews}
            toolbar={false}
            popup={!isMobile}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            slotPropGetter={slotPropGetter}
            step={30}
            timeslots={2}
            defaultDate={new Date()}
            scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
            culture="de"
            formats={{
              dateFormat: 'DD',
              dayFormat: (date, culture, localizer) =>
                localizer.format(date, 'ddd DD.MM', culture),
              weekdayFormat: (date, culture, localizer) =>
                localizer.format(date, 'ddd', culture),
              monthHeaderFormat: (date, culture, localizer) =>
                localizer.format(date, 'MMMM YYYY', culture),
              dayHeaderFormat: (date, culture, localizer) =>
                localizer.format(date, 'dddd, DD.MM.YYYY', culture),
              dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
                `${localizer.format(start, 'DD.MM', culture)} - ${localizer.format(end, 'DD.MM.YYYY', culture)}`,
              agendaHeaderFormat: ({ start, end }, culture, localizer) =>
                `${localizer.format(start, 'DD.MM', culture)} - ${localizer.format(end, 'DD.MM.YYYY', culture)}`,
              agendaDateFormat: (date, culture, localizer) =>
                localizer.format(date, 'ddd DD.MM', culture),
              agendaTimeFormat: (date, culture, localizer) =>
                localizer.format(date, 'HH:mm', culture),
              agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
                `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
              timeGutterFormat: (date, culture, localizer) =>
                localizer.format(date, 'HH:mm', culture),
              eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
            }}
          />
        </div>
      </div>

      {/* Help Text */}
      {!isMobile && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-600 text-center">
            Klicken Sie auf einen Termin zum Ansehen/Bearbeiten. Ziehen Sie Termine zum Verschieben. Ziehen Sie an den Rändern zum Ändern der Dauer.
          </p>
        </div>
      )}
    </div>
  );
};

CalendarView.propTypes = {
  events: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    start: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    end: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    start_date: PropTypes.string,
    end_date: PropTypes.string,
    all_day: PropTypes.bool,
    color: PropTypes.string,
  })),
  onEventClick: PropTypes.func,
  onEventCreate: PropTypes.func,
  onEventUpdate: PropTypes.func,
  onEventEdit: PropTypes.func,
  onEventDelete: PropTypes.func,
  onSelectSlot: PropTypes.func,
  onRangeChange: PropTypes.func,
  loading: PropTypes.bool,
  isMobile: PropTypes.bool,
};

export default CalendarView;
