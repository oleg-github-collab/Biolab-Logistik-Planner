import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

const SimpleCalendar = ({ events = [], onEventClick, onEventCreate, onDateSelect, selectedDate = new Date() }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    type: 'Meeting',
    priority: 'medium'
  });

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
    setSelectedDateForEvent(day);
    setShowEventModal(true);
    if (onDateSelect) {
      onDateSelect(day);
    }
  };

  // Handle event creation
  const handleCreateEvent = async (e) => {
    e.preventDefault();

    const eventData = {
      title: newEvent.title,
      description: newEvent.description,
      startDate: format(selectedDateForEvent, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''),
      endDate: format(selectedDateForEvent, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''),
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      type: newEvent.type,
      priority: newEvent.priority,
      isAllDay: false
    };

    if (onEventCreate) {
      try {
        await onEventCreate(eventData);
        setShowEventModal(false);
        setNewEvent({
          title: '',
          description: '',
          startTime: '09:00',
          endTime: '10:00',
          type: 'Meeting',
          priority: 'medium'
        });
      } catch (error) {
        console.error('Error creating event:', error);
        alert('Fehler beim Erstellen des Termins: ' + error.message);
      }
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

      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Neuer Termin für {format(selectedDateForEvent, 'dd.MM.yyyy', { locale: de })}
            </h3>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Typ
                </label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Meeting">Meeting</option>
                  <option value="Arbeit">Arbeit</option>
                  <option value="Urlaub">Urlaub</option>
                  <option value="Krankheit">Krankheit</option>
                  <option value="Training">Training</option>
                  <option value="Projekt">Projekt</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priorität
                </label>
                <select
                  value={newEvent.priority}
                  onChange={(e) => setNewEvent({...newEvent, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleCalendar;