import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Users, Clock } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getAssetUrl } from '../utils/media';

const DAYS_OF_WEEK = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (time) => {
  if (!time) return '';
  return time.substring(0, 5);
};

const TeamScheduleCalendar = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [teamSchedules, setTeamSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTeamSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const weekStart = formatDateForAPI(currentWeekStart);
      const response = await api.get(`/schedule/team-week/${weekStart}`);
      setTeamSchedules(response.data || []);
    } catch (error) {
      console.error('Error loading team schedule:', error);
      toast.error('Fehler beim Laden des Team-Stundenplans');
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    loadTeamSchedule();
  }, [loadTeamSchedule]);

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const getDayScheduleForUser = (userId, dayOfWeek) => {
    const user = teamSchedules.find(u => u.user_id === userId);
    if (!user || !user.week_schedule) return null;
    return user.week_schedule.find(day => day.day_of_week === dayOfWeek);
  };

  const formatDateShort = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Lade Team-Stundenplan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team-Stundenplan</h2>
            <p className="text-sm text-gray-600">
              {weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToCurrentWeek}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/40 transition-all transform-gpu hover:-translate-y-[1px] hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            Diese Woche
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            aria-label="Nächste Woche"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[140px]">
                    Mitarbeiter
                  </th>
                  {weekDates.map((date, idx) => (
                    <th
                      key={idx}
                      scope="col"
                      className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[120px] ${
                        isToday(date) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{DAYS_OF_WEEK[idx].substring(0, 2)}</span>
                        <span className="text-xs font-normal mt-1">{formatDateShort(date)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      Keine Mitarbeiter gefunden
                    </td>
                  </tr>
                ) : (
                  teamSchedules.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0">
                            {user.profile_photo ? (
                              <img
                                src={getAssetUrl(user.profile_photo)}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {user.name?.charAt(0) || 'U'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {user.employment_type}
                            </p>
                          </div>
                        </div>
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
                        const daySchedule = getDayScheduleForUser(user.user_id, dayOfWeek);
                        const isWorking = daySchedule?.is_working;

                        return (
                          <td
                            key={dayOfWeek}
                            className={`px-2 py-2 text-center text-xs ${
                              isToday(weekDates[dayOfWeek]) ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {isWorking ? (
                              <div className="space-y-1">
                                {daySchedule.time_blocks && daySchedule.time_blocks.length > 0 ? (
                                  daySchedule.time_blocks.map((block, blockIdx) => (
                                    <div
                                      key={blockIdx}
                                      className="bg-green-100 border border-green-300 rounded px-1.5 py-1 text-green-800"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-medium">
                                          {formatTime(block.start)}
                                        </span>
                                      </div>
                                      <div className="text-[10px] leading-tight">
                                        bis {formatTime(block.end)}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="bg-green-100 border border-green-300 rounded px-1.5 py-1 text-green-800">
                                    <div className="flex items-center justify-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span className="font-medium">
                                        {formatTime(daySchedule.start_time)}
                                      </span>
                                    </div>
                                    <div className="text-[10px] leading-tight">
                                      bis {formatTime(daySchedule.end_time)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      {teamSchedules.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Team</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{teamSchedules.length}</p>
            <p className="text-xs text-blue-600">Mitarbeiter insgesamt</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Arbeitstage</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {teamSchedules.reduce((sum, user) =>
                sum + (user.week_schedule?.filter(day => day.is_working).length || 0), 0
              )}
            </p>
            <p className="text-xs text-green-600">Diese Woche</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-700 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Stunden</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {teamSchedules.reduce((sum, user) =>
                sum + (user.total_hours || 0), 0
              ).toFixed(1)}h
            </p>
            <p className="text-xs text-purple-600">Gesamt diese Woche</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamScheduleCalendar;
