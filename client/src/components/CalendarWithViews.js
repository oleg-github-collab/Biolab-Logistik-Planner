import React, { useState, useMemo } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

moment.locale('de');
const localizer = momentLocalizer(moment);

const CalendarWithViews = ({ events = [], onEventClick, onEventCreate, onSelectSlot }) => {
  const { isMobile } = useMobile();
  const [view, setView] = useState(isMobile ? 'agenda' : 'month');
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

  const handleNavigate = (direction) => {
    const unit = view === 'agenda' ? 'day' : view;
    const nextDate = moment(date)[direction](1, unit).toDate();
    setDate(nextDate);
  };

  const handleToday = () => {
    setDate(new Date());
  };

  const viewOptions = useMemo(
    () => (isMobile ? ['agenda', 'day', 'week', 'month'] : ['month', 'week', 'day', 'agenda']),
    [isMobile]
  );

  const calendarHeight = isMobile ? '520px' : '700px';

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('subtract')}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 w-10 h-10"
              aria-label="Vorheriger Zeitraum"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm text-slate-500">{moment(date).format('dddd, DD.MM.YYYY')}</p>
              <p className="text-lg font-semibold text-slate-900">
                {moment(date).format(view === 'month' ? 'MMMM YYYY' : 'DD. MMM YYYY')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('add')}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 w-10 h-10"
              aria-label="Nächster Zeitraum"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition"
            >
              Heute
            </button>
            <div className="flex gap-2 overflow-x-auto">
              {viewOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition ${
                    view === option
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {messages[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 overflow-x-auto">
          <div style={{ minWidth: isMobile ? '600px' : 'auto' }}>
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
              style={{ height: calendarHeight }}
              views={['month', 'week', 'day', 'agenda']}
              toolbar={false}
              popup={!isMobile}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.color || '#3b82f6',
                  borderRadius: '6px',
                  opacity: 0.95,
                  color: 'white',
                  border: '0px',
                  display: 'block',
                  fontWeight: 600,
                  padding: '2px 6px'
                }
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarWithViews;
