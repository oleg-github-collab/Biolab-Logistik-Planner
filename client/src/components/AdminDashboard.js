import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Shield, Activity, Users, FileText, AlertTriangle,
  TrendingUp, Clock, Filter, Download, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Info, CalendarDays,
  CheckSquare, Trash2, BookOpen, MessageSquare, Settings,
  Send, Edit2, Power, Key, Eye, BarChart3, Server,
  Database, Wifi, UserPlus, UserMinus, ToggleLeft, Bell,
  Save, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { getBroadcastHistory, resendBroadcast } from '../utils/apiEnhanced';

const BROADCAST_HISTORY_LIMIT = 6;
const BROADCAST_SEVERITY_STYLES = {
  info: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100',
  warning: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
  success: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
  error: 'bg-red-50 text-red-600 ring-1 ring-red-100'
};

const formatBroadcastTimestamp = (value) => {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const previewBroadcastMessage = (text = '', maxLength = 120) => {
  const clean = (text || '').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}…`;
};

const BULK_USER_ACTIONS = [
  { value: 'activate', label: 'Aktivieren' },
  { value: 'deactivate', label: 'Deaktivieren' },
  { value: 'delete', label: 'Löschen' },
  { value: 'updateRole', label: 'Rolle ändern' }
];

const USER_ROLE_OPTIONS = [
  { value: 'employee', label: 'Mitarbeiter' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'observer', label: 'Beobachter' }
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [stats, setStats] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: 'all',
    severity: 'all',
    days: 7
  });
  const [liveEvents, setLiveEvents] = useState([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const accessToastRef = useRef(false);
  const [editingUser, setEditingUser] = useState(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [broadcastSeverity, setBroadcastSeverity] = useState('info');
  const [notificationSeverity, setNotificationSeverity] = useState('info');
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [broadcastHistoryLoading, setBroadcastHistoryLoading] = useState(false);
  const [resendingBroadcastId, setResendingBroadcastId] = useState(null);
  const [selectedUsersBulk, setSelectedUsersBulk] = useState([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);
  const [bulkAction, setBulkAction] = useState(BULK_USER_ACTIONS[0].value);
  const [bulkRole, setBulkRole] = useState('employee');
  const [bulkLoading, setBulkLoading] = useState(false);

  const { isConnected, adminEvents, onAdminEvent } = useWebSocketContext();

  const { category, severity, days } = filter;

  // Fetch dashboard overview stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await api.get('/admin/stats');
      setDashboardStats(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAccessDenied(true);
        if (!accessToastRef.current) {
          toast.error('Kein Zugriff auf Administratorfunktionen');
          accessToastRef.current = true;
        }
      } else {
        console.error('Error fetching dashboard stats:', error);
        // Set default empty stats
        setDashboardStats({
          totalUsers: 0,
          activeUsersToday: 0,
          totalEventsThisMonth: 0,
          totalTasks: { todo: 0, 'in-progress': 0, done: 0 },
          totalWasteItems: { pending: 0, scheduled: 0, completed: 0 },
          totalKbArticles: 0,
          totalMessagesToday: 0
        });
      }
    }
  }, []);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/admin/users');
      setAllUsers(response.data.users || response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    setSelectedUsersBulk((prev) =>
      prev.filter((id) => allUsers.some((user) => user.id === id))
    );
  }, [allUsers]);

  useEffect(() => {
    setSelectAllUsers(allUsers.length > 0 && selectedUsersBulk.length === allUsers.length);
  }, [allUsers, selectedUsersBulk]);

  const toggleUserSelection = useCallback((userId) => {
    setSelectedUsersBulk((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  }, []);

  const handleSelectAllUsers = useCallback(() => {
    if (selectAllUsers) {
      setSelectedUsersBulk([]);
      setSelectAllUsers(false);
      return;
    }
    setSelectedUsersBulk(allUsers.map((user) => user.id));
    setSelectAllUsers(true);
  }, [allUsers, selectAllUsers]);

  const performBulkUserAction = useCallback(async () => {
    if (!selectedUsersBulk.length) {
      toast.error('Wähle zuerst Benutzer aus');
      return;
    }

    setBulkLoading(true);
    try {
      const payload =
        bulkAction === 'updateRole'
          ? { action: bulkAction, userIds: selectedUsersBulk, payload: { role: bulkRole } }
          : { action: bulkAction, userIds: selectedUsersBulk };

      const response = await api.post('/admin/users/bulk', payload);

      toast.success(
        `Bulk-Aktion durchgeführt (${response.data.affected || 0} Benutzer betroffen)`
      );
      setSelectedUsersBulk([]);
      setSelectAllUsers(false);
      if (bulkAction !== 'updateRole' && bulkAction !== 'delete') {
        setBulkAction('activate');
      }
      fetchUsers();
    } catch (error) {
      console.error('Bulk user action error:', error);
      toast.error(error.response?.data?.error || 'Bulk-Aktion fehlgeschlagen');
    } finally {
      setBulkLoading(false);
    }
  }, [bulkAction, bulkRole, selectedUsersBulk, fetchUsers]);

  // Fetch system health
  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await api.get('/admin/system-health');
      setSystemHealth(response.data);
    } catch (error) {
      console.error('Error fetching system health:', error);
      setSystemHealth({
        database: 'unknown',
        server: 'running',
        uptime: '0s',
        activeConnections: 0,
        recentErrors: []
      });
    }
  }, []);

  // Fetch activity log
  const fetchActivityLog = useCallback(async () => {
    try {
      const response = await api.get('/admin/activity', { params: { limit: 50 } });
      setActivityLog(response.data.activities || response.data || []);
    } catch (error) {
      console.error('Error fetching activity log:', error);
      setActivityLog([]);
    }
  }, []);

  const fetchBroadcastHistory = useCallback(async () => {
    setBroadcastHistoryLoading(true);
    try {
      const response = await getBroadcastHistory({ limit: BROADCAST_HISTORY_LIMIT });
      setBroadcastHistory(response.data.broadcasts || []);
    } catch (error) {
      console.error('Error fetching broadcast history:', error);
      setBroadcastHistory([]);
    } finally {
      setBroadcastHistoryLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (accessDenied) return;
    try {
      setLoading(true);

      const requests = [
        api.get('/admin/audit/stats', { params: { days } })
          .catch(err => {
            if (err.response?.status === 401 || err.response?.status === 403) {
              setAccessDenied(true);
              if (!accessToastRef.current) {
                toast.error('Kein Zugriff auf Administratorfunktionen');
                accessToastRef.current = true;
              }
              return { data: { total: 0, byCategory: {}, bySeverity: {}, recent_activity: [] } };
            }
            console.error('Stats error:', err);
            return { data: { total: 0, byCategory: {}, bySeverity: {}, recent_activity: [] } };
          }),
        api.get('/admin/audit/logs', { params: { limit: 50, category, severity } })
          .catch(err => {
            if (err.response?.status === 401 || err.response?.status === 403) {
              setAccessDenied(true);
              if (!accessToastRef.current) {
                toast.error('Kein Zugriff auf Administratorfunktionen');
                accessToastRef.current = true;
              }
              return { data: { logs: [] } };
            }
            console.error('Logs error:', err);
            return { data: { logs: [] } };
          }),
        api.get('/admin/users/online')
          .catch(err => {
            if (err.response?.status === 401 || err.response?.status === 403) {
              setAccessDenied(true);
              if (!accessToastRef.current) {
                toast.error('Kein Zugriff auf Administratorfunktionen');
                accessToastRef.current = true;
              }
              return { data: { users: [] } };
            }
            console.error('Online users error:', err);
            return { data: { users: [] } };
          })
      ];

      const [statsRes, logsRes, usersRes] = await Promise.all(requests);

      setStats(statsRes.data);
      setLogs(logsRes.data.logs || []);
      setOnlineUsers(usersRes.data.users || []);

      // Fetch additional data based on active section
      if (activeSection === 'overview') {
        await fetchDashboardStats();
      } else if (activeSection === 'users') {
        await fetchUsers();
      } else if (activeSection === 'monitoring') {
        await fetchSystemHealth();
      } else if (activeSection === 'activity') {
        await fetchActivityLog();
      }

      await fetchBroadcastHistory();
    } catch (error) {
      console.error('Fehler beim Laden der Admin-Daten:', error);
      toast.error('Fehler beim Laden der Administrator-Daten');
    } finally {
      setLoading(false);
    }
  }, [
    accessDenied,
    category,
    days,
    severity,
    activeSection,
    fetchDashboardStats,
    fetchUsers,
    fetchSystemHealth,
    fetchActivityLog,
    fetchBroadcastHistory
  ]);

  useEffect(() => {
    if (accessDenied) return;
    fetchData();
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 120000);
    return () => clearInterval(interval);
  }, [fetchData, accessDenied]);

  useEffect(() => {
    if (!onAdminEvent || accessDenied) return;
    const appendEvent = (event) => {
      setLiveEvents(prev => [event, ...prev].slice(0, 25));
      fetchData();
    };

    const unsubscribeAudit = onAdminEvent('audit_log', appendEvent);
    const unsubscribeBroadcast = onAdminEvent('broadcast', appendEvent);

    return () => {
      unsubscribeAudit?.();
      unsubscribeBroadcast?.();
    };
  }, [fetchData, onAdminEvent, accessDenied]);

  useEffect(() => {
    if (!adminEvents || adminEvents.length === 0) return;
    const latest = adminEvents[adminEvents.length - 1];
    if (latest) {
      setLiveEvents(prev => {
        const exists = prev.some(event => event.timestamp === latest.timestamp && event.action === latest.action);
        if (exists) return prev;
        return [latest, ...prev].slice(0, 25);
      });
    }
  }, [adminEvents]);

  // User management functions
  const handleUpdateUser = async (userId, updates) => {
    try {
      await api.put(`/admin/users/${userId}`, updates);
      toast.success('Benutzer erfolgreich aktualisiert');
      setEditingUser(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Fehler beim Aktualisieren des Benutzers');
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Möchten Sie diesen Benutzer wirklich deaktivieren?')) return;
    try {
      await api.post(`/admin/users/${userId}/deactivate`);
      toast.success('Benutzer deaktiviert');
      await fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error('Fehler beim Deaktivieren des Benutzers');
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/activate`);
      toast.success('Benutzer aktiviert');
      await fetchUsers();
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('Fehler beim Aktivieren des Benutzers');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Möchten Sie das Passwort für diesen Benutzer wirklich zurücksetzen?')) return;
    try {
      const response = await api.post(`/admin/users/${userId}/reset-password`);
      toast.success(`Neues Passwort: ${response.data.newPassword}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Fehler beim Zurücksetzen des Passworts');
    }
  };

  // Broadcast message
  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('Bitte geben Sie eine Nachricht ein');
      return;
    }
    try {
      await api.post('/admin/broadcast', { message: broadcastMessage, type: broadcastSeverity });
      toast.success('Nachricht erfolgreich gesendet');
      setBroadcastMessage('');
    } catch (error) {
      console.error('Error broadcasting message:', error);
      toast.error('Fehler beim Senden der Nachricht');
    }
  };

  // Send notification to all users
  const handleSendNotification = async () => {
    if (!notificationMessage.trim()) {
      toast.error('Bitte geben Sie eine Benachrichtigung ein');
      return;
    }
    try {
      await api.post('/admin/broadcast', {
        message: notificationMessage,
        type: notificationSeverity
      });
      toast.success('Benachrichtigung an alle Benutzer gesendet');
      setNotificationMessage('');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Fehler beim Senden der Benachrichtigung');
    }
  };

  const handleResendBroadcast = useCallback(async (logEntry) => {
    if (!logEntry?.id) return;
    setResendingBroadcastId(logEntry.id);
    try {
      const response = await resendBroadcast(logEntry.id);
      toast.success(
        `Broadcast erneut gesendet (${response.data.recipients || 0} Empfänger)`
      );
      fetchBroadcastHistory();
    } catch (error) {
      console.error('Error resending broadcast:', error);
      toast.error(error.response?.data?.error || 'Broadcast konnte nicht erneut gesendet werden');
    } finally {
      setResendingBroadcastId(null);
    }
  }, [fetchBroadcastHistory]);

  // Export data
  const handleExportData = async (dataType) => {
    try {
      const response = await api.get(`/admin/export/${dataType}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${dataType}-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`${dataType} erfolgreich exportiert`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Fehler beim Exportieren von ${dataType}`);
    }
  };

  const exportLogs = async (format = 'json') => {
    try {
      const response = await api.get('/admin/audit/export', {
        params: { format, days: filter.days },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Logs erfolgreich exportiert');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Fehler beim Exportieren der Logs');
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

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'observer': return 'bg-teal-100 text-teal-800';
      case 'employee': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const broadcastTotalRecipients = broadcastHistory.reduce(
    (sum, entry) => sum + (entry.recipients || 0),
    0
  );
  const broadcastLastSentAt = broadcastHistory[0]?.created_at || null;

  if (accessDenied) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-700">
        <h2 className="text-lg font-semibold mb-2">Kein Zugriff</h2>
        <p className="text-sm">
          Für diese Administratoransicht ist eine Rolle mit Systemrechten erforderlich (Admin oder Superadmin).
          Bitte melden Sie sich mit einem entsprechenden Benutzer an oder wenden Sie sich an den Systemverantwortlichen.
        </p>
      </div>
    );
  }

  if (loading && !stats && !dashboardStats) {
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
            <h1 className="text-2xl font-bold text-gray-900">Administrator-Panel</h1>
            <p className="text-sm text-gray-600">Systemüberwachung und Kontrolle</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isConnected ? '#047857' : '#dc2626' }} />
            {isConnected ? 'Live verbunden' : 'Offline'}
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Übersicht
          </button>
          <button
            onClick={() => setActiveSection('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Benutzer
          </button>
          <button
            onClick={() => setActiveSection('monitoring')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'monitoring'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Monitoring
          </button>
          <button
            onClick={() => setActiveSection('bulk')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'bulk'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Send className="w-4 h-4" />
            Massenvorgänge
          </button>
          <button
            onClick={() => setActiveSection('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            Einstellungen
          </button>
          <button
            onClick={() => setActiveSection('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'audit'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Audit-Logs
          </button>
        </div>
      </div>

      {/* Dashboard Overview Section */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          {dashboardStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                  <span className="text-2xl font-bold text-gray-900">{dashboardStats.totalUsers || 0}</span>
                </div>
                <p className="text-sm text-gray-600">Benutzer Gesamt</p>
                <p className="text-xs text-green-600 mt-1">{dashboardStats.activeUsersToday || 0} heute aktiv</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <CalendarDays className="w-8 h-8 text-indigo-600" />
                  <span className="text-2xl font-bold text-gray-900">{dashboardStats.totalEventsThisMonth || 0}</span>
                </div>
                <p className="text-sm text-gray-600">Termine diesen Monat</p>
                <p className="text-xs text-gray-400 mt-1">Kalendereinträge</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <CheckSquare className="w-8 h-8 text-green-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {(dashboardStats.totalTasks?.todo || 0) +
                     (dashboardStats.totalTasks?.['in-progress'] || 0) +
                     (dashboardStats.totalTasks?.done || 0)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Aufgaben Gesamt</p>
                <p className="text-xs text-gray-400 mt-1">
                  {dashboardStats.totalTasks?.todo || 0} offen, {dashboardStats.totalTasks?.['in-progress'] || 0} in Arbeit, {dashboardStats.totalTasks?.done || 0} erledigt
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <Trash2 className="w-8 h-8 text-orange-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {(dashboardStats.totalWasteItems?.pending || 0) +
                     (dashboardStats.totalWasteItems?.scheduled || 0) +
                     (dashboardStats.totalWasteItems?.completed || 0)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Abfall-Einträge</p>
                <p className="text-xs text-gray-400 mt-1">
                  {dashboardStats.totalWasteItems?.pending || 0} ausstehend
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <BookOpen className="w-8 h-8 text-purple-600" />
                  <span className="text-2xl font-bold text-gray-900">{dashboardStats.totalKbArticles || 0}</span>
                </div>
                <p className="text-sm text-gray-600">KB Artikel</p>
                <p className="text-xs text-gray-400 mt-1">Wissensdatenbank</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <MessageSquare className="w-8 h-8 text-cyan-600" />
                  <span className="text-2xl font-bold text-gray-900">{dashboardStats.totalMessagesToday || 0}</span>
                </div>
                <p className="text-sm text-gray-600">Nachrichten heute</p>
                <p className="text-xs text-gray-400 mt-1">Kommunikation</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <Wifi className="w-8 h-8 text-green-600" />
                  <span className="text-2xl font-bold text-gray-900">{onlineUsers.length}</span>
                </div>
                <p className="text-sm text-gray-600">Jetzt Online</p>
                <p className="text-xs text-gray-400 mt-1">Aktive Verbindungen</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {(stats?.bySeverity?.high || 0) + (stats?.bySeverity?.critical || 0)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Kritische Ereignisse</p>
                <p className="text-xs text-gray-400 mt-1">Benötigen Aufmerksamkeit</p>
              </div>
            </div>
          )}

          {/* Live Events Feed */}
          {liveEvents.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Live-System-Feed</h2>
                <span className="text-xs uppercase tracking-wide text-blue-600 font-semibold">
                  Echtzeit
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-3">
                {liveEvents.map((event, idx) => (
                  <div
                    key={`${event.timestamp}-${event.action || event.message}-${idx}`}
                    className="flex items-start gap-3 border-l-4 border-blue-500 bg-blue-50 rounded-lg px-3 py-2"
                  >
                    <div className="text-sm font-semibold text-blue-700">
                      {event.type === 'broadcast' ? 'Broadcast' : 'Audit'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">
                        {event.message || event.action || 'Systemereignis'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.timestamp).toLocaleString('de-DE')}
                        {event.from && ` • ${event.from}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Broadcast History */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Broadcast-Verlauf</h2>
                <p className="text-sm text-gray-500">
                  Letzte {broadcastHistory.length || 0} Broadcasts im Blick behalten.
                </p>
              </div>
              <button
                onClick={fetchBroadcastHistory}
                disabled={broadcastHistoryLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Aktualisieren
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-500 mb-4">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-slate-400">Letzter Versand</p>
                <p className="text-sm font-semibold text-gray-900">{formatBroadcastTimestamp(broadcastLastSentAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-slate-400">Empfänger gesamt</p>
                <p className="text-sm font-semibold text-gray-900">{broadcastTotalRecipients}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-slate-400">Einträge</p>
                <p className="text-sm font-semibold text-gray-900">{broadcastHistory.length}</p>
              </div>
            </div>

            {broadcastHistoryLoading ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6">
                <div className="flex items-center justify-center gap-3 text-sm text-blue-600">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Lade Broadcasts…
                </div>
              </div>
            ) : broadcastHistory.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-sm text-gray-500">
                Noch keine Broadcasts vorhanden. Sende eine Nachricht, um den Verlauf zu füllen.
              </div>
            ) : (
              <div className="space-y-3">
                {broadcastHistory.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-4 border border-slate-100 rounded-2xl p-4 bg-slate-50 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {previewBroadcastMessage(log.message)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {log.admin_name || 'Admin'} · {formatBroadcastTimestamp(log.created_at)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Empfänger: {log.recipients || 0}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${BROADCAST_SEVERITY_STYLES[log.severity || 'info']}`}
                      >
                        {(log.severity || 'info').toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResendBroadcast(log)}
                        disabled={resendingBroadcastId === log.id}
                        className="text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-60"
                      >
                        {resendingBroadcastId === log.id ? 'Sende…' : 'Erneut senden'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Online Users */}
          {onlineUsers.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Online Benutzer
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
        </div>
      )}

      {/* User Management Section */}
      {activeSection === 'users' && (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Benutzerverwaltung
          </h2>
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900">
                  Bulk-Operationen
                </p>
                <p className="text-xs text-slate-500">
                  {selectedUsersBulk.length} Benutzer ausgewählt.
                  {selectedUsersBulk.length === 0 && ' Bitte wähle Nutzer in der Tabelle aus.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
                >
                  {BULK_USER_ACTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {bulkAction === 'updateRole' && (
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {USER_ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={performBulkUserAction}
                  disabled={bulkLoading || selectedUsersBulk.length === 0}
                  className="rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white shadow hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? 'Wird angewendet…' : 'Bulk ausführen'}
                </button>
              </div>
            </div>
            {selectedUsersBulk.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUsersBulk([]);
                  setSelectAllUsers(false);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                Auswahl aufheben
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectAllUsers}
                      onChange={handleSelectAllUsers}
                      aria-label="Alle Benutzer auswählen"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Benutzer
                  </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-Mail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rolle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        Keine Benutzer gefunden
                      </td>
                    </tr>
                ) : (
                  allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsersBulk.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          aria-label={`Benutzer ${user.name} auswählen`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {user.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.employment_type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-yellow-600 hover:text-yellow-800"
                              title="Passwort zurücksetzen"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            {user.is_active ? (
                              <button
                                onClick={() => handleDeactivateUser(user.id)}
                                className="text-orange-600 hover:text-orange-800"
                                title="Deaktivieren"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateUser(user.id)}
                                className="text-green-600 hover:text-green-800"
                                title="Aktivieren"
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setActiveSection('activity')}
                              className="text-gray-600 hover:text-gray-800"
                              title="Aktivitätsprotokoll anzeigen"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit User Modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Benutzer bearbeiten
                </h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  handleUpdateUser(editingUser.id, {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    role: formData.get('role')
                  });
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={editingUser.name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-Mail
                      </label>
                      <input
                        type="email"
                        name="email"
                        defaultValue={editingUser.email}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rolle
                      </label>
                      <select
                        name="role"
                        defaultValue={editingUser.role}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="employee">Employee</option>
                        <option value="observer">Beobachter</option>
                        <option value="admin">Admin</option>
                        {user?.role === 'superadmin' && (
                          <option value="superadmin">Superadmin</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Abbrechen
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Monitoring Section */}
      {activeSection === 'monitoring' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              System-Monitoring
            </h2>
            {systemHealth && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Datenbankstatus</span>
                    <Database className={`w-5 h-5 ${
                      systemHealth.database === 'healthy' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <p className={`text-lg font-semibold ${
                    systemHealth.database === 'healthy' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {systemHealth.database === 'healthy' ? 'Gesund' : systemHealth.database}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Server-Status</span>
                    <Server className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-green-600">
                    {systemHealth.server || 'Running'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Server-Laufzeit</span>
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {systemHealth.uptime || '0s'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">WebSocket-Verbindungen</span>
                    <Wifi className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {systemHealth.activeConnections || 0}
                  </p>
                </div>
              </div>
            )}

            {systemHealth?.recentErrors && systemHealth.recentErrors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Aktuelle Systemfehler
                </h3>
                <div className="space-y-2">
                  {systemHealth.recentErrors.map((error, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800 font-medium">{error.message}</p>
                      <p className="text-xs text-red-600 mt-1">
                        {new Date(error.timestamp).toLocaleString('de-DE')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Operations Section */}
      {activeSection === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Massenvorgänge
            </h2>

            {/* Broadcast Message */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Systemnachricht senden
              </h3>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Priorität</label>
                <select
                  value={broadcastSeverity}
                  onChange={(e) => setBroadcastSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">Info</option>
                  <option value="success">Erfolg</option>
                  <option value="warning">Warnung</option>
                  <option value="error">Kritisch</option>
                </select>
              </div>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                rows="3"
                placeholder="Nachricht an alle Benutzer..."
              />
              <button
                onClick={handleBroadcast}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Nachricht an alle senden
              </button>
            </div>

            {/* Send Notification */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Benachrichtigung senden
              </h3>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Priorität</label>
                <select
                  value={notificationSeverity}
                  onChange={(e) => setNotificationSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="info">Info</option>
                  <option value="success">Erfolg</option>
                  <option value="warning">Warnung</option>
                  <option value="error">Kritisch</option>
                </select>
              </div>
              <textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                rows="3"
                placeholder="Benachrichtigung an alle Benutzer..."
              />
              <button
                onClick={handleSendNotification}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Benachrichtigung an alle senden
              </button>
            </div>

            {/* Export Data */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Daten exportieren
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleExportData('users')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Benutzer
                </button>
                <button
                  onClick={() => handleExportData('events')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Termine
                </button>
                <button
                  onClick={() => handleExportData('tasks')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Aufgaben
                </button>
                <button
                  onClick={() => handleExportData('waste')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Abfall
                </button>
                <button
                  onClick={() => handleExportData('kb-articles')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  KB Artikel
                </button>
                <button
                  onClick={() => exportLogs('json')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Audit-Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Systemeinstellungen
            </h2>

            <div className="space-y-4">
              {/* Maintenance Mode */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="text-md font-semibold text-gray-900">Wartungsmodus</h3>
                  <p className="text-sm text-gray-600">
                    System für Wartungsarbeiten sperren
                  </p>
                </div>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    maintenanceMode ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Feature Toggles */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  Feature-Schalter
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Kalender-Modul</span>
                    <ToggleLeft className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Kanban-Board</span>
                    <ToggleLeft className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Abfallverwaltung</span>
                    <ToggleLeft className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Messaging</span>
                    <ToggleLeft className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Feature-Toggles sind derzeit nur zur Ansicht verfügbar
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      {activeSection === 'audit' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filter:</span>
              </div>

              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Alle Kategorien</option>
                <option value="authentication">Authentifizierung</option>
                <option value="authorization">Autorisierung</option>
                <option value="data_modification">Datenänderungen</option>
                <option value="security">Sicherheit</option>
                <option value="system">System</option>
              </select>

              <select
                value={filter.severity}
                onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Alle Stufen</option>
                <option value="critical">Kritisch</option>
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
              </select>

              <select
                value={filter.days}
                onChange={(e) => setFilter({ ...filter, days: Number(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={1}>Heute</option>
                <option value={7}>7 Tage</option>
                <option value={30}>30 Tage</option>
                <option value={90}>90 Tage</option>
              </select>

              <button
                onClick={() => exportLogs('json')}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Letzte Audit-Ereignisse
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zeit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Benutzer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stufe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        Keine Ereignisse zum Anzeigen
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
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
                          {log.reason && <div className="text-xs">Grund: {log.reason}</div>}
                          {log.changes && (
                            <details className="text-xs cursor-pointer">
                              <summary>Änderungen</summary>
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
                Statistik nach Kategorien
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
      )}
    </div>
  );
};

export default AdminDashboard;
