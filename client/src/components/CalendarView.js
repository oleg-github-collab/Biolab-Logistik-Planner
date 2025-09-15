import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isToday, getWeek, subMonths, addMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const CalendarView = ({ 
  events = [], 
  onDateSelect, 
  onEventClick, 
  selectedDate, 
  viewType = 'month',
  onEventCreate 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '17:00',
    type: 'Arbeit',
    isRecurring: false,
    recurrencePattern: 'weekly'
  });

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

        days.push(
          <div
            key={day}
            className={`h-24 p-1 border-r border-b border-gray-200 ${
              !isSameMonth(day, monthStart) ? 'bg-gray-50' : 'bg-white'
            } ${isToday(day) ? 'bg-blue-50 border-blue-200' : ''} ${
              selectedDate && isSameDay(day, selectedDate) ? 'bg-blue-100 border-blue-300' : ''
            } hover:bg-gray-50 transition-colors cursor-pointer`}
            onClick={() => onDateSelect(cloneDay)}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-sm ${
                isToday(day) ? 'text-blue-600 font-bold' : 'text-gray-700'
              }`}>
                {formattedDate}
              </span>
              {dayEvents.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded-full">
                  {dayEvents.length}
                </span>
              )}
            </div>
            
            <div className="space-y-1 overflow-y-auto max-h-16">
              {dayEvents.slice(0, 2).map((event, index) => (
                <div
                  key={index}
                  className={`text-xs p-1 rounded truncate ${
                    event.type === 'Arbeit' ? 'bg-green-100 text-green-800' :
                    event.type === 'Urlaub' ? 'bg-purple-100 text-purple-800' :
                    event.type === 'Krankheit' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 2 && (
                <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
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
                onClick={() => onEventClick(event)}
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

  const handleDayClick = (day) => {
    onDateSelect(day);
    setNewEvent(prev => ({
      ...prev,
      date: day
    }));
    setShowEventModal(true);
  };

  const handleEventSubmit = (e) => {
    e.preventDefault();
    if (onEventCreate && newEvent.title) {
      onEventCreate({
        ...newEvent,
        id: Date.now(),
        date: newEvent.date || selectedDate || new Date()
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

  const isSameMonth = (date1, date2) => {
    return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  };

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}
      
      <div className="flex space-x-2 p-4 bg-white border-b border-gray-200">
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

      <div className="flex-1 overflow-auto">
        {viewType === 'month' ? renderMonthView() : renderWeekView()}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-auto slide-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Neuer Termin</h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEventSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Termin Titel"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Beschreibung (optional)"
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Arbeit">Arbeit</option>
                    <option value="Urlaub">Urlaub</option>
                    <option value="Krankheit">Krankheit</option>
                    <option value="Abwesend">Abwesend</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Projekt">Projekt</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={newEvent.isRecurring}
                    onChange={(e) => setNewEvent({...newEvent, isRecurring: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="recurring" className="text-sm text-gray-700">
                    Wiederholender Termin
                  </label>
                </div>
                
                {newEvent.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wiederholungsmuster
                    </label>
                    <select
                      value={newEvent.recurrencePattern}
                      onChange={(e) => setNewEvent({...newEvent, recurrencePattern: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="biweekly">Alle 2 Wochen</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;