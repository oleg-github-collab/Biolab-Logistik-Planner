import React, { useState, useEffect } from 'react';
import {
  Shield, Activity, Users, FileText, AlertTriangle,
  TrendingUp, Clock, Filter, Download, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Info
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: 'all',
    severity: 'all',
    days: 7
  });

  const token = localStorage.getItem('token');
  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch audit statistics
      const statsRes = await axios.get(
        `${API_BASE_URL}/admin/audit/stats?days=${filter.days}`,
        axiosConfig
      );
      setStats(statsRes.data);

      // Fetch recent logs
      const logsRes = await axios.get(
        `${API_BASE_URL}/admin/audit/logs?limit=50&category=${filter.category}&severity=${filter.severity}`,
        axiosConfig
      );
      setLogs(logsRes.data.logs || []);

      // Fetch online users
      const usersRes = await axios.get(
        `${API_BASE_URL}/admin/users/online`,
        axiosConfig
      );
      setOnlineUsers(usersRes.data.users || []);

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Помилка завантаження даних адміністратора');
      setLoading(false);
    }
  };

  const exportLogs = async (format = 'json') => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/audit/export?format=${format}&days=${filter.days}`,
        {
          ...axiosConfig,
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Логи експортовано');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Помилка експорту логів');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      case 'low': return <Info className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'authentication': return 'bg-blue-100 text-blue-800';
      case 'authorization': return 'bg-purple-100 text-purple-800';
      case 'data_modification': return 'bg-green-100 text-green-800';
      case 'security': return 'bg-red-100 text-red-800';
      case 'system': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Адміністраторська Панель</h1>
            <p className="text-sm text-gray-600">Моніторинг системи та аудит дій</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Оновити
          </button>
          <button
            onClick={() => exportLogs('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Експорт
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">{stats.total || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Всього Подій</p>
            <p className="text-xs text-gray-400 mt-1">За останні {filter.days} днів</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">{onlineUsers.length}</span>
            </div>
            <p className="text-sm text-gray-600">Онлайн Зараз</p>
            <p className="text-xs text-gray-400 mt-1">Активні користувачі</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <span className="text-2xl font-bold text-gray-900">
                {(stats.bySeverity?.high || 0) + (stats.bySeverity?.critical || 0)}
              </span>
            </div>
            <p className="text-sm text-gray-600">Критичні Події</p>
            <p className="text-xs text-gray-400 mt-1">Потребують уваги</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">
                {stats.byCategory?.data_modification || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">Зміни Даних</p>
            <p className="text-xs text-gray-400 mt-1">Модифікацій</p>
          </div>
        </div>
      )}

      {/* Online Users */}
      {onlineUsers.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            Онлайн Користувачі
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-600">{user.role}</p>
                </div>
                {user.currentPage && (
                  <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded">
                    {user.currentPage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Фільтри:</span>
          </div>

          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Всі категорії</option>
            <option value="authentication">Автентифікація</option>
            <option value="authorization">Авторизація</option>
            <option value="data_modification">Зміни даних</option>
            <option value="security">Безпека</option>
            <option value="system">Система</option>
          </select>

          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Всі рівні</option>
            <option value="critical">Критичні</option>
            <option value="high">Високі</option>
            <option value="medium">Середні</option>
            <option value="low">Низькі</option>
          </select>

          <select
            value={filter.days}
            onChange={(e) => setFilter({ ...filter, days: Number(e.target.value) })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={1}>Сьогодні</option>
            <option value={7}>7 днів</option>
            <option value={30}>30 днів</option>
            <option value={90}>90 днів</option>
          </select>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Останні Події Аудиту
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Час
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категорія
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дія
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Користувач
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рівень
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Деталі
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    Немає подій для відображення
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.userId || 'System'}
                      {log.email && <div className="text-xs text-gray-400">{log.email}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                        {getSeverityIcon(log.severity)}
                        {log.severity}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.ip && <div className="text-xs">IP: {log.ip}</div>}
                      {log.reason && <div className="text-xs">Причина: {log.reason}</div>}
                      {log.changes && (
                        <details className="text-xs cursor-pointer">
                          <summary>Зміни</summary>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Statistics */}
      {stats && stats.byCategory && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Статистика по Категоріях
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(category)}`}>
                  {category}
                </span>
                <span className="text-lg font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
