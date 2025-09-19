import axios from 'axios';

const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }

  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
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
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (name, email, password, role = 'employee') => 
  api.post('/auth/register', { name, email, password, role });

export const getUser = () => 
  api.get('/auth/user');

export const checkFirstSetup = () => 
  api.get('/auth/first-setup');

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

export const getEvents = (start, end, type, priority) => {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
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

export const getTasks = (status) =>
  api.get(`/tasks${status ? `?status=${status}` : ''}`);

export const createTask = (taskData) => 
  api.post('/tasks', taskData);

export const updateTask = (id, taskData) => 
  api.put(`/tasks/${id}`, taskData);

export const deleteTask = (id) => 
  api.delete(`/tasks/${id}`);

export const getMessages = (params = {}) =>
  api.get('/messages', { params });

export const getUnreadCount = () =>
  api.get('/messages/unread-count');

export const sendMessage = (receiverId, message, isGroup = false) =>
  api.post('/messages', { receiverId, message, isGroup });

export const getUsersForMessaging = () => 
  api.get('/messages/users');

export const getWasteItems = () =>
  api.get('/waste/items');

export const createWasteItem = (name, description, disposalInstructions, nextDisposalDate) => 
  api.post('/waste/items', { name, description, disposalInstructions, nextDisposalDate });

export const updateWasteItem = (id, name, description, disposalInstructions, nextDisposalDate) => 
  api.put(`/waste/items/${id}`, { name, description, disposalInstructions, nextDisposalDate });

export const deleteWasteItem = (id) => 
  api.delete(`/waste/items/${id}`);

export const getWasteTemplates = () =>
  api.get('/waste/templates');

export const createWasteTemplate = (templateData) => 
  api.post('/waste/templates', templateData);

export const updateWasteTemplate = (id, templateData) => 
  api.put(`/waste/templates/${id}`, templateData);

export const deleteWasteTemplate = (id) => 
  api.delete(`/waste/templates/${id}`);

export const getAllUsers = () =>
  api.get('/admin/users');

export const updateUser = (id, userData) => 
  api.put(`/admin/users/${id}`, userData);

export const deleteUser = (id) => 
  api.delete(`/admin/users/${id}`);

export default api;