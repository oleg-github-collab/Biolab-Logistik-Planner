import React, { useState } from 'react';
import { format, startOfWeek, addDays, isToday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

const Calendar = ({ weekStart, selectedDay, onDaySelect, scheduleData, events = [], onEventClick }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const days = [];
  const startDate = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });

  for (let i = 0; i < 7; i++) {
    const day = addDays(startDate, i);
    days.push(day);
  }

  const getDayStatus = (dayIndex) => {
    if (!scheduleData || !scheduleData[dayIndex]) return 'Arbeit';
    return scheduleData[dayIndex].status;
  };

  const getDayEvents = (day) => {
    return events.filter(event => {
      const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date;
      return isSameDay(eventDate, day);
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Arbeit':
        return 'bg-green-500';
      case 'Urlaub':
        return 'bg-purple-500';
      case 'Krankheit':
        return 'bg-red-500';
      case 'Abwesend':
        return 'bg-gray-400';
      case 'Meeting':
        return 'bg-blue-500';
      case 'Projekt':
        return 'bg-orange-500';
      case 'Training':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const getWorkingHours = (dayIndex) => {
    if (!scheduleData || !scheduleData[dayIndex]) return null;
    const data = scheduleData[dayIndex];
    if (data.startTime && data.endTime) {
      return `${data.startTime} - ${data.endTime}`;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getDayEvents(day);
          const workingHours = getWorkingHours(index);
          const hasImportantEvents = dayEvents.some(event =>
            event.type === 'Krankheit' || event.type === 'Urlaub' || event.priority === 'high'
          );

          return (
            <div
              key={index}
              className={`relative p-3 border-r border-b border-gray-200 cursor-pointer transition-all duration-200 ${
                selectedDay && isSameDay(selectedDay, day) ? 'bg-blue-50 ring-2 ring-blue-300' : ''
              } ${isToday(day) ? 'bg-yellow-50 ring-2 ring-yellow-300' : ''} ${
                hasImportantEvents ? 'ring-1 ring-red-200' : ''
              } hover:bg-gray-50 hover:shadow-md group`}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => onDaySelect(day)}
            >
              {/* Day Header */}
              <div className="text-center mb-2">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white mb-1 ${getStatusColor(getDayStatus(index))}`}>
                  {format(day, 'dd', { locale: de })}
                </div>
                <div className="text-xs font-medium text-gray-600">
                  {format(day, 'EEE', { locale: de })}
                </div>
                {isToday(day) && (
                  <div className="text-xs text-blue-600 font-semibold">Heute</div>
                )}
              </div>

              {/* Working Hours */}
              {workingHours && (
                <div className="text-xs text-gray-500 text-center mb-1">
                  {workingHours}
                </div>
              )}

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className={`text-xs p-1 rounded text-center truncate cursor-pointer transition-all ${
                      event.type === 'Arbeit' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                      event.type === 'Urlaub' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' :
                      event.type === 'Krankheit' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                      event.type === 'Meeting' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                      'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick && onEventClick(event);
                    }}
                    title={`${event.title} ${event.startTime ? `(${event.startTime}-${event.endTime})` : ''}`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-blue-600 text-center font-medium">
                    +{dayEvents.length - 2} weitere
                  </div>
                )}
              </div>

              {/* Quick Add Button on Hover */}
              {hoveredDay && isSameDay(hoveredDay, day) && (
                <button
                  className="absolute top-1 right-1 w-5 h-5 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-blue-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Quick add functionality could be implemented here
                  }}
                  title="Schnell hinzufügen"
                >
                  +
                </button>
              )}

              {/* Event Count Indicator */}
              {dayEvents.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center">
                  {dayEvents.length}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;