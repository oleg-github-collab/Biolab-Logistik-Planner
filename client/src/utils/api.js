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

// Response interceptor for error handling
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

// Messages endpoints
export const getMessages = () => 
  api.get('/messages');

export const getUnreadCount = () => 
  api.get('/messages/unread-count');

export const sendMessage = (receiverId, message, isGroup = false) => 
  api.post('/messages', { receiverId, message, isGroup });

export const getUsersForMessaging = () => 
  api.get('/messages/users');

// Waste endpoints
export const getWasteItems = () => 
  api.get('/waste/items');

export const createWasteItem = (name, description, disposalInstructions, nextDisposalDate) => 
  api.post('/waste/items', { name, description, disposalInstructions, nextDisposalDate });

export const updateWasteItem = (id, name, description, disposalInstructions, nextDisposalDate) => 
  api.put(`/waste/items/${id}`, { name, description, disposalInstructions, nextDisposalDate });

export const deleteWasteItem = (id) => 
  api.delete(`/waste/items/${id}`);

// Admin endpoints
export const getAllUsers = () => 
  api.get('/admin/users');

export const updateUser = (id, userData) => 
  api.put(`/admin/users/${id}`, userData);

export const deleteUser = (id) => 
  api.delete(`/admin/users/${id}`);

export default api;