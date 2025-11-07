import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, Clock, X, Trash2, Check, ChevronDown, ChevronUp,
  AlertCircle, Star, MessageSquare, Calendar, ListTodo, Settings,
  TrendingUp, BarChart3, Moon, Sun
} from 'lucide-react';
import {
  getSmartNotifications,
  dismissNotification,
  snoozeNotification,
  takeNotificationAction,
  getGroupNotifications,
  markGroupAsRead
} from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const SmartNotificationPanel = ({ onClose, onOpenPreferences }) => {
  const [notifications, setNotifications] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDndActive, setIsDndActive] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [filterPriority, setFilterPriority] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'time'

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSmartNotifications();
      setNotifications(response.data.notifications || []);
      setGroups(response.data.groups || []);
      setUnreadCount(response.data.unread_count || 0);
      setIsDndActive(response.data.is_dnd_active || false);
    } catch (error) {
      console.error('Error loading smart notifications:', error);
      showError('Fehler beim Laden der Benachrichtigungen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleDismiss = async (id) => {
    try {
      await dismissNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      showSuccess('Benachrichtigung ausgeblendet');
    } catch (error) {
      console.error('Error dismissing notification:', error);
      showError('Fehler beim Ausblenden');
    }
  };

  const handleSnooze = async (id, minutes = 60) => {
    try {
      await snoozeNotification(id, minutes);
      setNotifications(prev => prev.filter(n => n.id !== id));
      showSuccess(`Verschoben um ${minutes} Minuten`);
    } catch (error) {
      console.error('Error snoozing notification:', error);
      showError('Fehler beim Verschieben');
    }
  };

  const handleAction = async (id, actionType) => {
    try {
      await takeNotificationAction(id, actionType);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      showSuccess('Aktion ausgeführt');
    } catch (error) {
      console.error('Error taking action:', error);
      showError('Fehler beim Ausführen der Aktion');
    }
  };

  const handleGroupExpand = async (groupKey) => {
    if (expandedGroups.has(groupKey)) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(groupKey);
        return next;
      });
    } else {
      try {
        const response = await getGroupNotifications(groupKey);
        setExpandedGroups(prev => new Set(prev).add(groupKey));
        // Could display grouped notifications here
      } catch (error) {
        console.error('Error loading group:', error);
        showError('Fehler beim Laden der Gruppe');
      }
    }
  };

  const handleMarkGroupRead = async (groupKey) => {
    try {
      await markGroupAsRead(groupKey);
      setGroups(prev => prev.filter(g => g.group_key !== groupKey));
      loadNotifications();
      showSuccess('Gruppe als gelesen markiert');
    } catch (error) {
      console.error('Error marking group as read:', error);
      showError('Fehler beim Markieren');
    }
  };

  const getPriorityColor = (score) => {
    if (score >= 75) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getPriorityIcon = (score) => {
    if (score >= 75) return <AlertCircle className="w-4 h-4" />;
    if (score >= 50) return <Star className="w-4 h-4" />;
    return <Bell className="w-4 h-4" />;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-5 h-5" />;
      case 'task_assigned': return <ListTodo className="w-5 h-5" />;
      case 'calendar_event': return <Calendar className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const filteredNotifications = notifications
    .filter(n => {
      if (filterPriority === 'all') return true;
      if (filterPriority === 'high') return n.ai_priority_score >= 75;
      if (filterPriority === 'medium') return n.ai_priority_score >= 50 && n.ai_priority_score < 75;
      if (filterPriority === 'low') return n.ai_priority_score < 50;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        return b.ai_priority_score - a.ai_priority_score;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-end pt-0">
      <div className="bg-white h-screen w-full max-w-md md:max-w-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold">Smart Benachrichtigungen</h3>
                <p className="text-xs text-blue-100">{unreadCount} ungelesen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDndActive && (
                <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg text-xs">
                  <Moon className="w-3 h-3" />
                  <span>Nicht stören</span>
                </div>
              )}
              <button
                onClick={onOpenPreferences}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                title="Einstellungen"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterPriority('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                filterPriority === 'all'
                  ? 'bg-white text-blue-700'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setFilterPriority('high')}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1 ${
                filterPriority === 'high'
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              Hoch
            </button>
            <button
              onClick={() => setFilterPriority('medium')}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1 ${
                filterPriority === 'medium'
                  ? 'bg-white text-orange-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              <Star className="w-3 h-3" />
              Mittel
            </button>
            <button
              onClick={() => setFilterPriority('low')}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                filterPriority === 'low'
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Niedrig
            </button>
            <button
              onClick={() => setSortBy(sortBy === 'priority' ? 'time' : 'priority')}
              className="px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap bg-white/20 hover:bg-white/30 transition flex items-center gap-1 ml-auto"
              title={sortBy === 'priority' ? 'Nach Zeit sortieren' : 'Nach Priorität sortieren'}
            >
              {sortBy === 'priority' ? <TrendingUp className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {sortBy === 'priority' ? 'Priorität' : 'Zeit'}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && filteredNotifications.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold">Keine Benachrichtigungen</p>
              <p className="text-sm mt-1">Du bist auf dem neuesten Stand!</p>
            </div>
          )}

          {/* Grouped Notifications */}
          {groups.map(group => (
            <div
              key={group.group_key}
              className="bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                    {getTypeIcon(group.group_type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{group.title}</h4>
                    <p className="text-xs text-slate-500">
                      {group.notification_count} Benachrichtigungen
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleGroupExpand(group.group_key)}
                  className="p-1 hover:bg-slate-100 rounded transition"
                >
                  {expandedGroups.has(group.group_key) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{group.summary}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkGroupRead(group.group_key)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  <Check className="w-4 h-4" />
                  Alle lesen
                </button>
                <span className="text-xs text-slate-500">
                  {format(new Date(group.last_updated_at), 'dd.MM HH:mm', { locale: de })}
                </span>
              </div>
            </div>
          ))}

          {/* Individual Notifications */}
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`rounded-xl border-2 p-4 hover:shadow-md transition ${
                !notification.is_read ? 'bg-white' : 'bg-slate-50 opacity-75'
              } ${getPriorityColor(notification.ai_priority_score)}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {getTypeIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900 truncate">{notification.title}</h4>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getPriorityColor(notification.ai_priority_score)}`}>
                      {getPriorityIcon(notification.ai_priority_score)}
                      <span>{notification.ai_priority_score}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{notification.content}</p>
                  {notification.related_user_name && (
                    <p className="text-xs text-slate-500 mt-1">Von: {notification.related_user_name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {format(new Date(notification.created_at), 'dd.MM.yy HH:mm', { locale: de })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSnooze(notification.id, 60)}
                    className="p-2 hover:bg-white rounded-lg transition"
                    title="60 Min verschieben"
                  >
                    <Clock className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleAction(notification.id, 'view')}
                    className="p-2 hover:bg-white rounded-lg transition"
                    title="Öffnen"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                  <button
                    onClick={() => handleDismiss(notification.id)}
                    className="p-2 hover:bg-white rounded-lg transition"
                    title="Ausblenden"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {notification.group_size > 1 && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Teil von {notification.group_size} gruppierten Benachrichtigungen
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SmartNotificationPanel;
