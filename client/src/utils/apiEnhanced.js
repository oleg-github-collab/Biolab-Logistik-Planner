import axios from 'axios';

const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// USER PROFILE APIs
// ============================================

export const getUserProfile = (userId) =>
  api.get(`/profile/${userId}`);

export const updateUserProfile = (userId, profileData) =>
  api.put(`/profile/${userId}`, profileData);

export const uploadProfilePhoto = (userId, formData) => {
  const config = {
    headers: { 'Content-Type': 'multipart/form-data' }
  };
  return api.post(`/profile/${userId}/photo`, formData, config);
};

export const updateUserPreferences = (userId, preferences) =>
  api.put(`/profile/${userId}/preferences`, preferences);

export const getAllContacts = (params = {}) =>
  api.get('/profile/contacts/all', { params });

export const updateContactSettings = (contactId, settings) =>
  api.post(`/profile/contacts/${contactId}`, settings);

export const getOnlineUsers = () =>
  api.get('/profile/online-users/list');

// ============================================
// NOTIFICATIONS APIs
// ============================================

export const getNotifications = (params = {}) =>
  api.get('/notifications', { params });

export const getUnreadCount = () =>
  api.get('/notifications/unread-count');

export const markNotificationAsRead = (notificationId) =>
  api.put(`/notifications/${notificationId}/read`);

export const markAllNotificationsAsRead = (type = null) =>
  api.put('/notifications/mark-all-read', { type });

export const deleteNotification = (notificationId) =>
  api.delete(`/notifications/${notificationId}`);

export const clearAllReadNotifications = () =>
  api.delete('/notifications/clear-all');

// ============================================
// ENHANCED MESSAGING APIs
// ============================================

export const addMessageReaction = (messageId, emoji) =>
  api.post(`/messages/${messageId}/react`, { emoji });

export const getMessageReactions = (messageId) =>
  api.get(`/messages/${messageId}/reactions`);

export const quoteMessage = (messageId, content, receiverId, conversationId = null) =>
  api.post(`/messages/${messageId}/quote`, { content, receiverId, conversationId });

export const createMessageMention = (messageId, mentionedUserIds) =>
  api.post(`/messages/${messageId}/mention`, { mentionedUserIds });

export const getMyMentions = (params = {}) =>
  api.get('/messages/mentions/my', { params });

export const markMentionAsRead = (mentionId) =>
  api.put(`/messages/mentions/${mentionId}/read`);

export const linkCalendarToMessage = (messageId, eventId, refType = 'mention') =>
  api.post(`/messages/${messageId}/calendar-ref`, { eventId, refType });

export const linkTaskToMessage = (messageId, taskId, refType = 'mention') =>
  api.post(`/messages/${messageId}/task-ref`, { taskId, refType });

export const getFullMessage = (messageId) =>
  api.get(`/messages/${messageId}/full`);

// ============================================
// TASK POOL APIs
// ============================================

export const getTodayTaskPool = (params = {}) =>
  api.get('/task-pool/today', { params });

export const getMyTasks = (date = null) =>
  api.get('/task-pool/my-tasks', { params: { date } });

export const claimTask = (taskPoolId) =>
  api.post(`/task-pool/${taskPoolId}/claim`);

export const requestTaskHelp = (taskPoolId, userId, message) =>
  api.post(`/task-pool/${taskPoolId}/request-help`, { userId, message });

export const respondToHelpRequest = (requestId, action, message = '') =>
  api.post(`/task-pool/help-requests/${requestId}/respond`, { action, message });

export const getMyHelpRequests = (status = null) =>
  api.get('/task-pool/help-requests/my', { params: { status } });

export const completeTask = (taskPoolId, notes = '') =>
  api.post(`/task-pool/${taskPoolId}/complete`, { notes });

export const createTaskPoolEntry = (taskData) =>
  api.post('/task-pool/create', taskData);

// ============================================
// KANBAN FILTERS APIs (assuming we extend tasks.pg.js)
// ============================================

export const getTasksByVisibility = (visibility = 'team', params = {}) =>
  api.get('/tasks', { params: { ...params, visibility } });

export const getPersonalTasks = (userId = null) =>
  api.get('/tasks', { params: { visibility: 'personal', userId } });

export const getTeamTasks = (params = {}) =>
  api.get('/tasks', { params: { ...params, visibility: 'team' } });

export const createKanbanView = (viewData) =>
  api.post('/tasks/views', viewData);

export const updateKanbanView = (viewId, viewData) =>
  api.put(`/tasks/views/${viewId}`, viewData);

export const getKanbanViews = () =>
  api.get('/tasks/views');

export const deleteKanbanView = (viewId) =>
  api.delete(`/tasks/views/${viewId}`);

export default api;
