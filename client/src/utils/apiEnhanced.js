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

export const deleteMessage = (messageId) =>
  api.delete(`/messages/${messageId}`);

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

export const getUnifiedTaskBoard = (params = {}) =>
  api.get('/tasks/board', { params });

export const createTaskPoolEntry = (taskData) =>
  api.post('/task-pool/create', taskData);

export const createTask = (taskData) =>
  api.post('/tasks', taskData);

// ============================================
// ENHANCED KANBAN APIs
// ============================================

export const getKanbanTasks = () =>
  api.get('/kanban/tasks');

export const getKanbanTask = (taskId) =>
  api.get(`/kanban/tasks/${taskId}`);

export const createKanbanTask = (taskData) =>
  api.post('/kanban/tasks', taskData);

export const updateKanbanTask = (taskId, taskData) =>
  api.put(`/kanban/tasks/${taskId}`, taskData);

export const deleteKanbanTask = (taskId) =>
  api.delete(`/kanban/tasks/${taskId}`);

export const uploadTaskAttachment = (taskId, formData) =>
  api.post(`/kanban/tasks/${taskId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const deleteTaskAttachment = (attachmentId) =>
  api.delete(`/kanban/attachments/${attachmentId}`);

export const addTaskComment = (taskId, data) =>
  api.post(`/kanban/tasks/${taskId}/comments`, data, {
    headers: data.audio ? { 'Content-Type': 'multipart/form-data' } : {}
  });

export const deleteTaskComment = (commentId) =>
  api.delete(`/kanban/comments/${commentId}`);

export const getTaskActivity = (taskId) =>
  api.get(`/kanban/tasks/${taskId}/activity`);

// ============================================
// KNOWLEDGE BASE APIs
// ============================================

export const getKBCategories = () =>
  api.get('/kb/categories');

export const createKBCategory = (categoryData) =>
  api.post('/kb/categories', categoryData);

export const getKBArticles = (params = {}) =>
  api.get('/kb/articles', { params });

export const getKBArticle = (articleId) =>
  api.get(`/kb/articles/${articleId}`);

export const createKBArticle = (articleData) =>
  api.post('/kb/articles', articleData);

export const updateKBArticle = (articleId, articleData) =>
  api.put(`/kb/articles/${articleId}`, articleData);

export const deleteKBArticle = (articleId) =>
  api.delete(`/kb/articles/${articleId}`);

export const uploadKBMedia = (articleId, formData) =>
  api.post(`/kb/articles/${articleId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const deleteKBMedia = (mediaId) =>
  api.delete(`/kb/media/${mediaId}`);

export const addKBComment = (articleId, commentData) =>
  api.post(`/kb/articles/${articleId}/comments`, commentData);

export const voteKBArticle = (articleId, isHelpful) =>
  api.post(`/kb/articles/${articleId}/vote`, { is_helpful: isHelpful });

export const searchKB = (query, params = {}) =>
  api.get('/kb/search', { params: { q: query, ...params } });

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

// ============================================
// MESSENGER THREAD APIs
// ============================================

export const getMessageThreads = () =>
  api.get('/messages/threads');

export const createConversationThread = (payload) =>
  api.post('/messages/conversations', payload);

export const getConversationThread = (conversationId) =>
  api.get(`/messages/conversations/${conversationId}`);

export const getConversationMessages = (conversationId) =>
  api.get(`/messages/conversations/${conversationId}/messages`);

export const sendConversationMessage = (conversationId, payload) =>
  api.post(`/messages/conversations/${conversationId}/messages`, payload);

export const addConversationMembers = (conversationId, memberIds) =>
  api.post(`/messages/conversations/${conversationId}/members`, { memberIds });

export const removeConversationMember = (conversationId, memberId) =>
  api.delete(`/messages/conversations/${conversationId}/members/${memberId}`);

export const markConversationAsRead = (conversationId) =>
  api.post(`/messages/conversations/${conversationId}/read`);

export const uploadAttachment = (formData) =>
  api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export default api;
