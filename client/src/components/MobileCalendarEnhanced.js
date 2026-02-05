import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  List,
  Grid3x3,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  Filter,
  User
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay
} from 'date-fns';
import { de } from 'date-fns/locale';

const VIEW_TYPES = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  LIST: 'list'
};

const toRgba = (color, alpha) => {
  if (!color || typeof color !== 'string') return null;
  if (color.startsWith('rgba') || color.startsWith('rgb')) return color;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MobileCalendarEnhanced = ({
  events = [],
  onEventClick,
  onEventCreate,
  onViewChange,
  onDateChange,
  loading = false
}) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState(VIEW_TYPES.MONTH);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleOpenWorkHoursToday = useCallback(() => {
    navigate('/schedule', { state: { activeTab: 'team', focusDate: new Date() } });
  }, [navigate]);

  // Event types for filtering
  const eventTypes = [
    { value: null, label: 'Alle', color: 'bg-slate-100' },
    { value: 'Arbeit', label: 'Arbeit', color: 'bg-sky-100 text-sky-700' },
    { value: 'Meeting', label: 'Meeting', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'Urlaub', label: 'Urlaub', color: 'bg-amber-100 text-amber-700' },
    { value: 'Krankheit', label: 'Krankheit', color: 'bg-rose-100 text-rose-700' },
    { value: 'Projekt', label: 'Projekt', color: 'bg-violet-100 text-violet-700' }
  ];

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!selectedEventType) return events;
    return events.filter(e => {
      // Check both event_type and type fields
      const eventType = e.event_type || e.type;
      return eventType === selectedEventType;
    });
  }, [events, selectedEventType]);

  // Get events for a specific day - INCLUDING multi-day events
  const getEventsForDay = useCallback((day) => {
    return filteredEvents.filter(event => {
      // Handle both string dates and Date objects
      const eventStart = event.start instanceof Date ? event.start : parseISO(event.start);
      const eventEnd = event.end ? (event.end instanceof Date ? event.end : parseISO(event.end)) : eventStart;

      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      // Event is on this day if:
      // 1. It starts on this day, OR
      // 2. It ends on this day, OR
      // 3. It spans across this day (starts before AND ends after)
      return isSameDay(eventStart, day) ||
             isSameDay(eventEnd, day) ||
             (isBefore(eventStart, dayStart) && isAfter(eventEnd, dayEnd));
    });
  }, [filteredEvents]);

  // Navigation functions
  const handlePrevious = () => {
    if (viewType === VIEW_TYPES.MONTH) {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewType === VIEW_TYPES.WEEK) {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewType === VIEW_TYPES.MONTH) {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewType === VIEW_TYPES.WEEK) {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Render calendar header
  const renderHeader = () => (
    <div className="mobile-calendar-native__header bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      {/* Date navigation */}
      <div className="mobile-calendar-native__nav flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="mobile-calendar-native__nav-left flex items-center gap-2">
          <button
            onClick={handlePrevious}
            className="mobile-calendar-native__nav-btn p-2 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button
            onClick={handleToday}
            className="mobile-calendar-native__today-btn px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          >
            Heute
          </button>
          <button
            onClick={handleNext}
            className="mobile-calendar-native__nav-btn p-2 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <h2 className="mobile-calendar-native__title text-lg font-bold text-slate-900">
          {format(currentDate, viewType === VIEW_TYPES.MONTH ? 'MMMM yyyy' : 'MMM yyyy', { locale: de })}
        </h2>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`mobile-calendar-native__filter-btn p-2 rounded-xl transition-all active:scale-95 ${showFilters ? 'bg-blue-100 text-blue-600 is-active' : 'hover:bg-slate-100 text-slate-600'}`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* View switcher */}
      <div className="mobile-calendar-native__views flex gap-1 p-2 bg-slate-50">
        <button
          onClick={() => setViewType(VIEW_TYPES.DAY)}
          className={`mobile-calendar-native__view-btn flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
            viewType === VIEW_TYPES.DAY
              ? 'bg-white shadow text-blue-600 is-active'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          Tag
        </button>
        <button
          onClick={() => setViewType(VIEW_TYPES.WEEK)}
          className={`mobile-calendar-native__view-btn flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
            viewType === VIEW_TYPES.WEEK
              ? 'bg-white shadow text-blue-600 is-active'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          Woche
        </button>
        <button
          onClick={() => setViewType(VIEW_TYPES.MONTH)}
          className={`mobile-calendar-native__view-btn flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
            viewType === VIEW_TYPES.MONTH
              ? 'bg-white shadow text-blue-600 is-active'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          Monat
        </button>
        <button
          onClick={() => setViewType(VIEW_TYPES.LIST)}
          className={`mobile-calendar-native__view-btn flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
            viewType === VIEW_TYPES.LIST
              ? 'bg-white shadow text-blue-600 is-active'
              : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          Liste
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mobile-calendar-native__filters p-2 bg-white border-t border-slate-100">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {eventTypes.map(type => (
              <button
                key={type.value || 'all'}
                onClick={() => setSelectedEventType(type.value)}
                className={`mobile-calendar-native__filter-chip px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedEventType === type.value
                    ? `${type.color} shadow is-active`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
      <div className="mobile-calendar-native__month-view bg-white">
        {/* Week days header */}
        <div className="mobile-calendar-native__weekdays grid grid-cols-7 border-b border-slate-200">
          {weekDays.map(day => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-slate-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar container */}
        <div className="relative">
          <div className="mobile-calendar-native__month-grid grid grid-cols-7 gap-0 bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    mobile-calendar-native__day min-h-[85px] p-1.5 border-r border-b border-slate-100
                    text-left relative
                    ${!isCurrentMonth ? 'bg-slate-50/30 text-slate-400 is-outside' : 'bg-white'}
                    ${isCurrentDay ? 'is-today' : ''}
                    ${hasEvents ? 'has-events' : ''}
                    last:border-r-0 [&:nth-child(7n)]:border-r-0
                    [&:nth-last-child(-n+7)]:border-b-0
                  `}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewType(VIEW_TYPES.DAY);
                    onDateChange?.(day);
                    onViewChange?.(VIEW_TYPES.DAY);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setCurrentDate(day);
                      setViewType(VIEW_TYPES.DAY);
                      onDateChange?.(day);
                      onViewChange?.(VIEW_TYPES.DAY);
                    }
                  }}
                >
                  {/* Day number */}
                  <div className="relative z-10 mb-1">
                    <span className={`inline-flex h-7 w-7 items-center justify-center text-sm font-semibold rounded-full transition-all ${
                      isCurrentDay
                        ? 'bg-red-500 text-white shadow-md'
                        : 'text-slate-700'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {hasEvents && (
                    <div className="mobile-calendar-native__day-events">
                      {dayEvents.slice(0, 2).map((event) => {
                        const eventColor = event.color || '#3b82f6';
                        const chipStyle = {
                          backgroundColor: toRgba(eventColor, 0.16) || 'rgba(59, 130, 246, 0.16)',
                          borderColor: toRgba(eventColor, 0.35) || 'rgba(59, 130, 246, 0.35)',
                          color: eventColor
                        };
                        return (
                          <button
                            key={`day-${day.toISOString()}-${event.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className="mobile-calendar-native__event-chip"
                            style={chipStyle}
                          >
                            <span className="truncate">{event.title}</span>
                          </button>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="mobile-calendar-native__event-more">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      const dateA = a.start instanceof Date ? a.start : new Date(a.start);
      const dateB = b.start instanceof Date ? b.start : new Date(b.start);
      return dateA - dateB;
    });

    const today = startOfDay(new Date());
    const upcomingEvents = sortedEvents.filter(e => {
      const eventStart = e.start instanceof Date ? e.start : parseISO(e.start);
      const eventEnd = e.end ? (e.end instanceof Date ? e.end : parseISO(e.end)) : eventStart;
      // Show event if it starts today or later, OR if it's a multi-day event that hasn't ended yet
      return startOfDay(eventStart) >= today ||
             (startOfDay(eventEnd) >= today && !isSameDay(eventStart, eventEnd));
    });

    return (
      <div className="mobile-calendar-native__list-view bg-white">
        <div className="mobile-calendar-native__section-header p-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">
            Anstehende Termine ({upcomingEvents.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Keine anstehenden Termine</p>
            </div>
          ) : (
            upcomingEvents.map(event => {
              const eventStart = event.start instanceof Date ? event.start : parseISO(event.start);
              const eventEnd = event.end ? (event.end instanceof Date ? event.end : parseISO(event.end)) : eventStart;
              const isMultiDay = !isSameDay(eventStart, eventEnd);
              const eventColor = event.color || '#3b82f6';
              const eventType = event.event_type || event.type;
              const pillStyle = {
                backgroundColor: toRgba(eventColor, 0.14) || 'rgba(59, 130, 246, 0.14)',
                borderColor: toRgba(eventColor, 0.32) || 'rgba(59, 130, 246, 0.32)',
                color: eventColor
              };

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="mobile-calendar-native__list-item w-full p-4 hover:bg-slate-50 active:bg-slate-100 transition-all text-left border-l-4"
                  style={{ borderLeftColor: eventColor }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: eventColor }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="mobile-calendar-native__event-title font-semibold text-slate-900 truncate flex-1">
                          {event.title}
                        </h4>
                        {isMultiDay && (
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold flex-shrink-0">
                            {format(eventStart, 'd.M.')} – {format(eventEnd, 'd.M.')}
                          </span>
                        )}
                      </div>

                      {eventType && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="mobile-calendar-native__event-type"
                            style={pillStyle}
                          >
                            {eventType}
                          </span>
                        </div>
                      )}

                      <div className="mobile-calendar-native__event-meta flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(eventStart, isMultiDay ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm')}
                        </span>

                        {event.location && (
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                      </div>

                      {(event.created_by_name || event.createdByName) && (
                        <div className="mobile-calendar-native__event-meta mobile-calendar-native__event-meta--creator mt-1.5 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Erstellt von {event.created_by_name || event.createdByName}</span>
                        </div>
                      )}

                      {event.description && (
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 self-center" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="mobile-calendar-native__week-view bg-white">
        <div className="divide-y divide-slate-100">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div key={day.toISOString()} className="mobile-calendar-native__week-day p-3">
                <div className={`flex items-center justify-between mb-2 ${
                  isCurrentDay ? 'text-blue-600' : 'text-slate-900'
                }`}>
                  <span className="font-semibold">
                    {format(day, 'EEEE', { locale: de })}
                  </span>
                  <span className="text-sm">
                    {format(day, 'dd.MM')}
                  </span>
                </div>

                {dayEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Keine Termine</p>
                ) : (
                  <div className="space-y-1">
                    {dayEvents.map(event => {
                      const eventType = event.event_type || event.type;
                      const eventColor = event.color || '#3b82f6';
                      const pillStyle = {
                        backgroundColor: toRgba(eventColor, 0.14) || 'rgba(59, 130, 246, 0.14)',
                        borderColor: toRgba(eventColor, 0.32) || 'rgba(59, 130, 246, 0.32)',
                        color: eventColor
                      };
                      return (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="mobile-calendar-native__week-event w-full text-left transition"
                          style={{
                            borderLeftColor: eventColor,
                            backgroundColor: toRgba(eventColor, 0.08) || 'rgba(59, 130, 246, 0.08)'
                          }}
                        >
                          <div className="mobile-calendar-native__week-event-row">
                            <span className="mobile-calendar-native__week-event-title">{event.title}</span>
                            {eventType && (
                              <span className="mobile-calendar-native__event-type" style={pillStyle}>
                                {eventType}
                              </span>
                            )}
                          </div>
                          <div className="mobile-calendar-native__event-meta">
                            <Clock className="w-3.5 h-3.5" />
                            {!event.all_day ? (
                              <span>
                                {format(
                                  event.start instanceof Date ? event.start : parseISO(event.start),
                                  'HH:mm'
                                )}
                              </span>
                            ) : (
                              <span>Ganztägig</span>
                            )}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render day view
  const renderDayView = () => {
    const dayEvents = getEventsForDay(currentDate);

    return (
      <div className="mobile-calendar-native__day-view bg-white">
        <div className="mobile-calendar-native__section-header p-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">
            {format(currentDate, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </h3>
          {dayEvents.length > 0 && (
            <p className="text-sm text-slate-600 mt-1">
              {dayEvents.length} {dayEvents.length === 1 ? 'Termin' : 'Termine'}
            </p>
          )}
          <button
            type="button"
            onClick={handleOpenWorkHoursToday}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold uppercase tracking-wide"
          >
            Arbeitsstunden heute
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Keine Termine für diesen Tag</p>
            <button
              onClick={() => onEventCreate?.({ start: currentDate })}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              Termin hinzufügen
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dayEvents.map(event => {
              const eventType = event.event_type || event.type;
              const eventColor = event.color || '#3b82f6';
              const pillStyle = {
                backgroundColor: toRgba(eventColor, 0.14) || 'rgba(59, 130, 246, 0.14)',
                borderColor: toRgba(eventColor, 0.32) || 'rgba(59, 130, 246, 0.32)',
                color: eventColor
              };
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="mobile-calendar-native__day-event w-full p-3 hover:bg-slate-50 transition text-left"
                  style={{ borderLeftColor: eventColor }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      mt-1 w-3 h-3 rounded-full flex-shrink-0
                      ${eventType === 'Arbeit' ? 'bg-sky-500' :
                        eventType === 'Meeting' ? 'bg-indigo-500' :
                        eventType === 'Urlaub' ? 'bg-amber-500' :
                        eventType === 'Krankheit' ? 'bg-rose-500' :
                        'bg-slate-500'}
                    `} />
                    <div className="flex-1">
                      <h4 className="mobile-calendar-native__event-title font-semibold text-slate-900">
                        {event.title}
                      </h4>
                      {eventType && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span
                            className="mobile-calendar-native__event-type"
                            style={pillStyle}
                          >
                            {eventType}
                          </span>
                        </div>
                      )}
                      {!event.all_day && (
                        <div className="mobile-calendar-native__event-meta flex items-center gap-1 mt-2">
                          <Clock className="w-4 h-4" />
                          {format(
                            event.start instanceof Date ? event.start : parseISO(event.start),
                            'HH:mm'
                          )} - {format(
                            event.end instanceof Date ? event.end : parseISO(event.end),
                            'HH:mm'
                          )}
                        </div>
                      )}
                      {event.location && (
                        <div className="mobile-calendar-native__event-meta flex items-center gap-1 mt-2">
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </div>
                      )}
                      {(event.created_by_name || event.createdByName) && (
                        <div className="mobile-calendar-native__event-meta mobile-calendar-native__event-meta--creator flex items-center gap-1 mt-2">
                          <User className="w-4 h-4" />
                          Erstellt von {event.created_by_name || event.createdByName}
                        </div>
                      )}
                      {event.description && (
                        <p className="mt-2 text-sm text-slate-500 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render based on view type
  const renderView = () => {
    switch (viewType) {
      case VIEW_TYPES.DAY:
        return renderDayView();
      case VIEW_TYPES.WEEK:
        return renderWeekView();
      case VIEW_TYPES.MONTH:
        return renderMonthView();
      case VIEW_TYPES.LIST:
        return renderListView();
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="mobile-calendar-native flex flex-col h-full bg-slate-50">
      {renderHeader()}

      <div className="mobile-calendar-native__content flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          renderView()
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => onEventCreate?.({ start: currentDate })}
        className="mobile-calendar-native__fab fixed bottom-20 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition flex items-center justify-center z-10"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default MobileCalendarEnhanced;
