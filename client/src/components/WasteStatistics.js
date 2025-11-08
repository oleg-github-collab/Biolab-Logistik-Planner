import React, { useState, useEffect } from 'react';
import {
  BarChart3, PieChart, TrendingUp, MapPin, Clock, AlertTriangle, Package, CheckCircle
} from 'lucide-react';
import { getWasteStatistics } from '../utils/apiEnhanced';
import { showError } from '../utils/toast';

/**
 * WasteStatistics Component
 * Comprehensive waste management statistics with charts
 */
const WasteStatistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [groupBy, setGroupBy] = useState('month');

  useEffect(() => {
    loadStatistics();
  }, [timeRange, groupBy]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          break;
      }

      const response = await getWasteStatistics({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        group_by: groupBy
      });

      setStats(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
      showError('Fehler beim Laden der Statistik');
    } finally {
      setLoading(false);
    }
  };

  const getHazardLevelColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  const getHazardLevelLabel = (level) => {
    switch (level) {
      case 'critical': return 'Kritisch';
      case 'high': return 'Hoch';
      case 'medium': return 'Mittel';
      case 'low': return 'Niedrig';
      default: return level;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) return null;

  const maxTrendValue = Math.max(...stats.trend.map(t => t.count), 1);
  const maxCategoryValue = Math.max(...stats.byCategory.map(c => parseInt(c.count)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Entsorgungsstatistik</h2>
        </div>

        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Letzte Woche</option>
            <option value="month">Letzter Monat</option>
            <option value="quarter">Letztes Quartal</option>
            <option value="year">Letztes Jahr</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Nach Tag</option>
            <option value="week">Nach Woche</option>
            <option value="month">Nach Monat</option>
            <option value="year">Nach Jahr</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold text-slate-700">Gesamt</h3>
          </div>
          <p className="text-4xl font-bold text-blue-900">{stats.summary.total}</p>
          <p className="text-sm text-blue-700 mt-1">Abfallposten</p>
        </div>

        <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-slate-700">Entsorgt</h3>
          </div>
          <p className="text-4xl font-bold text-green-900">{stats.summary.disposed}</p>
          <p className="text-sm text-green-700 mt-1">
            {stats.summary.total > 0
              ? Math.round((stats.summary.disposed / stats.summary.total) * 100)
              : 0}% der Gesamt
          </p>
        </div>

        <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-orange-600" />
            <h3 className="font-semibold text-slate-700">Ausstehend</h3>
          </div>
          <p className="text-4xl font-bold text-orange-900">{stats.summary.pending}</p>
          <p className="text-sm text-orange-700 mt-1">Wartet auf Entsorgung</p>
        </div>

        <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            <h3 className="font-semibold text-slate-700">Ø Entsorgungsdauer</h3>
          </div>
          <p className="text-4xl font-bold text-purple-900">{stats.summary.avgDisposalDays}</p>
          <p className="text-sm text-purple-700 mt-1">Tage bis Entsorgung</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-lg text-slate-900">Trend über Zeit</h3>
          </div>

          <div className="space-y-3">
            {stats.trend.map((item, index) => {
              const percentage = (item.count / maxTrendValue) * 100;
              const date = new Date(item.period);
              const label = groupBy === 'month'
                ? date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
                : date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

              return (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="font-bold text-blue-600">{item.count}</span>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Category */}
        <div className="p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-lg text-slate-900">Nach Kategorie</h3>
          </div>

          <div className="space-y-3">
            {stats.byCategory.slice(0, 8).map((item, index) => {
              const count = parseInt(item.count);
              const percentage = (count / maxCategoryValue) * 100;

              return (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color || '#3b82f6' }}
                      />
                      <span className="font-medium text-slate-700">{item.category}</span>
                    </div>
                    <span className="font-bold text-green-600">{count}</span>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color || '#3b82f6'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Hazard Level */}
        <div className="p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-lg text-slate-900">Nach Gefahrenstufe</h3>
          </div>

          <div className="space-y-3">
            {stats.byHazardLevel.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${getHazardLevelColor(item.hazard_level)}`} />
                  <span className="font-medium text-slate-900">{getHazardLevelLabel(item.hazard_level)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-900">{parseInt(item.count)}</span>
                  <span className="text-sm text-slate-500">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Locations */}
        <div className="p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-lg text-slate-900">Top Standorte</h3>
          </div>

          <div className="space-y-2">
            {stats.topLocations.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">
                    #{index + 1}
                  </div>
                  <span className="font-medium text-slate-900">{item.location}</span>
                </div>
                <span className="text-xl font-bold text-purple-600">{parseInt(item.count)}</span>
              </div>
            ))}
            {stats.topLocations.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Keine Standortdaten verfügbar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WasteStatistics;
