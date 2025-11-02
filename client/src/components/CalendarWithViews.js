import React, { useState } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('de');
const localizer = momentLocalizer(moment);

const CalendarWithViews = ({ events = [], onEventClick, onEventCreate, onSelectSlot }) => {
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  // Transform events for BigCalendar
  const calendarEvents = events.map(event => ({
    ...event,
    title: event.title || 'Unbenannt',
    start: new Date(event.start_date || event.start),
    end: new Date(event.end_date || event.end || event.start_date || event.start),
  }));

  const handleSelectEvent = (event) => {
    if (onEventClick) {
      onEventClick(event);
    }
  };

  const handleSelectSlot = (slotInfo) => {
    if (onEventCreate) {
      onEventCreate({
        start: slotInfo.start,
        end: slotInfo.end
      });
    }
    if (onSelectSlot) {
      onSelectSlot(slotInfo);
    }
  };

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
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6" style={{ height: '700px' }}>
      {/* View Switcher */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setView('month')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            view === 'month'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📅 Monat
        </button>
        <button
          onClick={() => setView('week')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            view === 'week'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📆 Woche
        </button>
        <button
          onClick={() => setView('day')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            view === 'day'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📝 Tag
        </button>
        <button
          onClick={() => setView('agenda')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            view === 'agenda'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 Agenda
        </button>
      </div>

      {/* Calendar */}
      <BigCalendar
        localizer={localizer}
        events={calendarEvents}
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        messages={messages}
        style={{ height: 'calc(100% - 60px)' }}
        views={['month', 'week', 'day', 'agenda']}
        eventPropGetter={(event) => ({
          style: {
            backgroundColor: event.color || '#3b82f6',
            borderRadius: '4px',
            opacity: 0.8,
            color: 'white',
            border: '0px',
            display: 'block'
          }
        })}
      />
    </div>
  );
};

export default CalendarWithViews;
