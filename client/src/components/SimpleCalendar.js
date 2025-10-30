import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

const SimpleCalendar = ({ events = [], onEventClick, onEventCreate, onDateSelect, selectedDate = new Date() }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Navigate between months
  const nextMonth = () => {
    setCurrentDate(addDays(currentDate, 32));
  };

  const prevMonth = () => {
    setCurrentDate(addDays(currentDate, -32));
  };

  // Get calendar days
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  // Get events for a specific day
  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_date || event.start);
      return isSameDay(eventDate, day);
    });
  };

  // Handle day click
  const handleDayClick = (day) => {
    if (onDateSelect) {
      onDateSelect(day);
    }
    // Trigger event creation modal via parent component
    if (onEventCreate) {
      onEventCreate({ start: day });
    }
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          ←
        </button>
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'MMMM yyyy', { locale: de })}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          →
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 border-b">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelectedDay = isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 border-r border-b cursor-pointer hover:bg-gray-50 ${
                !isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
              } ${
                isSelectedDay ? 'bg-blue-50' : ''
              } ${
                isTodayDay ? 'bg-yellow-50' : ''
              }`}
              onClick={() => handleDayClick(day)}
            >
              <div className={`text-sm font-medium ${
                isTodayDay ? 'text-blue-600' : ''
              }`}>
                {format(day, 'd')}
              </div>

              {/* Events for this day */}
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className={`text-xs p-1 rounded truncate cursor-pointer ${
                      event.type === 'Meeting' ? 'bg-blue-100 text-blue-800' :
                      event.type === 'Arbeit' ? 'bg-green-100 text-green-800' :
                      event.type === 'Urlaub' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEventClick) {
                        onEventClick(event);
                      }
                    }}
                  >
                    {event.start_time && (
                      <span className="font-medium">{event.start_time}</span>
                    )} {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 3} mehr
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SimpleCalendar;
