import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import TimePicker from './TimePicker';
import { useMobile } from '../hooks/useMobile';

const DAYS_OF_WEEK = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DEFAULT_BLOCKS = [
  { start: '08:00', end: '12:00' },
  { start: '12:30', end: '16:30' }
];

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
  const { isMobile } = useMobile();

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
      ? (day.time_blocks.length ? day.time_blocks : [...DEFAULT_BLOCKS])
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
    const nextStart = lastBlock ? lastBlock.end : DEFAULT_BLOCKS[0].start;

    const nextState = {
      ...day,
      time_blocks: [...day.time_blocks, { start: nextStart, end: '' }]
    };

    setSchedule((prev) => {
      const clone = [...prev];
      clone[dayIndex] = nextState;
      return clone;
    });

    // Do not queue save until the new block has valid values
  };

  const removeTimeBlock = (dayIndex, blockIndex) => {
    const day = schedule[dayIndex];

    if (day.time_blocks.length === 1) {
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

  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);

  const shiftWeek = (days) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + days);
    setCurrentWeekStart(getMonday(newDate));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white/90 backdrop-blur shadow-[0_28px_60px_rgba(15,23,42,0.08)] overflow-hidden">
      <header className="bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white px-5 sm:px-7 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
              Planung & Kontrolle
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">Arbeitsstunden Kalender</h2>
            <p className="text-blue-100/90 text-sm mt-1">
              Plane konzentrierte Arbeitsblöcke, Pausen und individuelle Abwesenheiten.
            </p>
          </div>
          {hoursSummary && (
            <div className="bg-white/15 backdrop-blur-lg rounded-3xl px-5 py-4 min-w-[220px] shadow-lg shadow-blue-900/20">
              <div className="text-xs uppercase tracking-widest text-blue-100 mb-1">
                Diese Woche
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{hoursSummary.totalBooked.toFixed(1)}h</span>
                <span className="text-sm text-blue-100/80">/ {hoursSummary.weeklyQuota}h</span>
              </div>
              {hoursSummary.status !== 'exact' && (
                <div className={`text-xs mt-2 font-semibold ${
                  hoursSummary.status === 'over' ? 'text-rose-100' : 'text-amber-100'
                }`}>
                  {hoursSummary.status === 'over' ? '+' : ''}
                  {hoursSummary.difference.toFixed(1)}h
                  {hoursSummary.status === 'over' ? ' über Soll' : ' verbleibend'}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="border-b border-slate-200/80 px-4 sm:px-6 py-4 bg-white/70 backdrop-blur">
        <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between gap-4'}`}>
          <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur px-3 py-2 shadow-sm shadow-slate-200/60">
            <button
              onClick={() => shiftWeek(-7)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-amber-300 bg-white text-amber-600 shadow-sm transition hover:bg-amber-50 disabled:opacity-60"
              disabled={saving}
              aria-label="Vorherige Woche"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="flex-1 min-w-[120px] text-center text-xs font-semibold tracking-[0.4em] uppercase text-slate-500 whitespace-nowrap">
              Diese Woche
            </span>
            <button
              onClick={() => shiftWeek(7)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-transparent bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-xl transition hover:translate-y-0.5 hover:shadow-2xl disabled:opacity-60"
              disabled={saving}
              aria-label="Nächste Woche"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex-1 text-center order-last sm:order-none">
            <div className="text-lg font-semibold text-slate-800">
              {formatDate(currentWeekStart)} – {formatDate(weekEnd)}
            </div>
            <button
              onClick={() => setCurrentWeekStart(getMonday(new Date()))}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Zur aktuellen Woche
            </button>
          </div>

          {!isMobile && (
            <div className="rounded-xl bg-slate-100 text-slate-700 px-4 py-2 font-semibold">
              Gesamt geplant: {totalWeekHours}h
            </div>
          )}
        </div>
      </section>

      <div className="px-4 sm:px-6 py-5 bg-white/85">
        <div className="space-y-4">
          {schedule.map((day, index) => {
            const dayDate = addDays(currentWeekStart, index);
            const isTodayDay = isToday(dayDate);

            return (
              <div
                key={day.id || index}
                className={`relative rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                  day.is_working ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50/60'
                } ${isTodayDay ? 'ring-2 ring-blue-200' : ''} ${saving ? 'opacity-75 pointer-events-none' : ''}`}
              >
                {isTodayDay && (
                  <span className="absolute -top-3 left-5 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow">
                    Heute
                  </span>
                )}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => toggleWorkingDay(index)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition ${
                        day.is_working ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      disabled={saving}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          day.is_working ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">Arbeitsstatus umschalten</span>
                    </button>
                    <div>
                      <div className="font-semibold text-slate-900 text-lg">
                        {DAYS_OF_WEEK[index]}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(dayDate)}
                      </div>
                    </div>
                    {day.is_working && (
                      <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        {dayHours(day.time_blocks)} h
                      </span>
                    )}
                  </div>

                  {day.is_working ? (
                    <div className="flex-1 space-y-3">
                      {day.time_blocks.map((block, blockIndex) => (
                        <div
                          key={`${index}-${blockIndex}`}
                          className="flex flex-col lg:flex-row items-start lg:items-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-3 lg:p-4 shadow-sm"
                        >
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
                            <div className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                              {calculateHours(block.start, block.end).toFixed(1)} h
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTimeBlock(index, blockIndex)}
                              className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              disabled={saving}
                              aria-label="Intervall entfernen"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addTimeBlock(index);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition"
                        disabled={saving}
                      >
                        <span className="text-lg leading-none">+</span>
                        Zeitintervall hinzufügen
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 text-slate-400 italic">
                      Dieser Tag ist aktuell als frei markiert.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-6 border border-slate-200/80 rounded-2xl bg-white px-4 sm:px-6 py-5 shadow-inner">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-slate-400">
                Geplant diese Woche
              </div>
              <div className="text-2xl font-bold text-blue-600">{totalWeekHours}h</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-slate-400">
                Kontingent
              </div>
              <div className="text-2xl font-bold text-slate-800">{hoursSummary?.weeklyQuota ?? '-'}h</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-slate-400">
                Differenz
              </div>
              <div className={`text-2xl font-bold ${
                hoursSummary?.difference > 0
                  ? 'text-rose-600'
                  : hoursSummary?.difference < 0
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}>
                {hoursSummary ? `${hoursSummary.difference.toFixed(1)}h` : '--'}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
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

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export default HoursCalendar;
