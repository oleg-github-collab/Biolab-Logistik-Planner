import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isToday, getWeek, subMonths, addMonths, parseISO, isSameMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import EventModal from './EventModal';
import EventDetailsModal from './EventDetailsModal';
import QuickActionsModal from './QuickActionsModal';

const CalendarView = ({
  events = [],
  onDateSelect,
  onEventClick,
  selectedDate,
  viewType = 'month',
  onEventCreate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [showQuickActionsModal, setShowQuickActionsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [quickActionDate, setQuickActionDate] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '17:00',
    type: 'Arbeit',
    isRecurring: false,
    recurrencePattern: 'weekly'
  });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);

  const renderHeader = () => {
    const dateFormat = viewType === 'month' ? 'MMMM yyyy' : 'yyyy';

    return (
      <div className="flex items-center justify-between p-4 bg-white rounded-t-lg shadow-sm">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>

        <h2 className="text-lg font-bold text-gray-800">
          {format(currentDate, dateFormat, { locale: de })}
        </h2>

        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;

        // Get events for this day
        const dayEvents = events.filter(event => {
          const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
          return isSameDay(eventDate, cloneDay);
        });

        const hasImportantEvents = dayEvents.some(event =>
          event.type === 'Krankheit' || event.type === 'Urlaub' || event.priority === 'high'
        );

        const dayCapacity = dayEvents.reduce((total, event) => {
          if (event.startTime && event.endTime) {
            const start = parseInt(event.startTime.split(':')[0]);
            const end = parseInt(event.endTime.split(':')[0]);
            return total + (end - start);
          }
          return total + 8; // Default full day
        }, 0);

        days.push(
          <div
            key={day}
            className={`relative h-28 p-2 border-r border-b border-gray-200 transition-all duration-200 ${hasImportantEvents ? 'ring-2 ring-red-200' : ''} ${
              !isSameMonth(day, monthStart) ? 'bg-gray-50' : 'bg-white'
            } ${isToday(day) ? 'bg-blue-50 border-blue-200' : ''} ${
              selectedDate && isSameDay(day, selectedDate) ? 'bg-blue-100 border-blue-300' : ''
            } hover:bg-gray-50 hover:shadow-md cursor-pointer group`}
            onMouseEnter={() => setHoveredDate(cloneDay)}
            onMouseLeave={() => setHoveredDate(null)}
            onDoubleClick={() => {
              setQuickActionDate(cloneDay);
              setShowQuickActionsModal(true);
            }}
            onClick={() => {
              onDateSelect(cloneDay);
              setNewEvent(prev => ({ ...prev, date: cloneDay }));
            }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-sm font-medium ${
                isToday(day) ? 'text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full' : 'text-gray-700'
              }`}>
                {formattedDate}
              </span>
              <div className="flex items-center space-x-1">
                {dayEvents.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    hasImportantEvents ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {dayEvents.length}
                  </span>
                )}
                {dayCapacity > 8 && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded-full" title="Überbucht">
                    !
                  </span>
                )}
              </div>
            </div>

            {/* Quick Add Button */}
            {hoveredDate && isSameDay(hoveredDate, cloneDay) && (
              <button
                className="absolute top-1 right-1 w-5 h-5 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickActionDate(cloneDay);
                  setShowQuickActionsModal(true);
                }}
                title="Schnell hinzufügen"
              >
                +
              </button>
            )}

            <div className="space-y-1 overflow-y-auto flex-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <div
                  key={index}
                  className={`text-xs p-1.5 rounded-md cursor-pointer transition-all hover:shadow-sm border-l-2 ${
                    event.type === 'Arbeit' ? 'bg-green-50 text-green-800 border-green-400 hover:bg-green-100' :
                    event.type === 'Urlaub' ? 'bg-purple-50 text-purple-800 border-purple-400 hover:bg-purple-100' :
                    event.type === 'Krankheit' ? 'bg-red-50 text-red-800 border-red-400 hover:bg-red-100' :
                    event.type === 'Meeting' ? 'bg-blue-50 text-blue-800 border-blue-400 hover:bg-blue-100' :
                    'bg-gray-50 text-gray-800 border-gray-400 hover:bg-gray-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEvent(event);
                    setShowEventDetailsModal(true);
                  }}
                  title={`${event.title} ${event.startTime ? `(${event.startTime}-${event.endTime})` : ''}`}
                >
                  <div className="font-medium truncate">{event.title}</div>
                  {event.startTime && (
                    <div className="text-xs opacity-75 mt-0.5">
                      {event.startTime}-{event.endTime}
                    </div>
                  )}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-left pl-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Show all events for this day
                    onDateSelect(cloneDay);
                  }}
                >
                  +{dayEvents.length - 3} weitere anzeigen
                </button>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={rows.length} className="flex">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white rounded-b-lg shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>
        {rows}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayEvents = events.filter(event => {
        const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
        return isSameDay(eventDate, day);
      });

      days.push(
        <div key={i} className="flex-1 border-r border-gray-200 last:border-r-0">
          <div className={`p-3 text-center border-b border-gray-200 ${
            isToday(day) ? 'bg-blue-50' : 'bg-gray-50'
          }`}>
            <div className="text-sm font-medium text-gray-700">
              {format(day, 'EEEE', { locale: de }).substring(0, 2)}
            </div>
            <div className={`text-lg font-bold ${
              isToday(day) ? 'text-blue-600' : 'text-gray-900'
            }`}>
              {format(day, 'd')}
            </div>
          </div>

          <div className="h-96 p-2 overflow-y-auto">
            {dayEvents.map((event, index) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded text-xs cursor-pointer ${
                  event.type === 'Arbeit' ? 'bg-green-100 text-green-800' :
                  event.type === 'Urlaub' ? 'bg-purple-100 text-purple-800' :
                  event.type === 'Krankheit' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventDetailsModal(true);
                }}
              >
                <div className="font-medium">{event.title}</div>
                <div className="text-xs opacity-75">
                  {event.startTime} - {event.endTime}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex">
          {days}
        </div>
      </div>
    );
  };

  const handleEventSubmit = (eventData) => {
    if (onEventCreate && eventData.title) {
      onEventCreate({
        ...eventData,
        id: Date.now(),
        date: eventData.date || selectedDate || new Date()
      });
      setShowEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '17:00',
        type: 'Arbeit',
        isRecurring: false,
        recurrencePattern: 'weekly'
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}

      <div className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
        <div className="flex space-x-2">
          <button
            onClick={() => viewType !== 'month' && onDateSelect(new Date())}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewType === 'month'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Monat
          </button>
          <button
            onClick={() => viewType !== 'week' && onDateSelect(new Date())}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewType === 'week'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Woche
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span>Arbeit</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <span>Urlaub</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <span>Krankheit</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span>Meeting</span>
            </div>
          </div>

          <button
            onClick={() => {
              setNewEvent({ ...newEvent, date: selectedDate || new Date() });
              setShowEventModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Neuer Termin</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewType === 'month' ? renderMonthView() : renderWeekView()}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          event={newEvent}
          onSave={handleEventSubmit}
          onChange={setNewEvent}
        />
      )}

      {/* Event Details Modal */}
      {showEventDetailsModal && selectedEvent && (
        <EventDetailsModal
          isOpen={showEventDetailsModal}
          onClose={() => setShowEventDetailsModal(false)}
          event={selectedEvent}
          onEdit={(event) => {
            setNewEvent(event);
            setShowEventDetailsModal(false);
            setShowEventModal(true);
          }}
          onDelete={(eventId) => {
            // Handle delete
            setShowEventDetailsModal(false);
          }}
        />
      )}

      {/* Quick Actions Modal */}
      {showQuickActionsModal && quickActionDate && (
        <QuickActionsModal
          isOpen={showQuickActionsModal}
          onClose={() => setShowQuickActionsModal(false)}
          date={quickActionDate}
          onQuickAdd={(eventData) => {
            handleEventSubmit({ ...eventData, date: quickActionDate });
            setShowQuickActionsModal(false);
          }}
        />
      )}
    </div>
  );
};

export default CalendarView;