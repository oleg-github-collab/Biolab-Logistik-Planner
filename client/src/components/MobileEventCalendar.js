import React, { useMemo, useCallback, useState } from 'react';
import {
  addDays,
  addMinutes,
  format,
  startOfDay,
  startOfWeek,
  isToday
} from 'date-fns';
import { safeParseDate, safeFormat, safeEventDates, formatTimeRange } from '../utils/dateHelpers';

const QUICK_SLOTS = [
  { label: 'Früh', time: '08:00' },
  { label: 'Mittag', time: '12:00' },
  { label: 'Nachmittag', time: '15:00' },
  { label: 'Abend', time: '18:00' }
];

const SLOT_DURATION_MINUTES = 60;
const SLOT_LIMIT = 4;

const normalizeDayKey = (date) => format(date, 'yyyy-MM-dd');

const MobileEventCalendar = ({ events = [], onSlotSelect, onDaySelect, onEventClick }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const baseWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = addDays(baseWeekStart, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);

  const weekDays = useMemo(() => {
    const days = [];
    for (let index = 0; index < 7; index += 1) {
      days.push(addDays(weekStart, index));
    }
    return days;
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const { validStart } = safeEventDates(event);
      const key = normalizeDayKey(validStart);

      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(event);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const { validStart: aStart } = safeEventDates(a);
        const { validStart: bStart } = safeEventDates(b);
        return aStart - bStart;
      });
    });
    return map;
  }, [events]);

  const handleSlotSelect = useCallback((day, slot) => {
    if (!onSlotSelect) return;
    const [hours, minutes] = slot.split(':').map(Number);
    const start = startOfDay(day);
    start.setHours(hours, minutes, 0, 0);
    const end = addMinutes(start, SLOT_DURATION_MINUTES);
    onSlotSelect({ start, end });
  }, [onSlotSelect]);

  const handleDayQuickCreate = useCallback((day) => {
    if (!onDaySelect) return;
    const start = startOfDay(day);
    start.setHours(9, 0, 0, 0);
    onDaySelect({ start });
  }, [onDaySelect]);

  const renderEventBadge = (event, index, fallbackKey) => {
    const { validStart, validEnd } = safeEventDates(event);
    const timeDisplay = formatTimeRange(validStart, validEnd, event.all_day);

    return (
      <button
        type="button"
        key={event.id || `${fallbackKey}-${index}`}
        onClick={() => onEventClick?.(event)}
        className="mobile-event-calendar__event"
      >
        <div className="mobile-event-calendar__event-time">
          {timeDisplay}
        </div>
        <p className="mobile-event-calendar__event-title">{event.title || 'Neuer Termin'}</p>
        {event.type && (
          <span className="mobile-event-calendar__event-chip">{event.type}</span>
        )}
      </button>
    );
  };

  return (
    <section className="mobile-event-calendar">
      <header className="mobile-event-calendar__header">
        <div className="mobile-event-calendar__headline">
          <p className="mobile-event-calendar__label">Komplette Woche</p>
          <h2 className="mobile-event-calendar__title">
            {format(weekStart, 'dd.MMM')} – {format(weekEnd, 'dd.MMM.yyyy')}
          </h2>
        </div>
        <div className="mobile-event-calendar__nav">
          <button type="button" onClick={() => setWeekOffset((prev) => prev - 1)}>←</button>
          <button type="button" onClick={() => setWeekOffset(0)} className="mobile-event-calendar__nav-today">
            Diese Woche
          </button>
          <button type="button" onClick={() => setWeekOffset((prev) => prev + 1)}>→</button>
        </div>
      </header>

      <div className="mobile-event-calendar__grid">
        {weekDays.map((day) => {
          const key = normalizeDayKey(day);
          const dayEvents = eventsByDay[key] || [];
          return (
            <article key={key} className="mobile-event-calendar__day-card">
              <div className="mobile-event-calendar__day-top">
                <div>
                  <p className="mobile-event-calendar__day-label">{format(day, 'eee')}</p>
                  <p className="mobile-event-calendar__day-date">{format(day, 'dd.MM')}</p>
                </div>
                {isToday(day) && (
                  <span className="mobile-event-calendar__day-badge">Heute</span>
                )}
              </div>
              <div className="mobile-event-calendar__events">
                {dayEvents.length ? dayEvents.slice(0, SLOT_LIMIT).map((event, index) => renderEventBadge(event, index, key))
                  : (
                    <p className="mobile-event-calendar__events-empty">
                      Keine Termine
                    </p>
                  )}
              </div>
              <div className="mobile-event-calendar__actions">
                <button
                  type="button"
                  onClick={() => handleDayQuickCreate(day)}
                  className="mobile-event-calendar__action"
                >
                  + Tag öffnen
                </button>
                <div className="mobile-event-calendar__slots">
                  {QUICK_SLOTS.map((slot) => (
                    <button
                      type="button"
                      key={`${key}-${slot.time}`}
                      onClick={() => handleSlotSelect(day, slot.time)}
                      className="mobile-event-calendar__slot"
                    >
                      <span>{slot.label}</span>
                      <span>{slot.time}</span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default MobileEventCalendar;
