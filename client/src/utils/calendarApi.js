/**
 * Calendar API Wrapper
 *
 * This module provides wrapper functions around the base API calls that ensure
 * events are automatically refetched after any mutation (create, update, delete).
 * This guarantees the UI always displays the most current data from the server.
 */

import {
  getEvents as getEventsBase,
  createEvent as createEventBase,
  updateEvent as updateEventBase,
  deleteEvent as deleteEventBase,
  duplicateEvent as duplicateEventBase,
  createBulkEvents as createBulkEventsBase,
} from './api';

/**
 * Fetch events with date range and filters
 * @param {String} start - Start date (ISO format)
 * @param {String} end - End date (ISO format)
 * @param {String} type - Event type filter (optional)
 * @param {String} priority - Priority filter (optional)
 * @returns {Promise<Array>} Array of events
 */
export const fetchEvents = async (start, end, type, priority) => {
  try {
    const response = await getEventsBase(start, end, type, priority);

    // Handle different response structures
    if (response?.status === 304) {
      return { data: [], noChange: true };
    }

    const payload = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.data)
      ? response.data.data
      : [];

    return { data: payload, noChange: false };
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

/**
 * Create a new event and refetch all events
 * @param {Object} eventData - Event data to create
 * @param {Function} refetchCallback - Callback to refetch events after creation
 * @returns {Promise<Object>} Created event data
 */
export const createEventWithRefetch = async (eventData, refetchCallback) => {
  try {
    const response = await createEventBase(eventData);

    // Immediately refetch events to get the latest state from server
    if (refetchCallback && typeof refetchCallback === 'function') {
      await refetchCallback();
    }

    return response.data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

/**
 * Update an existing event and refetch all events
 * @param {Number|String} eventId - ID of event to update
 * @param {Object} eventData - Updated event data
 * @param {Function} refetchCallback - Callback to refetch events after update
 * @returns {Promise<Object>} Updated event data
 */
export const updateEventWithRefetch = async (eventId, eventData, refetchCallback) => {
  try {
    const response = await updateEventBase(eventId, eventData);

    // Immediately refetch events to get the latest state from server
    if (refetchCallback && typeof refetchCallback === 'function') {
      await refetchCallback();
    }

    return response.data;
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

/**
 * Delete an event and refetch all events
 * @param {Number|String} eventId - ID of event to delete
 * @param {Function} refetchCallback - Callback to refetch events after deletion
 * @returns {Promise<void>}
 */
export const deleteEventWithRefetch = async (eventId, refetchCallback) => {
  try {
    await deleteEventBase(eventId);

    // Immediately refetch events to get the latest state from server
    if (refetchCallback && typeof refetchCallback === 'function') {
      await refetchCallback();
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

/**
 * Duplicate an event and refetch all events
 * @param {Number|String} eventId - ID of event to duplicate
 * @param {String} newDate - New date for duplicated event
 * @param {Function} refetchCallback - Callback to refetch events after duplication
 * @returns {Promise<Object>} Duplicated event data
 */
export const duplicateEventWithRefetch = async (eventId, newDate, refetchCallback) => {
  try {
    const response = await duplicateEventBase(eventId, newDate);

    // Immediately refetch events to get the latest state from server
    if (refetchCallback && typeof refetchCallback === 'function') {
      await refetchCallback();
    }

    return response.data;
  } catch (error) {
    console.error('Error duplicating event:', error);
    throw error;
  }
};

/**
 * Create multiple events at once and refetch all events
 * @param {Array} events - Array of event objects to create
 * @param {Function} refetchCallback - Callback to refetch events after creation
 * @returns {Promise<Object>} Response data with created events
 */
export const createBulkEventsWithRefetch = async (events, refetchCallback) => {
  try {
    const response = await createBulkEventsBase(events);

    // Immediately refetch events to get the latest state from server
    if (refetchCallback && typeof refetchCallback === 'function') {
      await refetchCallback();
    }

    return response.data;
  } catch (error) {
    console.error('Error creating bulk events:', error);
    throw error;
  }
};

/**
 * Hook-style wrapper for calendar operations with automatic refetch
 * This can be used in components to get all CRUD operations with built-in refetch
 *
 * @param {Function} refetchCallback - Function to call after any mutation
 * @returns {Object} Object with all calendar operations
 */
export const useCalendarOperations = (refetchCallback) => {
  return {
    // Fetch operations
    fetchEvents: (start, end, type, priority) =>
      fetchEvents(start, end, type, priority),

    // Create operations
    createEvent: (eventData) =>
      createEventWithRefetch(eventData, refetchCallback),

    createBulkEvents: (events) =>
      createBulkEventsWithRefetch(events, refetchCallback),

    // Update operations
    updateEvent: (eventId, eventData) =>
      updateEventWithRefetch(eventId, eventData, refetchCallback),

    // Delete operations
    deleteEvent: (eventId) =>
      deleteEventWithRefetch(eventId, refetchCallback),

    // Duplicate operations
    duplicateEvent: (eventId, newDate) =>
      duplicateEventWithRefetch(eventId, newDate, refetchCallback),
  };
};

/**
 * WebSocket event handler for real-time calendar updates
 * Call this function to setup listeners for calendar events via WebSocket
 *
 * @param {Object} socket - WebSocket instance
 * @param {Function} refetchCallback - Function to call when events change
 * @returns {Function} Cleanup function to remove listeners
 */
export const setupCalendarWebSocketListeners = (socket, refetchCallback) => {
  if (!socket || !socket.on) {
    console.warn('Invalid socket provided to setupCalendarWebSocketListeners');
    return () => {};
  }

  // Event created by another user
  const handleEventCreated = (data) => {
    console.log('Calendar: Event created via WebSocket', data);
    if (refetchCallback && typeof refetchCallback === 'function') {
      refetchCallback();
    }
  };

  // Event updated by another user
  const handleEventUpdated = (data) => {
    console.log('Calendar: Event updated via WebSocket', data);
    if (refetchCallback && typeof refetchCallback === 'function') {
      refetchCallback();
    }
  };

  // Event deleted by another user
  const handleEventDeleted = (data) => {
    console.log('Calendar: Event deleted via WebSocket', data);
    if (refetchCallback && typeof refetchCallback === 'function') {
      refetchCallback();
    }
  };

  // Register event listeners
  socket.on('calendar:event_created', handleEventCreated);
  socket.on('calendar:event_updated', handleEventUpdated);
  socket.on('calendar:event_deleted', handleEventDeleted);

  // Return cleanup function
  return () => {
    socket.off('calendar:event_created', handleEventCreated);
    socket.off('calendar:event_updated', handleEventUpdated);
    socket.off('calendar:event_deleted', handleEventDeleted);
  };
};

/**
 * Helper function to parse event dates consistently
 * @param {String|Date} value - Date value to parse
 * @returns {Date|null} Parsed date or null
 */
export const parseEventDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const isoLike = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(isoLike);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

/**
 * Helper function to safely parse JSON arrays
 * @param {String|Array} value - Value to parse
 * @param {Array} fallback - Fallback value
 * @returns {Array} Parsed array or fallback
 */
export const safeParseJsonArray = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      const split = value
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (split.length > 0) {
        return split;
      }
    }
    return fallback;
  }
  return fallback;
};

/**
 * Transform API event to UI event format
 * @param {Object} apiEvent - Event from API
 * @returns {Object} Transformed event for UI
 */
export const transformApiEventToUi = (apiEvent) => {
  const start = parseEventDate(apiEvent.start_time) ?? new Date();
  const end = parseEventDate(apiEvent.end_time) ?? new Date(start.getTime() + 60 * 60 * 1000);
  const allDay = Boolean(apiEvent.all_day);
  const type = apiEvent.event_type || apiEvent.type || 'Termin';

  const attachments = Array.isArray(apiEvent.attachments)
    ? apiEvent.attachments
    : safeParseJsonArray(apiEvent.attachments);

  const attendees = Array.isArray(apiEvent.attendees)
    ? apiEvent.attendees
    : safeParseJsonArray(apiEvent.attendees);

  const tags = Array.isArray(apiEvent.tags)
    ? apiEvent.tags
    : safeParseJsonArray(apiEvent.tags);

  const recurring = Boolean(apiEvent.is_recurring);

  return {
    id: apiEvent.id,
    title: apiEvent.title,
    description: apiEvent.description || '',
    start,
    end,
    all_day: allDay,
    type,
    priority: apiEvent.priority || 'medium',
    location: apiEvent.location || '',
    attendees,
    reminder: apiEvent.reminder ?? 15,
    status: apiEvent.status || 'confirmed',
    color: apiEvent.color || getEventColor(type),
    notes: apiEvent.notes || '',
    category: apiEvent.category || 'work',
    recurring,
    recurring_pattern: recurring ? (apiEvent.recurrence_pattern || 'weekly') : null,
    recurring_end: recurring && apiEvent.recurrence_end_date
      ? parseEventDate(apiEvent.recurrence_end_date)
      : null,
    tags,
    attachments,
    cover_image: apiEvent.cover_image || null,
    audio_url: apiEvent.audio_url || null,
    raw: apiEvent
  };
};

/**
 * Transform UI event to API payload format
 * @param {Object} uiEvent - Event from UI
 * @returns {Object} Transformed event for API
 */
export const transformUiEventToApi = (uiEvent) => {
  const recurring = Boolean(uiEvent.recurring);
  const eventType = uiEvent.type || uiEvent.event_type || 'Termin';

  return {
    title: uiEvent.title,
    description: uiEvent.description || '',
    startDate: uiEvent.start instanceof Date ? uiEvent.start.toISOString() : uiEvent.start,
    endDate: uiEvent.end instanceof Date ? uiEvent.end.toISOString() : uiEvent.end,
    startTime: uiEvent.all_day ? null : uiEvent.start_time,
    endTime: uiEvent.all_day ? null : uiEvent.end_time,
    event_type: eventType,
    type: eventType,
    all_day: Boolean(uiEvent.all_day),
    isAllDay: Boolean(uiEvent.all_day),
    is_recurring: recurring,
    isRecurring: recurring,
    recurrence_pattern: recurring ? (uiEvent.recurring_pattern || null) : null,
    recurrencePattern: recurring ? (uiEvent.recurring_pattern || null) : null,
    recurrence_end_date: recurring && uiEvent.recurring_end
      ? (uiEvent.recurring_end instanceof Date
        ? uiEvent.recurring_end.toISOString()
        : new Date(uiEvent.recurring_end).toISOString())
      : null,
    recurrenceEndDate: recurring && uiEvent.recurring_end
      ? (uiEvent.recurring_end instanceof Date
        ? uiEvent.recurring_end.toISOString()
        : new Date(uiEvent.recurring_end).toISOString())
      : null,
    priority: uiEvent.priority || 'medium',
    status: uiEvent.status || 'confirmed',
    category: uiEvent.category || 'work',
    location: uiEvent.location || '',
    attendees: Array.isArray(uiEvent.attendees) ? uiEvent.attendees : [],
    reminder: uiEvent.reminder ?? 15,
    notes: uiEvent.notes || '',
    color: uiEvent.color || null,
    tags: Array.isArray(uiEvent.tags) ? uiEvent.tags : [],
    attachments: Array.isArray(uiEvent.attachments) ? uiEvent.attachments : [],
    cover_image: uiEvent.cover_image || null,
    audio_url: uiEvent.audio_url || null,
  };
};

/**
 * Get color for event type
 * @param {String} type - Event type
 * @returns {String} Color hex code
 */
export const getEventColor = (type = 'Arbeit') => {
  const EVENT_COLOR_MAP = {
    Arbeit: '#0EA5E9',
    Meeting: '#6366F1',
    Urlaub: '#F97316',
    Krankheit: '#EF4444',
    Training: '#10B981',
    Projekt: '#8B5CF6',
    Termin: '#06B6D4',
    Deadline: '#DC2626',
    Personal: '#84CC16',
    inspection: '#FB923C',
    disposal: '#22C55E',
    default: '#475569'
  };

  return EVENT_COLOR_MAP[type] || EVENT_COLOR_MAP.default;
};

export default {
  fetchEvents,
  createEventWithRefetch,
  updateEventWithRefetch,
  deleteEventWithRefetch,
  duplicateEventWithRefetch,
  createBulkEventsWithRefetch,
  useCalendarOperations,
  setupCalendarWebSocketListeners,
  parseEventDate,
  safeParseJsonArray,
  transformApiEventToUi,
  transformUiEventToApi,
  getEventColor,
};
