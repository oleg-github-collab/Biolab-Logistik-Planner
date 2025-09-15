import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

// Auth endpoints
export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const getUser = () => 
  api.get('/auth/user');

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

export default api;