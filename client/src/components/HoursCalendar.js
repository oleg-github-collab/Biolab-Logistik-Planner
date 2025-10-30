import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const HoursCalendar = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [schedule, setSchedule] = useState([]);
  const [hoursSummary, setHoursSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Get Monday of the week
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // Format date for display
  function formatDate(date) {
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // Format date for API
  function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
  }

  // Load schedule for current week
  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const weekStart = formatDateForAPI(currentWeekStart);

      const [scheduleRes, summaryRes] = await Promise.all([
        api.get(`/schedule/week/${weekStart}`),
        api.get(`/schedule/hours-summary/${weekStart}`)
      ]);

      setSchedule(scheduleRes.data);
      setHoursSummary(summaryRes.data);
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('Fehler beim Laden des Stundenplans');
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Navigate weeks
  const previousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  // Update day
  const updateDay = async (dayIndex, updates) => {
    try {
      const day = schedule[dayIndex];
      if (!day || !day.id) {
        toast.error('Invalid day');
        return;
      }

      setSaving(true);

      const response = await api.put(`/schedule/day/${day.id}`, {
        isWorking: updates.is_working,
        startTime: updates.start_time,
        endTime: updates.end_time
      });

      // Update local state
      const newSchedule = [...schedule];
      newSchedule[dayIndex] = response.data;
      setSchedule(newSchedule);

      // Reload summary
      const weekStart = formatDateForAPI(currentWeekStart);
      const summaryRes = await api.get(`/schedule/hours-summary/${weekStart}`);
      setHoursSummary(summaryRes.data);

      toast.success('Stundenplan aktualisiert');
    } catch (error) {
      console.error('Error updating day:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Aktualisieren des Stundenplans');
    } finally {
      setSaving(false);
    }
  };

  // Toggle working day
  const toggleWorkingDay = (dayIndex) => {
    const day = schedule[dayIndex];
    updateDay(dayIndex, {
      is_working: !day.is_working,
      start_time: !day.is_working ? '09:00' : null,
      end_time: !day.is_working ? '17:00' : null
    });
  };

  // Update time with debounce
  const [timeoutIds, setTimeoutIds] = useState({});

  const updateTime = (dayIndex, field, value) => {
    const day = schedule[dayIndex];

    // Update local state immediately
    const newSchedule = [...schedule];
    newSchedule[dayIndex] = {
      ...day,
      [field]: value
    };
    setSchedule(newSchedule);

    // Clear previous timeout for this field
    const key = `${dayIndex}-${field}`;
    if (timeoutIds[key]) {
      clearTimeout(timeoutIds[key]);
    }

    // Set new timeout to save after 1 second
    const timeoutId = setTimeout(() => {
      updateDay(dayIndex, {
        is_working: day.is_working,
        start_time: field === 'start_time' ? value : day.start_time,
        end_time: field === 'end_time' ? value : day.end_time
      });
    }, 1000);

    setTimeoutIds({ ...timeoutIds, [key]: timeoutId });
  };

  // Calculate hours for a day
  const calculateDayHours = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return ((endMinutes - startMinutes) / 60).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getDate = (dayIndex) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + dayIndex);
    return date;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Work Hours Calendar</h2>
            <p className="text-blue-100 text-sm">
              Plan your weekly work schedule
            </p>
          </div>

          {/* Hours Summary */}
          {hoursSummary && (
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-4 py-3 min-w-[200px]">
              <div className="text-xs text-blue-100 mb-1">This Week</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{hoursSummary.totalBooked.toFixed(1)}h</span>
                <span className="text-sm">/ {hoursSummary.weeklyQuota}h</span>
              </div>
              {hoursSummary.status !== 'exact' && (
                <div className={`text-xs mt-1 ${
                  hoursSummary.status === 'over' ? 'text-red-200' : 'text-yellow-200'
                }`}>
                  {hoursSummary.status === 'over' ? '+' : ''}{hoursSummary.difference.toFixed(1)}h
                  {hoursSummary.status === 'over' ? ' over' : ' remaining'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Week Navigation */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <button
            onClick={previousWeek}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={saving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-lg font-semibold text-gray-800">
              {formatDate(currentWeekStart)} - {formatDate(getDate(6))}
            </div>
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              Go to current week
            </button>
          </div>

          <button
            onClick={nextWeek}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={saving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <div className="space-y-3">
          {schedule.map((day, index) => {
            const date = getDate(index);
            const isToday = formatDateForAPI(date) === formatDateForAPI(new Date());
            const dayHours = day.is_working ? calculateDayHours(day.start_time, day.end_time) : 0;

            return (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 transition-all ${
                  isToday
                    ? 'border-blue-500 bg-blue-50'
                    : day.is_working
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                } ${saving ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Day Header */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <input
                      type="checkbox"
                      checked={day.is_working}
                      onChange={() => toggleWorkingDay(index)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      disabled={saving}
                    />
                    <div>
                      <div className="font-semibold text-gray-800">
                        {daysOfWeek[index]}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(date)}
                      </div>
                    </div>
                    {isToday && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Time Inputs */}
                  {day.is_working && (
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={day.start_time || '09:00'}
                          onChange={(e) => updateTime(index, 'start_time', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                          disabled={saving}
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={day.end_time || '17:00'}
                          onChange={(e) => updateTime(index, 'end_time', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                          disabled={saving}
                        />
                      </div>

                      <div className="min-w-[80px] pt-5">
                        <div className="text-lg font-bold text-gray-800">
                          {dayHours}h
                        </div>
                      </div>
                    </div>
                  )}

                  {!day.is_working && (
                    <div className="text-gray-400 italic flex-1">
                      Not working
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Summary */}
        {hoursSummary && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600 mb-1">Weekly Quota</div>
                <div className="text-2xl font-bold text-gray-800">
                  {hoursSummary.weeklyQuota}h
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Booked</div>
                <div className="text-2xl font-bold text-blue-600">
                  {hoursSummary.totalBooked.toFixed(1)}h
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Difference</div>
                <div className={`text-2xl font-bold ${
                  hoursSummary.status === 'over' ? 'text-red-600' :
                  hoursSummary.status === 'under' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {hoursSummary.difference >= 0 ? '+' : ''}{hoursSummary.difference.toFixed(1)}h
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="mt-4 text-center">
              {hoursSummary.status === 'exact' && (
                <div className="text-green-700 font-semibold">
                  ✓ Perfect! Your schedule matches your weekly quota.
                </div>
              )}
              {hoursSummary.status === 'under' && (
                <div className="text-yellow-700">
                  You have {Math.abs(hoursSummary.difference).toFixed(1)} hours remaining to schedule this week.
                </div>
              )}
              {hoursSummary.status === 'over' && (
                <div className="text-red-700 font-semibold">
                  ⚠ You are over-scheduled by {hoursSummary.difference.toFixed(1)} hours this week!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoursCalendar;
