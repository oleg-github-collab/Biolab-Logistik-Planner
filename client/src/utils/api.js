import axios from 'axios';

// Dynamically set API base URL based on environment
const getApiBaseUrl = () => {
  // If we're in development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }
  
  // If we're in production, use the current domain
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Network retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay
const SILENT_FAIL_ENDPOINTS = ['/messages/unread-count', '/notifications/unread-count'];

// Exponential backoff retry logic
const retryRequest = async (config, retryCount = 0) => {
  try {
    return await api.request(config);
  } catch (error) {
    const isNetworkError = !error.response && (
      error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message?.includes('ERR_NETWORK_CHANGED') ||
      error.message?.includes('Network Error')
    );

    if (isNetworkError && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(config, retryCount + 1);
    }

    throw error;
  }
};

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isSilentEndpoint = SILENT_FAIL_ENDPOINTS.some(endpoint =>
      error.config?.url?.includes(endpoint)
    );

    // For network errors on silent endpoints, just fail silently
    if (isSilentEndpoint && !error.response) {
      return Promise.reject(error);
    }

    // Log only non-network errors or important endpoints
    if (error.response || !isSilentEndpoint) {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }

    // Retry on network errors
    const isNetworkError = !error.response && (
      error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message?.includes('ERR_NETWORK_CHANGED') ||
      error.message?.includes('Network Error')
    );

    if (isNetworkError && !error.config.__retryCount) {
      error.config.__retryCount = 0;
    }

    if (isNetworkError && error.config.__retryCount < MAX_RETRIES) {
      error.config.__retryCount += 1;
      const delay = RETRY_DELAY * Math.pow(2, error.config.__retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api.request(error.config);
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const register = (name, email, password, role = 'employee') => 
  api.post('/auth/register', { name, email, password, role });

export const getUser = () => 
  api.get('/auth/user');

export const checkFirstSetup = () => 
  api.get('/auth/first-setup');

// Schedule endpoints
export const getCurrentWeek = () => 
  api.get('/schedule/current-week');

export const getMySchedule = () => 
  api.get('/schedule/my-schedule');

export const updateDaySchedule = (dayOfWeek, startTime, endTime, status) => 
  api.put('/schedule/update-day', { dayOfWeek, startTime, endTime, status });

export const getTeamSchedule = () => 
  api.get('/schedule/team-schedule');

export const getArchivedSchedules = () => 
  api.get('/schedule/archived');

// Event endpoints
export const getEvents = (start, end, type, priority) => {
  const params = new URLSearchParams();
  if (start) params.append('startDate', start);
  if (end) params.append('endDate', end);
  if (type) params.append('type', type);
  if (priority) params.append('priority', priority);

  return api.get(`/schedule/events${params.toString() ? `?${params.toString()}` : ''}`);
};

export const createEvent = (eventData) =>
  api.post('/schedule/events', eventData);

export const updateEvent = (id, eventData) =>
  api.put(`/schedule/events/${id}`, eventData);

export const deleteEvent = (id) =>
  api.delete(`/schedule/events/${id}`);

export const getEventStatistics = (timeframe = 'month') =>
  api.get(`/schedule/events/statistics?timeframe=${timeframe}`);

export const createBulkEvents = (events) =>
  api.post('/schedule/events/bulk', { events });

export const duplicateEvent = (id, newDate) =>
  api.post(`/schedule/events/${id}/duplicate`, { newDate });

// Absence endpoints
export const createAbsenceEvent = (absenceData) =>
  api.post('/schedule/absence', absenceData);

// Task endpoints
export const getTasks = (status) => 
  api.get(`/tasks${status ? `?status=${status}` : ''}`);

export const createTask = (taskData) => 
  api.post('/tasks', taskData);

export const updateTask = (id, taskData) => 
  api.put(`/tasks/${id}`, taskData);

export const deleteTask = (id) => 
  api.delete(`/tasks/${id}`);

// Messages endpoints
export const getMessages = () =>
  api.get('/messages');

export const getMessagesForUser = (userId) =>
  api.get(`/messages/conversation/${userId}`);

export const getThreads = () =>
  api.get('/messages/threads');

export const getConversations = () =>
  api.get('/messages/conversations');

export const getUnreadCount = () =>
  api.get('/messages/unread-count');

export const sendMessage = (receiverId, message, isGroup = false) =>
  api.post('/messages', {
    recipientId: receiverId,
    content: message,
    isGroup
  });

export const getUsersForMessaging = () =>
  api.get('/messages/contacts');

// Waste endpoints
export const getWasteCategories = () =>
  api.get('/waste-categories');

export const getWasteItems = () =>
  api.get('/waste/items');

export const createWasteItem = (name, description, disposalInstructions, nextDisposalDate) =>
  api.post('/waste/items', { name, description, disposalInstructions, nextDisposalDate });

export const updateWasteItem = (id, name, description, disposalInstructions, nextDisposalDate) => 
  api.put(`/waste/items/${id}`, { name, description, disposalInstructions, nextDisposalDate });

export const deleteWasteItem = (id) => 
  api.delete(`/waste/items/${id}`);

// Waste template endpoints
export const getWasteTemplates = () => 
  api.get('/waste/templates');

export const createWasteTemplate = (templateData) => 
  api.post('/waste/templates', templateData);

export const updateWasteTemplate = (id, templateData) => 
  api.put(`/waste/templates/${id}`, templateData);

export const deleteWasteTemplate = (id) => 
  api.delete(`/waste/templates/${id}`);

// Admin endpoints
export const getAllUsers = () => 
  api.get('/admin/users');

export const updateUser = (id, userData) => 
  api.put(`/admin/users/${id}`, userData);

export const deleteUser = (id) => 
  api.delete(`/admin/users/${id}`);

export default api;
