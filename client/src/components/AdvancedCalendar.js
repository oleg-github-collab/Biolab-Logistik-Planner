import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes
} from 'date-fns';
import { de } from 'date-fns/locale';

const AdvancedCalendar = ({
  events = [],
  onEventClick,
  onDateSelect,
  onEventCreate,
  selectedDate = new Date(),
  view = 'week' // 'day', 'week', 'month', 'year'
}) => {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEventStart, setNewEventStart] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddPosition, setQuickAddPosition] = useState({ x: 0, y: 0 });

  // Time slots for day/week view (30-minute intervals)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          hour,
          minute,
          label: format(setMinutes(setHours(new Date(), hour), minute), 'HH:mm')
        });
      }
    }
    return slots;
  }, []);

  // Generate calendar dates based on view
  const calendarDates = useMemo(() => {
    switch (view) {
      case 'day':
        return [currentDate];
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const start = startOfWeek(monthStart, { weekStartsOn: 1 });
        const end = addDays(start, 41); // 6 weeks
        return eachDayOfInterval({ start, end });
      case 'year':
        return Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(currentDate), i));
      default:
        return [currentDate];
    }
  }, [currentDate, view]);

  // Filter and position events for current view
  const processedEvents = useMemo(() => {
    return events
      .filter(event => {
        const eventDate = parseISO(event.date || event.start_date);
        if (view === 'month' || view === 'year') {
          return calendarDates.some(date =>
            isSameDay(eventDate, date) ||
            (view === 'year' && isSameMonth(eventDate, date))
          );
        }
        return calendarDates.some(date => isSameDay(eventDate, date));
      })
      .map(event => ({
        ...event,
        startTime: event.start_time || '09:00',
        endTime: event.end_time || '10:00',
        color: getEventColor(event),
        textColor: getTextColor(event),
        isAllDay: event.all_day || !event.start_time
      }));
  }, [events, calendarDates, view]);

  // Event color mapping
  const getEventColor = (event) => {
    const colorMap = {
      'Arbeit': '#10b981', // green
      'Meeting': '#3b82f6', // blue
      'Urlaub': '#8b5cf6', // purple
      'Krankheit': '#ef4444', // red
      'Training': '#f59e0b', // amber
      'Projekt': '#f97316', // orange
      'Termin': '#06b6d4', // cyan
      'Deadline': '#dc2626', // red-600
      'Personal': '#84cc16', // lime
      'default': '#6b7280' // gray
    };
    return colorMap[event.type] || colorMap[event.category] || colorMap.default;
  };

  const getTextColor = (event) => {
    const lightColors = ['#10b981', '#f59e0b', '#84cc16'];
    const bgColor = getEventColor(event);
    return lightColors.includes(bgColor) ? '#000000' : '#ffffff';
  };

  // Navigation functions
  const navigatePrevious = () => {
    switch (view) {
      case 'day':
        setCurrentDate(prev => addDays(prev, -1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case 'year':
        setCurrentDate(prev => subMonths(prev, 12));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'year':
        setCurrentDate(prev => addMonths(prev, 12));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Drag and drop handlers
  const handleDragStart = (event, e) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (date, timeSlot, e) => {
    e.preventDefault();
    if (draggedEvent) {
      const updatedEvent = {
        ...draggedEvent,
        date: format(date, 'yyyy-MM-dd'),
        start_time: timeSlot?.time || draggedEvent.start_time
      };
      onEventClick?.(updatedEvent, 'update');
      setDraggedEvent(null);
    }
  };

  // Quick add functionality
  const handleSlotClick = (date, timeSlot, e) => {
    if (e.detail === 2) { // Double click
      setQuickAddPosition({ x: e.clientX, y: e.clientY });
      setQuickAddVisible(true);
      setNewEventStart({ date, timeSlot });
    }
  };

  const createQuickEvent = (title) => {
    if (newEventStart && title.trim()) {
      const newEvent = {
        title: title.trim(),
        date: format(newEventStart.date, 'yyyy-MM-dd'),
        start_time: newEventStart.timeSlot?.time || '09:00',
        end_time: newEventStart.timeSlot?.time ?
          format(addDays(parseISO(`2000-01-01T${newEventStart.timeSlot.time}:00`), 0), 'HH:mm') :
          '10:00',
        type: 'Termin',
        all_day: !newEventStart.timeSlot
      };
      onEventCreate?.(newEvent);
    }
    setQuickAddVisible(false);
    setNewEventStart(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            navigatePrevious();
            break;
          case 'ArrowRight':
            e.preventDefault();
            navigateNext();
            break;
          case 't':
            e.preventDefault();
            goToToday();
            break;
          case 'n':
            e.preventDefault();
            setQuickAddVisible(true);
            break;
        }
      }
      if (e.key === 'Escape') {
        setQuickAddVisible(false);
        setSelectedEvents([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Render functions for different views
  const renderHeader = () => (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <div className="flex items-center space-x-4">
        <button
          onClick={navigatePrevious}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Vorheriger Zeitraum"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToToday}
          className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          Heute
        </button>

        <button
          onClick={navigateNext}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Nächster Zeitraum"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <h2 className="text-xl font-semibold text-gray-900">
        {view === 'day' && format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })}
        {view === 'week' && `${format(calendarDates[0], 'd. MMM', { locale: de })} - ${format(calendarDates[6], 'd. MMM yyyy', { locale: de })}`}
        {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: de })}
        {view === 'year' && format(currentDate, 'yyyy', { locale: de })}
      </h2>

      <div className="flex items-center space-x-2">
        {['day', 'week', 'month', 'year'].map(viewType => (
          <button
            key={viewType}
            onClick={() => setCurrentDate(currentDate)} // This would be passed as prop to change view
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              view === viewType
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {viewType === 'day' ? 'Tag' :
             viewType === 'week' ? 'Woche' :
             viewType === 'month' ? 'Monat' : 'Jahr'}
          </button>
        ))}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="flex-1 flex">
      {/* Time column */}
      <div className="w-20 bg-gray-50 border-r border-gray-200">
        <div className="h-16"></div> {/* Header spacer */}
        {timeSlots.map(slot => (
          <div
            key={slot.time}
            className="h-12 border-b border-gray-100 flex items-center justify-end pr-2 text-xs text-gray-500"
          >
            {slot.minute === 0 && slot.label}
          </div>
        ))}
      </div>

      {/* Days columns */}
      <div className="flex-1 flex">
        {calendarDates.map(date => (
          <div key={date.toISOString()} className="flex-1 border-r border-gray-200">
            {/* Day header */}
            <div className={`h-16 border-b border-gray-200 flex flex-col items-center justify-center ${
              isToday(date) ? 'bg-blue-50' : 'bg-white'
            }`}>
              <div className="text-xs font-medium text-gray-600">
                {format(date, 'EEE', { locale: de })}
              </div>
              <div className={`text-lg font-semibold ${
                isToday(date) ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-gray-900'
              }`}>
                {format(date, 'd')}
              </div>
            </div>

            {/* Time slots */}
            <div className="relative">
              {timeSlots.map(slot => (
                <div
                  key={slot.time}
                  className={`h-12 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${
                    hoveredSlot === `${date.toDateString()}-${slot.time}` ? 'bg-blue-100' : ''
                  }`}
                  onMouseEnter={() => setHoveredSlot(`${date.toDateString()}-${slot.time}`)}
                  onMouseLeave={() => setHoveredSlot(null)}
                  onClick={(e) => handleSlotClick(date, slot, e)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(date, slot, e)}
                />
              ))}

              {/* Events for this day */}
              {processedEvents
                .filter(event => isSameDay(parseISO(event.date), date))
                .map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDragStart={(e) => handleDragStart(event, e)}
                    onClick={() => onEventClick?.(event)}
                    style={{
                      position: 'absolute',
                      top: getEventTop(event.startTime),
                      height: getEventHeight(event.startTime, event.endTime),
                      left: '2px',
                      right: '2px',
                      zIndex: 10
                    }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div className="grid grid-cols-7 flex-1">
      {/* Week days header */}
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
        <div key={day} className="p-3 text-center font-medium text-gray-700 bg-gray-50 border-b">
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {calendarDates.map(date => {
        const dayEvents = processedEvents.filter(event =>
          isSameDay(parseISO(event.date), date)
        );

        return (
          <div
            key={date.toISOString()}
            className={`min-h-32 p-2 border-b border-r border-gray-200 cursor-pointer hover:bg-gray-50 ${
              !isSameMonth(date, currentDate) ? 'bg-gray-50 text-gray-400' : 'bg-white'
            } ${isToday(date) ? 'bg-blue-50' : ''}`}
            onClick={() => onDateSelect?.(date)}
          >
            <div className={`text-sm font-medium mb-1 ${
              isToday(date) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''
            }`}>
              {format(date, 'd')}
            </div>

            <div className="space-y-1">
              {dayEvents.slice(0, 3).map(event => (
                <div
                  key={event.id}
                  className="text-xs p-1 rounded truncate cursor-pointer"
                  style={{
                    backgroundColor: event.color,
                    color: event.textColor
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{dayEvents.length - 3} weitere
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Helper functions
  const getEventTop = (startTime) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const slotIndex = Math.floor(totalMinutes / 30);
    return slotIndex * 48; // 48px per slot (12px per quarter hour)
  };

  const getEventHeight = (startTime, endTime) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    return Math.max(24, (durationMinutes / 30) * 48); // Minimum 24px height
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {renderHeader()}

      <div className="flex-1 overflow-auto">
        {view === 'week' || view === 'day' ? renderWeekView() : renderMonthView()}
      </div>

      {/* Quick Add Modal */}
      {quickAddVisible && (
        <QuickAddModal
          position={quickAddPosition}
          onSave={createQuickEvent}
          onCancel={() => setQuickAddVisible(false)}
        />
      )}

      {/* Keyboard shortcuts help */}
      <div className="hidden">
        Shortcuts: Ctrl+← → Navigation, Ctrl+T Heute, Ctrl+N Neuer Termin, Esc Abbrechen
      </div>
    </div>
  );
};

// Event Card Component
const EventCard = ({ event, onDragStart, onClick, style }) => (
  <div
    className="rounded-md border border-white/20 cursor-pointer hover:shadow-md transition-all duration-200 text-xs p-1"
    style={{
      ...style,
      backgroundColor: event.color,
      color: event.textColor
    }}
    draggable
    onDragStart={onDragStart}
    onClick={onClick}
    title={`${event.title} (${event.startTime} - ${event.endTime})`}
  >
    <div className="font-medium truncate">{event.title}</div>
    <div className="opacity-90 truncate">{event.startTime} - {event.endTime}</div>
  </div>
);

// Quick Add Modal Component
const QuickAddModal = ({ position, onSave, onCancel }) => {
  const [title, setTitle] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(title);
    setTitle('');
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
      style={{ left: position.x, top: position.y }}
    >
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Termin hinzufügen..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex justify-end space-x-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Hinzufügen
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdvancedCalendar;