import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, TrendingUp, Users, AlertCircle, ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';

/**
 * WeeklyCalendarOverview Component
 * Shows weekly calendar view with statistics and metrics
 */
const WeeklyCalendarOverview = ({ events = [] }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [weekStats, setWeekStats] = useState(null);

  useEffect(() => {
    calculateWeekStats();
  }, [events, currentWeekStart]);

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  const getDayName = (dayIndex) => {
    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    return days[dayIndex];
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDay = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const calculateWeekStats = () => {
    const weekDays = getWeekDays();
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate >= weekDays[0] && eventDate <= weekDays[6];
    });

    if (weekEvents.length === 0) {
      setWeekStats({
        totalEvents: 0,
        totalHours: 0,
        busiestDay: null,
        averagePerDay: 0,
        dayStats: weekDays.map(day => ({ day, events: 0, hours: 0 }))
      });
      return;
    }

    // Calculate total hours
    const totalHours = weekEvents.reduce((sum, event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    // Calculate per-day stats
    const dayStats = weekDays.map(day => {
      const dayEvents = getEventsForDay(day);
      const dayHours = dayEvents.reduce((sum, event) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        return sum + (end - start) / (1000 * 60 * 60);
      }, 0);

      return {
        day,
        events: dayEvents.length,
        hours: dayHours
      };
    });

    // Find busiest day
    const busiestDay = dayStats.reduce((max, stat) =>
      stat.hours > max.hours ? stat : max
    , dayStats[0]);

    setWeekStats({
      totalEvents: weekEvents.length,
      totalHours: totalHours.toFixed(1),
      busiestDay: {
        name: getDayName(busiestDay.day.getDay() === 0 ? 6 : busiestDay.day.getDay() - 1),
        hours: busiestDay.hours.toFixed(1),
        events: busiestDay.events
      },
      averagePerDay: (weekEvents.length / 7).toFixed(1),
      dayStats
    });
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const weekDays = getWeekDays();
  const isCurrentWeek = weekDays[0].toDateString() === getMonday(new Date()).toDateString();

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-7 h-7 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Wochenübersicht</h2>
            <p className="text-sm text-slate-600">
              {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Vorherige Woche"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={goToToday}
            disabled={isCurrentWeek}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Heute
          </button>

          <button
            onClick={goToNextWeek}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Nächste Woche"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {weekStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-700">Termine</h3>
            </div>
            <p className="text-3xl font-bold text-blue-900">{weekStats.totalEvents}</p>
            <p className="text-xs text-blue-700 mt-1">⌀ {weekStats.averagePerDay} pro Tag</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-slate-700">Stunden</h3>
            </div>
            <p className="text-3xl font-bold text-green-900">{weekStats.totalHours}h</p>
            <p className="text-xs text-green-700 mt-1">Geplante Zeit</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-slate-700">Vollster Tag</h3>
            </div>
            {weekStats.busiestDay ? (
              <>
                <p className="text-2xl font-bold text-orange-900">{weekStats.busiestDay.name}</p>
                <p className="text-xs text-orange-700 mt-1">
                  {weekStats.busiestDay.hours}h • {weekStats.busiestDay.events} Termine
                </p>
              </>
            ) : (
              <p className="text-sm text-orange-700">Keine Daten</p>
            )}
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-slate-700">Auslastung</h3>
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {weekStats.totalHours > 0 ? Math.round((weekStats.totalHours / (7 * 8)) * 100) : 0}%
            </p>
            <p className="text-xs text-purple-700 mt-1">Von 56h Arbeitswoche</p>
          </div>
        </div>
      )}

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const dayHours = dayEvents.reduce((sum, event) => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            return sum + (end - start) / (1000 * 60 * 60);
          }, 0);

          return (
            <div
              key={index}
              className={`p-3 rounded-xl border-2 transition ${
                isToday
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              {/* Day Header */}
              <div className="mb-3">
                <p className={`text-xs font-semibold uppercase ${
                  isToday ? 'text-blue-600' : 'text-slate-500'
                }`}>
                  {getDayName(day.getDay() === 0 ? 6 : day.getDay() - 1).substring(0, 2)}
                </p>
                <p className={`text-2xl font-bold ${
                  isToday ? 'text-blue-900' : 'text-slate-900'
                }`}>
                  {day.getDate()}
                </p>
                {dayEvents.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {dayEvents.length} • {dayHours.toFixed(1)}h
                  </p>
                )}
              </div>

              {/* Events */}
              <div className="space-y-2">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition cursor-pointer"
                    title={event.title}
                  >
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatTime(event.start_time)}
                    </p>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-blue-600 font-semibold text-center">
                    +{dayEvents.length - 3} weitere
                  </p>
                )}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-slate-400 text-center italic">Keine Termine</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyCalendarOverview;
