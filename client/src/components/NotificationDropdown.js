import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, MessageSquare, AtSign, ThumbsUp, Calendar, ClipboardList } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllReadNotifications
} from '../utils/apiEnhanced';

const NotificationDropdown = ({ socket }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadUnreadCount();
    loadNotifications();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('notification:new', handleNewNotification);
      return () => socket.off('notification:new', handleNewNotification);
    }
  }, [socket]);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [filter, isOpen]);

  const handleNewNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    loadUnreadCount();

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.content,
        icon: '/logo192.png'
      });
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(parseInt(response.data.total) || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params = filter === 'unread' ? { is_read: false } : filter !== 'all' ? { type: filter } : {};
      const response = await getNotifications(params);
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllReadNotifications();
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await handleMarkAsRead(notification.id);
    if (notification.action_url) window.location.href = notification.action_url;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      message: <MessageSquare className="w-4 h-4 text-blue-500" />,
      mention: <AtSign className="w-4 h-4 text-purple-500" />,
      reaction: <ThumbsUp className="w-4 h-4 text-pink-500" />,
      task_assigned: <ClipboardList className="w-4 h-4 text-green-500" />,
      calendar_event: <Calendar className="w-4 h-4 text-orange-500" />
    };
    return icons[type] || <Bell className="w-4 h-4 text-gray-500" />;
  };

  const filterOptions = [
    { value: 'all', label: 'Усі' },
    { value: 'unread', label: 'Непрочитані' },
    { value: 'message', label: 'Повідомлення' },
    { value: 'mention', label: 'Згадки' },
    { value: 'task_assigned', label: 'Завдання' }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-screen max-w-md sm:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Сповіщення</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-blue-600 hover:text-blue-700 transition" title="Позначити всі">
                    <CheckCheck className="w-5 h-5" />
                  </button>
                )}
                <button onClick={handleClearAll} className="text-gray-600 hover:text-gray-700 transition" title="Очистити">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap transition ${
                    filter === option.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Завантаження...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Немає сповіщень</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 sm:p-4 hover:bg-gray-50 transition cursor-pointer relative ${!notification.is_read ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notification.title}
                          </h4>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                            className="text-gray-400 hover:text-red-500 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {notification.content && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.content}</p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: uk })}
                          </span>

                          {!notification.is_read && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                              className="text-xs text-blue-600 hover:text-blue-700 transition"
                            >
                              Позначити
                            </button>
                          )}
                        </div>
                      </div>

                      {!notification.is_read && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-blue-500 rounded-r"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-center text-gray-500">
                {unreadCount > 0 ? `${unreadCount} непрочитан${unreadCount === 1 ? 'е' : 'их'}` : 'Всі сповіщення прочитані'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
