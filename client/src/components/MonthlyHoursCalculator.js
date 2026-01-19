import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MonthlyHoursCalculator = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const parseDateString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Load monthly summary
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const response = await api.get(`/schedule/hours-summary/month/${year}/${month}`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
      toast.error('Fehler beim Laden der Monatsübersicht');
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Navigation
  const previousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const safeNumber = (value, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;

  const totalWeeks = Number.isFinite(summary.totalWeeks)
    ? summary.totalWeeks
    : Number.isFinite(summary.workingDaysCount)
      ? parseFloat((summary.workingDaysCount / 5).toFixed(2))
      : 0;

  const weeklyQuota = safeNumber(summary.weeklyQuota, 0);
  const totalBooked = safeNumber(summary.totalBooked, 0);
  const expectedHours = safeNumber(
    summary.expectedHours,
    totalWeeks * weeklyQuota
  );
  const totalQuota = Number.isFinite(summary.totalQuota)
    ? summary.totalQuota
    : totalWeeks * weeklyQuota;
  const difference = safeNumber(summary.difference, totalBooked - expectedHours);

  const progressPercentage = expectedHours > 0
    ? (totalBooked / expectedHours) * 100
    : 0;

  return (
    <div className="monthly-hours bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="monthly-hours__header p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Monatlicher Stundenrechner</h2>
            <p className="text-sm">
              Präzise Monatsbilanz basierend auf Arbeitstagen, Feiertagen und Wochen.
            </p>
          </div>
          <div className="monthly-hours__meta">
            <span>Wochenziel: {weeklyQuota.toFixed(1)}h</span>
            <span>Kalenderziel: {totalQuota.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="monthly-hours__nav border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-lg font-semibold text-gray-800">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button
              onClick={goToCurrentMonth}
              className="monthly-hours__current text-sm font-semibold transition-colors"
            >
              Zum aktuellen Monat
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="monthly-hours__summary p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="monthly-hours__card monthly-hours__card--weeks">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Kalenderwochen</div>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{totalWeeks}</div>
            <p className="text-xs mt-1">Wochenschnitt: {weeklyQuota.toFixed(1)}h</p>
          </div>

          <div className="monthly-hours__card monthly-hours__card--days">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Arbeitstage</div>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{summary.workingDaysCount ?? 0}</div>
            <p className="text-xs mt-1">Feiertage werden automatisch abgezogen.</p>
          </div>

          <div className="monthly-hours__card monthly-hours__card--expected">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Soll (bereinigt)</div>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{expectedHours.toFixed(1)}h</div>
            <p className="text-xs mt-1">Kalenderziel: {totalQuota.toFixed(1)}h</p>
          </div>

          <div className="monthly-hours__card monthly-hours__card--booked">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Gebucht gesamt</div>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{totalBooked.toFixed(1)}h</div>
            <p className="text-xs mt-1">Monatsfortschritt in Echtzeit.</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="monthly-hours__progress mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monatsfortschritt (bereinigt)</span>
            <span className="text-sm font-semibold text-gray-900">{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>{totalBooked.toFixed(1)}h gebucht</span>
            <span>{expectedHours.toFixed(1)}h Ziel</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                progressPercentage > 100
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : progressPercentage >= 90
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : 'bg-gradient-to-r from-sky-500 to-teal-500'
              }`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Difference Card */}
        <div className={`monthly-hours__delta rounded-lg p-6 mb-6 ${
          summary.status === 'over'
            ? 'bg-gradient-to-r from-rose-50 to-rose-100 border-2 border-rose-300'
            : summary.status === 'under'
            ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-300'
          : 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-300'
        }`}>
          <div className="text-center">
            <div className={`text-6xl font-bold mb-2 ${
              summary.status === 'over'
                ? 'text-rose-700'
                : summary.status === 'under'
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}>
              {difference >= 0 ? '+' : ''}{difference.toFixed(1)}h
            </div>
            <div className={`text-lg font-semibold ${
              summary.status === 'over'
                ? 'text-rose-800'
                : summary.status === 'under'
                ? 'text-amber-800'
                : 'text-emerald-800'
            }`}>
              {summary.status === 'over' && 'Über dem Soll'}
              {summary.status === 'under' && 'Unter dem Soll'}
              {summary.status === 'exact' && 'Perfekte Balance'}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {summary.status === 'over' && `Du hast ${Math.abs(difference).toFixed(1)} Stunden mehr geplant als vorgesehen.`}
              {summary.status === 'under' && `Dir fehlen noch ${Math.abs(difference).toFixed(1)} Stunden zum Soll.`}
              {summary.status === 'exact' && 'Deine geplanten Stunden treffen das Soll exakt.'}
            </p>
          </div>
        </div>

        {/* Weekly Breakdown */}
        {summary.weeks && summary.weeks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Wöchentliche Aufschlüsselung</h3>
            <div className="space-y-2">
              {summary.weeks.map((week, index) => {
                const weekTarget = Number.isFinite(week.expectedHours)
                  ? week.expectedHours
                  : weeklyQuota;
                const weekPercentage = weekTarget > 0
                  ? (week.totalBooked / weekTarget) * 100
                  : 0;

                const weekStartDate = parseDateString(week.weekStart);

                return (
                  <div key={index} className="monthly-hours__week bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Woche ab {weekStartDate ? weekStartDate.toLocaleDateString('de-DE') : '—'}
                        {Number.isFinite(week.workingDaysCount) && (
                          <span className="text-xs text-gray-500"> · {week.workingDaysCount} Arbeitstage</span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {week.totalBooked.toFixed(1)}h / {weekTarget.toFixed(1)}h
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          weekPercentage > 100
                            ? 'bg-red-500'
                            : weekPercentage >= 90
                            ? 'bg-green-500'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(weekPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyHoursCalculator;
