import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks
} from 'date-fns';
import { de } from 'date-fns/locale';

const VIEW_OPTIONS = [
  { id: 'day', label: 'Tag' },
  { id: 'week', label: 'Woche' },
  { id: 'month', label: 'Monat' },
  { id: 'agenda', label: 'Agenda' }
];

const SLOT_INTERVAL = 30; // minutes
const BASE_SLOT_HEIGHT = 44; // px per slot
const START_HOUR = 6;
const END_HOUR = 22;
const MOBILE_DAY_CARD_MAX_WIDTH = 360;
const MOBILE_TIME_GUTTER = 48;

const AdvancedCalendar = ({
  events = [],
  view = 'week',
  selectedDate = new Date(),
  onViewChange,
  onRangeChange,
  onEventClick,
  onEventCreate,
  onEventMove,
  onEventResize,
  onDateSelect
}) => {
  const [currentDate, setCurrentDate] = useState(selectedDate ?? new Date());
  const [internalView, setInternalView] = useState(view);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [quickCreateState, setQuickCreateState] = useState({ visible: false, date: null, time: null, anchor: { x: 0, y: 0 } });

  // Determine active view (controlled vs uncontrolled mode)
  const activeView = view ?? internalView;

  useEffect(() => {
    setInternalView(view);
  }, [view]);

  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(selectedDate instanceof Date ? selectedDate : parseISO(selectedDate));
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!view && isMobile && activeView === 'month') {
      setInternalView('agenda');
      onViewChange?.('agenda');
    }
  }, [isMobile, view, activeView, onViewChange]);

  // Build list of time slots
  const slotHeight = isMobile ? BASE_SLOT_HEIGHT + 8 : BASE_SLOT_HEIGHT;

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_INTERVAL) {
        slots.push({
          hour,
          minute,
          label: format(setMinutesAndHours(hour, minute), 'HH:mm')
        });
      }
    }
    return slots;
  }, []);

  const totalGridHeight = timeSlots.length * slotHeight;
  const hourMarks = useMemo(() => timeSlots.filter((slot) => slot.minute === 0), [timeSlots]);
  const gridViewportHeight = useMemo(
    () => (isMobile ? 'calc(100svh - 220px)' : 'calc(100vh - 320px)'),
    [isMobile]
  );
  const monthGridStyle = useMemo(
    () => (isMobile ? { maxHeight: gridViewportHeight, overflowY: 'auto' } : {}),
    [isMobile, gridViewportHeight]
  );

  // Normalise incoming events once per render
  const normalisedEvents = useMemo(() => {
    return events
      .map((event) => normaliseEvent(event))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events]);

  const allDayEvents = useMemo(
    () => normalisedEvents.filter((event) => event.allDay || !isSameDay(event.start, event.end)),
    [normalisedEvents]
  );

  const timedEvents = useMemo(
    () => normalisedEvents.filter((event) => !event.allDay && isSameDay(event.start, event.end)),
    [normalisedEvents]
  );

  // Compute calendar dates for current view
  const calendarDates = useMemo(() => {
    const baseDate = currentDate instanceof Date ? currentDate : parseISO(currentDate);

    switch (activeView) {
      case 'day':
        return [baseDate];
      case 'week': {
        const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
      }
      case 'month': {
        const start = startOfWeek(startOfMonth(baseDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(baseDate), { weekStartsOn: 1 });
        const days = [];
        let cursor = start;
        while (cursor <= end) {
          days.push(cursor);
          cursor = addDays(cursor, 1);
        }
        return days;
      }
      case 'agenda': {
        const start = startOfWeek(baseDate, { weekStartsOn: 1 });
        return Array.from({ length: 14 }, (_, idx) => addDays(start, idx));
      }
      default:
        return [baseDate];
    }
  }, [currentDate, activeView]);

  // Notify consumers whenever visible range changes
  useEffect(() => {
    if (!onRangeChange) return;

    if (calendarDates.length) {
      const rangeStart = startOfDay(calendarDates[0]);
      const rangeEnd = endOfDay(calendarDates[calendarDates.length - 1]);
      onRangeChange({ start: rangeStart, end: rangeEnd, view: activeView });
    }
  }, [calendarDates, onRangeChange, activeView]);

  const handleViewChange = (nextView) => {
    if (activeView === nextView) return;
    setInternalView(nextView);
    onViewChange?.(nextView);
  };

  const navigate = (direction) => {
    const step = direction === 'next' ? 1 : -1;
    switch (activeView) {
      case 'day':
        setCurrentDate((prev) => addDays(prev, step));
        break;
      case 'week':
        setCurrentDate((prev) => addWeeks(prev, step));
        break;
      case 'month':
        setCurrentDate((prev) => (step > 0 ? addMonths(prev, 1) : subMonths(prev, 1)));
        break;
      case 'agenda':
        setCurrentDate((prev) => addWeeks(prev, step));
        break;
      default:
        break;
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect?.(today);
  };

  const openQuickCreate = (date, slot, clientX, clientY) => {
    setQuickCreateState({
      visible: true,
      date,
      time: slot,
      anchor: { x: clientX, y: clientY }
    });
  };

  const closeQuickCreate = () => {
    setQuickCreateState({ visible: false, date: null, time: null, anchor: { x: 0, y: 0 } });
  };

  const handleQuickCreate = (data) => {
    onEventCreate?.(data);
    closeQuickCreate();
  };

  const renderToolbar = () => {
    const firstDay = calendarDates[0];
    const lastDay = calendarDates[calendarDates.length - 1];
    const availableViews = isMobile
      ? VIEW_OPTIONS.filter((option) => option.id !== 'month')
      : VIEW_OPTIONS;

    const rangeLabel = (() => {
      switch (activeView) {
        case 'day':
          return format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de });
        case 'week':
          return `${format(firstDay, 'd. MMM', { locale: de })} – ${format(lastDay, 'd. MMM yyyy', { locale: de })}`;
        case 'month':
          return format(currentDate, 'MMMM yyyy', { locale: de });
        case 'agenda':
          return `${format(firstDay, 'd. MMM', { locale: de })} – ${format(lastDay, 'd. MMM yyyy', { locale: de })}`;
        default:
          return format(currentDate, 'MMMM yyyy', { locale: de });
      }
    })();

    return (
      <div
        className={`rounded-2xl bg-gradient-to-r from-blue-50 via-white to-purple-50 border border-blue-100 px-4 py-3 shadow-sm ${
          isMobile ? 'flex flex-col gap-3' : 'grid grid-cols-[auto,1fr,auto] items-center gap-4'
        }`}
      >
        <div className={`flex items-center gap-2 ${isMobile ? 'justify-between w-full' : ''}`}>
          <button
            onClick={() => navigate('prev')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:-translate-x-[1px] hover:shadow-md transition"
            aria-label="Vorheriger Zeitraum"
          >
            <span className="text-lg">‹</span>
          </button>
          <button
            onClick={goToToday}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
          >
            Heute
          </button>
          <button
            onClick={() => navigate('next')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:translate-x-[1px] hover:shadow-md transition"
            aria-label="Nächster Zeitraum"
          >
            <span className="text-lg">›</span>
          </button>
        </div>

        <div className={`text-lg font-semibold text-slate-900 ${isMobile ? 'text-center w-full' : ''}`}>
          {rangeLabel}
        </div>

        <div
          className={`flex items-center gap-2 rounded-full bg-white p-1 shadow-inner overflow-x-auto ${
            isMobile ? 'w-full' : ''
          }`}
        >
          {availableViews.map((option) => (
            <button
              key={option.id}
              onClick={() => handleViewChange(option.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                activeView === option.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:bg-blue-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderAllDayRow = () => {
    if (!['day', 'week'].includes(activeView)) return null;

    return (
      <div
        className={`border-b border-slate-200 ${
          isMobile ? '-mx-2 bg-transparent px-2 pb-2' : 'flex bg-slate-50'
        }`}
      >
        {!isMobile && (
          <div className="hidden w-20 border-r border-slate-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:block">
            Ganztägig
          </div>
        )}
        <div className={`flex flex-1 ${isMobile ? 'gap-3 overflow-x-auto snap-x snap-mandatory' : ''}`}>
          {calendarDates.map((date) => {
            const dayEvents = allDayEvents.filter((event) => isSameDay(event.start, date) || isWithinMultiDay(event, date));
            const baseClasses = isMobile
              ? 'flex-shrink-0 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-3 shadow-sm snap-center'
              : 'min-h-[64px] flex-1 border-r border-slate-200 p-2';
            const highlightClasses = isToday(date)
              ? isMobile
                ? 'ring-2 ring-blue-200 bg-blue-50/80'
                : 'bg-blue-50/60'
              : 'bg-transparent';

            return (
              <div
                key={date.toISOString()}
                className={`${baseClasses} ${highlightClasses}`}
                style={{ width: isMobile ? `min(88vw, ${MOBILE_DAY_CARD_MAX_WIDTH}px)` : undefined }}
              >
                <div className="flex flex-wrap gap-2">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id + event.start.toISOString()}
                      onClick={() => onEventClick?.(event)}
                      className="group flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      style={{
                        backgroundColor: event.color,
                        color: event.textColor
                      }}
                    >
                      <span className="truncate">{event.title}</span>
                      {event.end && !isSameDay(event.start, event.end) && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                          {format(event.start, 'd.M.')} – {format(event.end, 'd.M.')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimedGrid = () => {
    const hourBlockHeight = (60 / SLOT_INTERVAL) * slotHeight;

    return (
      <div
        className={`flex flex-1 ${
          isMobile ? 'overflow-x-auto snap-x snap-mandatory gap-4 px-2 pb-6 -mx-2' : 'overflow-hidden'
        }`}
        style={{ maxHeight: gridViewportHeight }}
      >
        {/* Time column (desktop) */}
        {!isMobile && (
          <div className="hidden w-20 flex-shrink-0 border-r border-slate-200 bg-white md:block">
            <div className="h-16" />
            {timeSlots.map((slot) => (
              <div
                key={`${slot.hour}-${slot.minute}`}
                className={`flex items-start justify-end border-b border-slate-100 pr-2 text-[11px] text-slate-400 ${
                  slot.minute === 0 ? 'font-semibold text-slate-500' : ''
                }`}
                style={{ height: slotHeight }}
              >
                {slot.minute === 0 ? slot.label : ''}
              </div>
            ))}
          </div>
        )}

        {/* Day columns */}
        <div
          className={`flex flex-1 ${isMobile ? 'gap-4' : 'overflow-auto'}`}
          style={{ maxHeight: gridViewportHeight, overflowY: 'auto' }}
        >
          {calendarDates.map((date) => {
            const dayTimedEvents = layoutEventsForDay(
              timedEvents.filter((event) => isSameDay(event.start, date))
            );

            const columnClasses = isMobile
              ? 'relative flex-shrink-0 snap-center rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden'
              : 'relative flex-1 border-r border-slate-100';

            const columnStyle = isMobile
              ? { width: `min(90vw, ${MOBILE_DAY_CARD_MAX_WIDTH}px)` }
              : undefined;

            return (
              <div key={date.toISOString()} className={columnClasses} style={columnStyle}>
                <DayColumnHeader date={date} isMobile={isMobile} />

                <div
                  className="relative"
                  style={{
                    minHeight: totalGridHeight,
                    paddingLeft: isMobile ? MOBILE_TIME_GUTTER : 0
                  }}
                >
                  {isMobile && (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 border-r border-slate-100 bg-gradient-to-b from-white/85 to-transparent"
                      style={{ width: MOBILE_TIME_GUTTER }}
                    >
                      {hourMarks.map((slot) => (
                        <div
                          key={`${date.toDateString()}-${slot.label}`}
                          className="flex items-start justify-end pr-2 text-[10px] font-semibold text-slate-400"
                          style={{ height: hourBlockHeight }}
                        >
                          {slot.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {timeSlots.map((slot) => {
                    const slotKey = `${date.toDateString()}-${slot.label}`;
                    const slotDate = setMinutesAndHours(slot.hour, slot.minute, date);

                    return (
                      <div
                        key={slotKey}
                        className={`border-b border-slate-100 transition ${
                          hoveredSlot === slotKey ? 'bg-blue-100/40' : 'hover:bg-blue-50/60'
                        }`}
                        style={{ height: slotHeight }}
                        onMouseEnter={() => setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                        onDoubleClick={(e) => openQuickCreate(date, slot, e.clientX, e.clientY)}
                        onClick={() => onDateSelect?.(slotDate)}
                        role="button"
                        tabIndex={0}
                      />
                    );
                  })}

                  {dayTimedEvents.map((event) => {
                    const { top, height, width, offsetLeft } = computeEventPosition(event, slotHeight);

                    return (
                      <div
                        key={`${event.id}-${event.start.toISOString()}`}
                        className="absolute overflow-hidden rounded-lg border border-white/20 shadow-md transition hover:z-30 hover:shadow-lg"
                        style={{
                          top,
                          height,
                          left: `${offsetLeft * 100}%`,
                          width: `${width * 100}%`,
                          backgroundColor: event.color,
                          color: event.textColor
                        }}
                        onClick={() => onEventClick?.(event)}
                        title={`${event.title} (${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')})`}
                      >
                        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold">
                          <span className="truncate text-sm leading-tight">{event.title}</span>
                          {event.location && (
                            <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                              {event.location}
                            </span>
                          )}
                        </div>
                        <div className="px-3 pb-3 text-[11px] opacity-90">
                          {format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}
                        </div>
                      </div>
                    );
                  })}

                  <CurrentTimeIndicator referenceDate={date} slotHeight={slotHeight} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {renderAllDayRow()}
      {renderTimedGrid()}
    </div>
  );

  const renderDayView = () => (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {renderAllDayRow()}
      {renderTimedGrid()}
    </div>
  );

  const renderMonthView = () => (
    <div
      className="grid h-full flex-1 grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={monthGridStyle}
    >
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
        <div key={day} className="border-b border-slate-100 bg-slate-50 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {day}
        </div>
      ))}

      {calendarDates.map((date) => {
        const dayEvents = normalisedEvents.filter((event) =>
          isSameDay(event.start, date) || isWithinMultiDay(event, date)
        );
        const isMuted = !isSameMonth(date, currentDate);

        return (
          <div
            key={date.toISOString()}
            className={`border-b border-r border-slate-100 p-2 transition hover:bg-blue-50/60 ${
              isMuted ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-600'
            } ${isToday(date) ? 'border-blue-200 bg-blue-50/70' : ''}`}
            style={{ minHeight: isMobile ? 110 : 140 }}
            onClick={() => onDateSelect?.(date)}
            onDoubleClick={(e) => openQuickCreate(date, null, e.clientX, e.clientY)}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday(date) ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
              >
                {format(date, 'd')}
              </span>
              {dayEvents.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {dayEvents.length}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => {
                const isMultiDay = event.end && !isSameDay(event.start, event.end);
                const isStartDay = isSameDay(event.start, date);
                const isEndDay = isSameDay(event.end, date);
                const isContinuing = isMultiDay && !isStartDay && !isEndDay;

                return (
                  <button
                    key={`${event.id}-${event.start.toISOString()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className="flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-[11px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow relative"
                    style={{ backgroundColor: event.color, color: event.textColor }}
                  >
                    {isMultiDay && (
                      <span className="text-[9px] opacity-75">
                        {isStartDay ? '▶' : isContinuing ? '━' : '◀'}
                      </span>
                    )}
                    <span className="truncate flex-1">{event.title}</span>
                  </button>
                );
              })}

              {dayEvents.length > 3 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateSelect?.(date);
                  }}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  +{dayEvents.length - 3} weitere
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderAgendaView = () => (
    <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {calendarDates.map((date) => {
          const dayEvents = normalisedEvents.filter((event) =>
            isSameDay(event.start, date) || isWithinMultiDay(event, date)
          );

          return (
            <div key={date.toISOString()} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
              <div className="flex w-40 flex-shrink-0 items-center gap-2">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    isToday(date)
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {format(date, 'd')}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {format(date, 'EEEE', { locale: de })}
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    {format(date, 'd. MMM', { locale: de })}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {dayEvents.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                    Keine Termine – Tippe, um einen hinzuzufügen
                  </div>
                )}

                {dayEvents.map((event) => {
                  const isMultiDay = event.end && !isSameDay(event.start, event.end);
                  const isStartDay = isSameDay(event.start, date);
                  const isEndDay = isSameDay(event.end, date);

                  return (
                    <button
                      key={`${event.id}-${event.start.toISOString()}`}
                      onClick={() => onEventClick?.(event)}
                      className="flex w-full flex-col gap-1 rounded-xl border border-transparent px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      style={{ backgroundColor: `${event.color}1A` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isMultiDay && (
                            <span className="text-xs opacity-60 flex-shrink-0">
                              {isStartDay ? '▶' : isEndDay ? '◀' : '━'}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-slate-700 truncate">{event.title}</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex-shrink-0">
                          {event.type}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        {event.allDay || isMultiDay
                          ? isMultiDay
                            ? `${format(event.start, 'd.M.')} – ${format(event.end, 'd.M.')}`
                            : 'Ganztägig'
                          : `${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`}
                      </div>
                    {event.location && (
                      <div className="text-xs text-slate-500">📍 {event.location}</div>
                    )}
                    {event.description && (
                      <div className="text-xs text-slate-500 line-clamp-2">{event.description}</div>
                    )}
                  </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="advanced-calendar flex h-full flex-col gap-3 lg:gap-4">
      {renderToolbar()}

      <div className="relative flex-1 overflow-hidden">
        {activeView === 'day' && renderDayView()}
        {activeView === 'week' && renderWeekView()}
        {activeView === 'month' && renderMonthView()}
        {activeView === 'agenda' && renderAgendaView()}

        <button
          onClick={() => onEventCreate?.({
            start: new Date(),
            end: addMinutes(new Date(), 60),
            all_day: false
          })}
          className="group absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition hover:scale-[1.03] hover:bg-blue-500"
          aria-label="Neuen Termin anlegen"
        >
          <span className="text-2xl">＋</span>
        </button>
      </div>

      {quickCreateState.visible && (
        <QuickCreatePopover
          anchor={quickCreateState.anchor}
          date={quickCreateState.date}
          slot={quickCreateState.time}
          onClose={closeQuickCreate}
          onConfirm={handleQuickCreate}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

const DayColumnHeader = ({ date, isMobile }) => (
  <div
    className={`sticky top-0 z-20 flex h-16 flex-col items-center justify-center border-b border-slate-200 bg-white/95 backdrop-blur ${
      isToday(date) ? 'bg-blue-50/80 text-blue-700' : 'text-slate-600'
    }`}
  >
    <div className="text-xs font-semibold uppercase tracking-wide">
      {format(date, isMobile ? 'EEE' : 'EEEE', { locale: de })}
    </div>
    <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold ${
      isToday(date) ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-800'
    }`}>
      {format(date, 'd')}
    </div>
  </div>
);

const CurrentTimeIndicator = ({ referenceDate, slotHeight }) => {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      if (!isSameDay(now, referenceDate)) {
        setPosition(null);
        return;
      }

      const minutesFromStart = differenceInMinutes(now, startOfDay(referenceDate));
      const top = (minutesFromStart / SLOT_INTERVAL) * slotHeight;
      setPosition(top);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [referenceDate]);

  if (position === null || position < 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: position }}
    >
      <div className="h-px flex-1 bg-red-400" />
      <div className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
        Jetzt
      </div>
    </div>
  );
};

const QuickCreatePopover = ({ anchor, date, slot, onClose, onConfirm, isMobile }) => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [type, setType] = useState('Meeting');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const start = slot
      ? setMinutesAndHours(slot.hour, slot.minute, date)
      : startOfDay(date);
    const end = addMinutes(start, duration);

    onConfirm?.({
      title: title.trim(),
      start,
      end,
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
      start_time: format(start, 'HH:mm'),
      end_time: format(end, 'HH:mm'),
      type,
      all_day: false
    });
  };

  const getDesktopPosition = () => {
    if (typeof window === 'undefined') {
      return {
        left: anchor?.x ?? 0,
        top: anchor?.y ?? 0,
        width: 320
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = 320;
    const height = 320;
    const anchorX = anchor?.x ?? viewportWidth / 2;
    const anchorY = anchor?.y ?? viewportHeight / 2;

    const left = Math.max(16, Math.min(anchorX - width / 2, viewportWidth - width - 16));
    const top = Math.max(16, Math.min(anchorY - height / 2, viewportHeight - height - 16));

    return { left, top, width };
  };

  const getMobilePosition = () => {
    if (typeof window === 'undefined' || !anchor?.x || !anchor?.y) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 360px)'
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(viewportWidth * 0.92, 360);
    const height = 400; // Approximate modal height
    const anchorX = anchor.x;
    const anchorY = anchor.y;

    // Position near click but keep on screen
    const left = Math.max(16, Math.min(anchorX - width / 2, viewportWidth - width - 16));
    const top = Math.max(16, Math.min(anchorY + 20, viewportHeight - height - 16));

    return { left, top, width };
  };

  const style = isMobile ? getMobilePosition() : getDesktopPosition();

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]" style={{zIndex: 50000}} onClick={onClose} />
      <div
        className={`fixed rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ${
          isMobile ? 'max-h-[80vh] overflow-y-auto' : ''
        }`}
        style={{...style, zIndex: 50001}}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Titel
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            autoFocus
            placeholder="Besprechung..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Dauer (Minuten)
          </label>
          <input
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Typ
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="Meeting">Meeting</option>
            <option value="Arbeit">Arbeit</option>
            <option value="Urlaub">Urlaub</option>
            <option value="Krankheit">Krankheit</option>
            <option value="Deadline">Deadline</option>
            <option value="Projekt">Projekt</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
          >
            Speichern
          </button>
        </div>
        </form>
      </div>
    </>
  );
};

// --------------------- utility helpers ---------------------

const normaliseEvent = (event) => {
  const parseDate = (input) => {
    if (!input) return null;
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input;
    }
    if (typeof input === 'string') {
      const iso = input.includes('T') ? input : input.replace(' ', 'T');
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) {
        try {
          const parsedISO = parseISO(input);
          return Number.isNaN(parsedISO.getTime()) ? null : parsedISO;
        } catch {
          return null;
        }
      }
      return parsed;
    }
    return null;
  };

  const ensureDateTime = (dateValue, timeValue) => {
    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }
    if (!dateValue) return null;

    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      const parsed = new Date(dateValue);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      return null;
    }

    if (typeof dateValue === 'string' && timeValue) {
      const combined = new Date(`${dateValue}T${timeValue}`);
      return Number.isNaN(combined.getTime()) ? null : combined;
    }

    if (typeof dateValue === 'string') {
      const withTime = new Date(`${dateValue}T00:00:00`);
      return Number.isNaN(withTime.getTime()) ? null : withTime;
    }

    return null;
  };

  const start = ensureDateTime(event.start ?? event.start_date, event.start_time) ?? new Date();
  const end = ensureDateTime(event.end ?? event.end_date ?? event.start_date, event.end_time) ?? addMinutes(start, 60);

  // Final validation - ensure both dates are valid
  const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const validEnd = Number.isNaN(end.getTime()) ? addMinutes(validStart, 60) : end;

  const allDay = event.allDay ?? event.all_day ?? differenceInMinutes(validEnd, validStart) >= 24 * 60;
  const type = event.type || event.category || 'Arbeit';
  const color = event.color || getEventColor(type);
  const textColor = getTextColor(color);

  return {
    ...event,
    start: validStart,
    end: validEnd,
    allDay,
    all_day: allDay,
    start_date: event.start_date ?? format(validStart, 'yyyy-MM-dd'),
    end_date: event.end_date ?? format(validEnd, 'yyyy-MM-dd'),
    start_time: event.start_time ?? (allDay ? '' : format(validStart, 'HH:mm')),
    end_time: event.end_time ?? (allDay ? '' : format(validEnd, 'HH:mm')),
    color,
    textColor,
    durationMinutes: Math.max(30, differenceInMinutes(validEnd, validStart))
  };
};

const layoutEventsForDay = (dayEvents) => {
  if (dayEvents.length === 0) return [];

  const eventsWithLayout = dayEvents.map((event) => ({ ...event }));
  const columns = [];

  eventsWithLayout.forEach((event) => {
    let columnIndex = columns.findIndex((column) =>
      column.every((placedEvent) =>
        event.start.getTime() >= placedEvent.end.getTime() || event.end.getTime() <= placedEvent.start.getTime()
      )
    );

    if (columnIndex === -1) {
      columns.push([event]);
      columnIndex = columns.length - 1;
    } else {
      columns[columnIndex].push(event);
    }

    event._column = columnIndex;
    event._columnCount = Math.max(1, columns.length);
  });

  return eventsWithLayout;
};

const computeEventPosition = (event, slotHeight = BASE_SLOT_HEIGHT) => {
  const minutesFromStart = differenceInMinutes(event.start, startOfDay(event.start));
  const duration = Math.max(30, differenceInMinutes(event.end, event.start));

  const top = (minutesFromStart / SLOT_INTERVAL) * slotHeight;
  const height = (duration / SLOT_INTERVAL) * slotHeight;
  const width = 1 / (event._columnCount || 1);
  const offsetLeft = (event._column || 0) * width;

  return { top, height, width, offsetLeft };
};

const setMinutesAndHours = (hour, minute, baseDate = new Date()) => {
  const clone = new Date(baseDate);
  clone.setHours(hour, minute, 0, 0);
  return clone;
};

const isWithinMultiDay = (event, date) => {
  if (!event.start || !event.end) return false;
  return isAfter(date, event.start) && isBefore(date, event.end);
};

const getEventColor = (type = 'default') => {
  const colors = {
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
  return colors[type] || colors.default;
};

const getTextColor = (background) => {
  if (!background) return '#ffffff';
  const color = background.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? '#1f2937' : '#ffffff';
};

export default AdvancedCalendar;
