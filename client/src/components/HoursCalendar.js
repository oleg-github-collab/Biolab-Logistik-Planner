import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import TimePicker from './TimePicker';

const DAYS_OF_WEEK = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DEFAULT_BLOCK = { start: '09:00', end: '17:00' };

const normalizeBlocks = (rawBlocks, fallbackStart, fallbackEnd) => {
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    return rawBlocks.map((block) => ({
      start: block.start,
      end: block.end
    }));
  }

  if (fallbackStart && fallbackEnd) {
    return [{ start: fallbackStart, end: fallbackEnd }];
  }

  return [];
};

const HoursCalendar = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [schedule, setSchedule] = useState([]);
  const [hoursSummary, setHoursSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeouts = useRef({});

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const weekStart = formatDateForAPI(currentWeekStart);
      const [scheduleRes, summaryRes] = await Promise.all([
        api.get(`/schedule/week/${weekStart}`),
        api.get(`/schedule/hours-summary/${weekStart}`)
      ]);

      const normalizedSchedule = (scheduleRes.data || []).map((day) => {
        const blocks = normalizeBlocks(day.time_blocks, day.start_time, day.end_time);
        return {
          ...day,
          time_blocks: blocks,
          start_time: day.start_time,
          end_time: day.end_time
        };
      });

      setSchedule(normalizedSchedule);
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
    const timeoutsSnapshot = saveTimeouts.current;
    return () => {
      Object.values(timeoutsSnapshot).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [loadSchedule]);

  const queueSave = (dayIndex, draftDay) => {
    if (saveTimeouts.current[dayIndex]) {
      clearTimeout(saveTimeouts.current[dayIndex]);
    }

    saveTimeouts.current[dayIndex] = setTimeout(() => {
      updateDay(dayIndex, draftDay);
    }, 600);
  };

  const updateDay = async (dayIndex, nextState) => {
    try {
      const day = schedule[dayIndex];
      if (!day || !day.id) {
        toast.error('Ungültiger Tag');
        return;
      }

      setSaving(true);

      const payload = {
        isWorking: nextState.is_working,
        timeBlocks: nextState.time_blocks
      };

      const response = await api.put(`/schedule/day/${day.id}`, payload);

      const updatedDay = {
        ...response.data,
        time_blocks: normalizeBlocks(response.data.time_blocks, response.data.start_time, response.data.end_time)
      };

      const newSchedule = [...schedule];
      newSchedule[dayIndex] = updatedDay;
      setSchedule(newSchedule);

      await refreshSummary();
      toast.success('Stundenplan aktualisiert');
    } catch (error) {
      console.error('Error updating day:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Aktualisieren des Stundenplans');
      loadSchedule();
    } finally {
      setSaving(false);
    }
  };

  const refreshSummary = useCallback(async () => {
    try {
      const weekStart = formatDateForAPI(currentWeekStart);
      const summaryRes = await api.get(`/schedule/hours-summary/${weekStart}`);
      setHoursSummary(summaryRes.data);
    } catch (error) {
      console.error('Error refreshing summary:', error);
    }
  }, [currentWeekStart]);

  const toggleWorkingDay = (dayIndex) => {
    const day = schedule[dayIndex];
    const willWork = !day.is_working;

    const nextBlocks = willWork
      ? (day.time_blocks.length ? day.time_blocks : [DEFAULT_BLOCK])
      : [];

    const nextState = {
      ...day,
      is_working: willWork,
      time_blocks: nextBlocks
    };

    setSchedule((prev) => {
      const clone = [...prev];
      clone[dayIndex] = nextState;
      return clone;
    });

    queueSave(dayIndex, nextState);
  };

  const handleTimeBlockChange = (dayIndex, blockIndex, field, value) => {
    const day = schedule[dayIndex];
    const blocks = [...day.time_blocks];
    const block = { ...blocks[blockIndex], [field]: value };

    if (block.start && block.end && compareTimes(block.start, block.end) >= 0) {
      toast.error('Endzeit muss nach Startzeit liegen');
      return;
    }

    blocks[blockIndex] = block;

    const hasIncomplete = blocks.some((entry) => !entry.start || !entry.end);
    const normalized = hasIncomplete
      ? blocks
      : [...blocks].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    const nextState = {
      ...day,
      time_blocks: normalized
    };

    setSchedule((prev) => {
      const clone = [...prev];
      clone[dayIndex] = nextState;
      return clone;
    });

    if (!hasIncomplete) {
      queueSave(dayIndex, nextState);
    }
  };

  const addTimeBlock = (dayIndex) => {
    const day = schedule[dayIndex];
    const lastBlock = day.time_blocks[day.time_blocks.length - 1];
    const nextStart = lastBlock ? lastBlock.end : DEFAULT_BLOCK.start;
    const nextEnd = addMinutes(nextStart, 60);

    if (!nextEnd) {
      toast.error('Kein weiterer Zeitraum möglich');
      return;
    }

    const nextState = {
      ...day,
      time_blocks: [...day.time_blocks, { start: nextStart, end: nextEnd }]
    };

    setSchedule((prev) => {
      const clone = [...prev];
      clone[dayIndex] = nextState;
      return clone;
    });

    queueSave(dayIndex, nextState);
  };

  const removeTimeBlock = (dayIndex, blockIndex) => {
    const day = schedule[dayIndex];

    if (day.time_blocks.length === 1) {
      // Removing the last block turns the day off
      toggleWorkingDay(dayIndex);
      return;
    }

    const nextBlocks = day.time_blocks.filter((_, idx) => idx !== blockIndex);
    const nextState = {
      ...day,
      time_blocks: nextBlocks
    };

    setSchedule((prev) => {
      const clone = [...prev];
      clone[dayIndex] = nextState;
      return clone;
    });

    queueSave(dayIndex, nextState);
  };

  const dayHours = useCallback((blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return 0;
    const total = blocks.reduce((sum, block) => sum + calculateHours(block.start, block.end), 0);
    return total.toFixed(1);
  }, []);

  const totalWeekHours = useMemo(() => {
    return schedule.reduce((sum, day) => sum + parseFloat(dayHours(day.time_blocks)), 0).toFixed(1);
  }, [schedule, dayHours]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Arbeitsstunden Kalender</h2>
            <p className="text-blue-100 text-sm">Plane flexible Arbeitsblöcke mit Pausen und Unterbrechungen.</p>
          </div>
          {hoursSummary && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3 min-w-[200px]">
              <div className="text-xs text-blue-100 mb-1">Diese Woche</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{hoursSummary.totalBooked.toFixed(1)}h</span>
                <span className="text-sm">/ {hoursSummary.weeklyQuota}h</span>
              </div>
              {hoursSummary.status !== 'exact' && (
                <div className={`text-xs mt-1 ${
                  hoursSummary.status === 'over' ? 'text-red-200' : 'text-yellow-200'
                }`}>
                  {hoursSummary.status === 'over' ? '+' : ''}{hoursSummary.difference.toFixed(1)}h
                  {hoursSummary.status === 'over' ? ' über' : ' verbleibend'}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <button onClick={() => shiftWeek(-7)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" disabled={saving}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-lg font-semibold text-gray-800">
              {formatDate(currentWeekStart)} - {formatDate(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
            </div>
            <button onClick={() => setCurrentWeekStart(getMonday(new Date()))} className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
              Zur aktuellen Woche
            </button>
          </div>

          <button onClick={() => shiftWeek(7)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" disabled={saving}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      <div className="p-6">
        <div className="space-y-4">
          {schedule.map((day, index) => (
            <div
              key={day.id || index}
              className={`border-2 rounded-lg p-4 transition-all ${
                day.is_working
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              } ${saving ? 'opacity-75 pointer-events-none' : ''}`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-[180px]">
                  <input
                    type="checkbox"
                    checked={day.is_working}
                    onChange={() => toggleWorkingDay(index)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    disabled={saving}
                  />
                  <div>
                    <div className="font-semibold text-gray-800">{DAYS_OF_WEEK[index]}</div>
                    <div className="text-xs text-gray-500">{formatDate(addDays(currentWeekStart, index))}</div>
                  </div>
                  {day.is_working && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      {dayHours(day.time_blocks)} h
                    </span>
                  )}
                </div>

                {day.is_working ? (
                  <div className="flex-1 space-y-3">
                    {day.time_blocks.map((block, blockIndex) => (
                      <div key={`${index}-${blockIndex}`} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                          <TimePicker
                            label="Start"
                            value={block.start}
                            onChange={(value) => handleTimeBlockChange(index, blockIndex, 'start', value)}
                            disabled={saving}
                          />
                          <TimePicker
                            label="Ende"
                            value={block.end}
                            onChange={(value) => handleTimeBlockChange(index, blockIndex, 'end', value)}
                            disabled={saving}
                          />
                        </div>
                        <div className="flex items-center gap-2 self-stretch">
                          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {calculateHours(block.start, block.end).toFixed(1)} h
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTimeBlock(index, blockIndex)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addTimeBlock(index)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition"
                      disabled={saving}
                    >
                      <span className="text-lg">+</span>
                      Intervall hinzufügen
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400 italic flex-1">Nicht arbeitend</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-6 p-4 bg-gray-100 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">Geplant (diese Woche)</div>
              <div className="text-2xl font-bold text-blue-600">{totalWeekHours}h</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Kontingent</div>
              <div className="text-2xl font-bold text-gray-800">{hoursSummary?.weeklyQuota ?? '-'}h</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Differenz</div>
              <div className={`text-2xl font-bold ${
                hoursSummary?.difference > 0
                  ? 'text-red-600'
                  : hoursSummary?.difference < 0
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }`}>
                {hoursSummary ? `${hoursSummary.difference >= 0 ? '+' : ''}${hoursSummary.difference.toFixed(1)}h` : '-'}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );

  function shiftWeek(days) {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + days);
    setCurrentWeekStart(getMonday(newDate));
  }
};

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + minutes;
  if (totalMinutes >= 24 * 60) return null;
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

function compareTimes(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (sh * 60 + sm) - (eh * 60 + em);
}

function calculateHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

export default HoursCalendar;
