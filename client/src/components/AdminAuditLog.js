import React, { useState, useEffect } from 'react';
import {
  Shield, User, Clock, Filter, ChevronLeft, ChevronRight, BarChart3, Search, Download
} from 'lucide-react';
import { getAuditLog, getAuditLogStats } from '../utils/apiEnhanced';
import { showError } from '../utils/toast';

/**
 * AdminAuditLog Component
 * Activity history and audit log for administrators
 */
const AdminAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    resource: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [page, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await getAuditLog(params);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading audit log:', error);
      showError('Fehler beim Laden des Audit-Logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await getAuditLogStats(params);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      userId: '',
      resource: '',
      start_date: '',
      end_date: ''
    });
    setPage(1);
  };

  const exportLogs = () => {
    const csv = [
      ['Zeitstempel', 'Aktion', 'Benutzer', 'Ressource', 'Details'].join(','),
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString('de-DE'),
        log.action,
        log.user_name || log.user_email || 'System',
        log.resource || '-',
        JSON.stringify(log.details || {}).replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('create')) return 'bg-green-100 text-green-700';
    if (action.includes('update')) return 'bg-blue-100 text-blue-700';
    if (action.includes('delete')) return 'bg-red-100 text-red-700';
    if (action.includes('login')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  };

  if (loading && !logs.length) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Aktivitätsprotokoll</h2>
            <p className="text-sm text-slate-600">Vollständige Aktivitätshistorie aller Benutzer</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              showFilters
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-700">Gesamtaktionen</h3>
            </div>
            <p className="text-4xl font-bold text-blue-900">{stats.total}</p>
          </div>

          <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
            <h3 className="font-semibold text-slate-700 mb-3">Top Aktionen</h3>
            <div className="space-y-1">
              {stats.byAction.slice(0, 3).map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-green-800">{item.action}</span>
                  <span className="font-bold text-green-900">{parseInt(item.count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
            <h3 className="font-semibold text-slate-700 mb-3">Aktivste Benutzer</h3>
            <div className="space-y-1">
              {stats.byUser.slice(0, 3).map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-purple-800 truncate">{item.name}</span>
                  <span className="font-bold text-purple-900">{parseInt(item.count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
            <h3 className="font-semibold text-slate-700 mb-3">Top Ressourcen</h3>
            <div className="space-y-1">
              {stats.byResource.slice(0, 3).map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-orange-800">{item.resource}</span>
                  <span className="font-bold text-orange-900">{parseInt(item.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="p-6 bg-slate-50 rounded-xl border-2 border-slate-200">
          <h3 className="font-bold text-lg text-slate-900 mb-4">Filter</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Aktion</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                placeholder="z.B. create_task"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Benutzer ID</label>
              <input
                type="number"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                placeholder="User ID"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ressource</label>
              <input
                type="text"
                value={filters.resource}
                onChange={(e) => handleFilterChange('resource', e.target.value)}
                placeholder="z.B. tasks"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Von Datum</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bis Datum</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={loadLogs}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Filtern
            </button>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Zeit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Benutzer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Aktion</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Ressource</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-4 h-4" />
                      {formatDate(log.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{log.user_name || 'System'}</p>
                        <p className="text-xs text-slate-500">{log.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{log.resource || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <details className="text-xs text-slate-600">
                      <summary className="cursor-pointer hover:text-blue-600">Anzeigen</summary>
                      <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    Keine Aktivitäten gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Seite {pagination.page} von {pagination.totalPages} • {pagination.total} Einträge gesamt
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLog;
