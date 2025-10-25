import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MonthlyHoursCalculator = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load monthly summary
  const loadSummary = async () => {
    try {
      setLoading(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const response = await api.get(`/schedule/hours-summary/month/${year}/${month}`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
      toast.error('Failed to load monthly summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [currentMonth]);

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

  const progressPercentage = summary.totalQuota > 0
    ? (summary.totalBooked / summary.totalQuota) * 100
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <h2 className="text-2xl font-bold mb-1">Monthly Hours Calculator</h2>
        <p className="text-purple-100 text-sm">
          Track your monthly work hours balance
        </p>
      </div>

      {/* Month Navigation */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
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
              className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
            >
              Go to current month
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
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Weeks */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-blue-800">Total Weeks</div>
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-blue-900">{summary.totalWeeks}</div>
          </div>

          {/* Weekly Quota */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-purple-800">Weekly Quota</div>
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-purple-900">{summary.weeklyQuota}h</div>
          </div>

          {/* Total Quota */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-indigo-800">Monthly Target</div>
              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-indigo-900">{summary.totalQuota.toFixed(1)}h</div>
          </div>

          {/* Total Booked */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-green-800">Total Booked</div>
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-green-900">{summary.totalBooked.toFixed(1)}h</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Progress</span>
            <span className="text-sm font-semibold text-gray-900">{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                progressPercentage > 100
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : progressPercentage >= 90
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600'
              }`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Difference Card */}
        <div className={`rounded-lg p-6 mb-6 ${
          summary.status === 'over'
            ? 'bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300'
            : summary.status === 'under'
            ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300'
            : 'bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300'
        }`}>
          <div className="text-center">
            <div className="text-6xl font-bold mb-2 ${
              summary.status === 'over'
                ? 'text-red-700'
                : summary.status === 'under'
                ? 'text-yellow-700'
                : 'text-green-700'
            }">
              {summary.difference >= 0 ? '+' : ''}{summary.difference.toFixed(1)}h
            </div>
            <div className="text-lg font-semibold ${
              summary.status === 'over'
                ? 'text-red-800'
                : summary.status === 'under'
                ? 'text-yellow-800'
                : 'text-green-800'
            }">
              {summary.status === 'over' && '⚠ Over-Scheduled'}
              {summary.status === 'under' && 'Under-Scheduled'}
              {summary.status === 'exact' && '✓ Perfect Balance'}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {summary.status === 'over' && `You have scheduled ${Math.abs(summary.difference).toFixed(1)} hours more than your monthly quota.`}
              {summary.status === 'under' && `You have ${Math.abs(summary.difference).toFixed(1)} hours remaining to reach your monthly quota.`}
              {summary.status === 'exact' && 'Your scheduled hours perfectly match your monthly quota!'}
            </p>
          </div>
        </div>

        {/* Weekly Breakdown */}
        {summary.weeks && summary.weeks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Weekly Breakdown</h3>
            <div className="space-y-2">
              {summary.weeks.map((week, index) => {
                const weekPercentage = summary.weeklyQuota > 0
                  ? (week.totalBooked / summary.weeklyQuota) * 100
                  : 0;

                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Week starting {new Date(week.weekStart).toLocaleDateString('de-DE')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {week.totalBooked.toFixed(1)}h / {summary.weeklyQuota}h
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          weekPercentage > 100
                            ? 'bg-red-500'
                            : weekPercentage >= 90
                            ? 'bg-green-500'
                            : 'bg-blue-500'
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
