/**
 * Calendar API Wrapper
 *
 * This module provides wrapper functions around the base API calls that ensure
 * events are automatically refetched after any mutation (create, update, delete).
 * This guarantees the UI always displays the most current data from the server.
 */

import {
  format,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  endOfDay,
  startOfDay,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears
} from 'date-fns';
import {
  getEvents as getEventsBase,
  createEvent as createEventBase,
  updateEvent as updateEventBase,
  deleteEvent as deleteEventBase,
  duplicateEvent as duplicateEventBase,
  createBulkEvents as createBulkEventsBase,
} from './api';

const toDateInstance = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateOnly = (value) => {
  const date = toDateInstance(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
};

const formatTimeOnly = (value) => {
  const date = toDateInstance(value);
  return date ? format(date, 'HH:mm') : '';
};

const buildDateTimeFromFields = (dateField, timeField, fallback = null, allDay = false) => {
  const sourceDate = allDay ? formatDateOnly(dateField) : dateField;
  if (!sourceDate && fallback) {
    return toDateInstance(fallback);
  }

  if (!sourceDate) return null;

  const normalizedTime = timeField && timeField.length === 5 ? timeField : `${String(timeField || '00:00').padStart(5, '0')}`;
  const isoString = `${sourceDate}T${normalizedTime}:00`;
  return toDateInstance(isoString);
};

const normalizeRecurrenceRule = (event) => {
  const rawPattern = event?.recurring_pattern || event?.recurrence_pattern || 'weekly';
  const rawInterval =
    event?.recurring_interval ??
    event?.recurrence_interval ??
    event?.recurrenceInterval ??
    1;
  const interval = Math.max(1, Number.parseInt(rawInterval, 10) || 1);

  if (rawPattern === 'biweekly') {
    return { pattern: 'weekly', interval: Math.max(2, interval) };
  }

  return { pattern: rawPattern, interval };
};

const addByPattern = (date, pattern, interval) => {
  switch (pattern) {
    case 'daily':
      return addDays(date, interval);
    case 'weekly':
      return addWeeks(date, interval);
    case 'monthly':
      return addMonths(date, interval);
    case 'yearly':
      return addYears(date, interval);
    default:
      return addWeeks(date, interval);
  }
};

const jumpToWindowStart = (baseStart, pattern, interval, windowStart) => {
  if (baseStart >= windowStart) {
    return baseStart;
  }

  switch (pattern) {
    case 'daily': {
      const diffDays = differenceInCalendarDays(windowStart, baseStart);
      const steps = Math.floor(diffDays / interval);
      return addDays(baseStart, steps * interval);
    }
    case 'weekly': {
      const diffDays = differenceInCalendarDays(windowStart, baseStart);
      const diffWeeks = Math.floor(diffDays / 7);
      const steps = Math.floor(diffWeeks / interval);
      return addWeeks(baseStart, steps * interval);
    }
    case 'monthly': {
      const diffMonths = differenceInCalendarMonths(windowStart, baseStart);
      const steps = Math.floor(diffMonths / interval);
      return addMonths(baseStart, steps * interval);
    }
    case 'yearly': {
      const diffYears = differenceInCalendarYears(windowStart, baseStart);
      const steps = Math.floor(diffYears / interval);
      return addYears(baseStart, steps * interval);
    }
    default:
      return baseStart;
  }
};

export const expandRecurringEvents = (events, rangeStart, rangeEnd) => {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  if (!rangeStart || !rangeEnd) {
    return events;
  }

  const windowStart = startOfDay(new Date(rangeStart));
  const windowEnd = endOfDay(new Date(rangeEnd));
  const expanded = [];

  events.forEach((event) => {
    if (!event?.recurring) {
      expanded.push(event);
      return;
    }

    const baseStart = event.start instanceof Date ? event.start : new Date(event.start);
    if (Number.isNaN(baseStart?.getTime?.())) {
      expanded.push(event);
      return;
    }

    const baseEnd = event.end instanceof Date ? event.end : new Date(event.end || baseStart);
    const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
    const { pattern, interval } = normalizeRecurrenceRule(event);
    const recurrenceEnd = event.recurring_end ? new Date(event.recurring_end) : null;
    const recurrenceLimit = recurrenceEnd && !Number.isNaN(recurrenceEnd.getTime())
      ? recurrenceEnd
      : null;
    const effectiveEnd = recurrenceLimit && recurrenceLimit < windowEnd ? recurrenceLimit : windowEnd;

    let occurrenceStart = jumpToWindowStart(baseStart, pattern, interval, windowStart);
    let safety = 0;
    while (occurrenceStart < windowStart && safety < 1000) {
      occurrenceStart = addByPattern(occurrenceStart, pattern, interval);
      safety += 1;
    }

    while (occurrenceStart <= effectiveEnd && safety < 2000) {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const occurrenceId = `${event.id}-occ-${format(occurrenceStart, 'yyyyMMdd')}`;
      expanded.push({
        ...event,
        id: occurrenceId,
        start: occurrenceStart,
        end: occurrenceEnd,
        start_date: format(occurrenceStart, 'yyyy-MM-dd'),
        end_date: format(occurrenceEnd, 'yyyy-MM-dd'),
        start_time: event.all_day ? '' : format(occurrenceStart, 'HH:mm'),
        end_time: event.all_day ? '' : format(occurrenceEnd, 'HH:mm'),
        is_occurrence: true,
        recurrence_parent_id: event.id,
        series_start: baseStart,
        series_end: baseEnd,
        read_only: event.read_only || false
      });
      occurrenceStart = addByPattern(occurrenceStart, pattern, interval);
      safety += 1;
    }
  });

  return expanded;
};

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
    // Transform field names to match server expectations
    const transformedData = {
      title: eventData.title,
      description: eventData.description,
      startDate: eventData.start_date || eventData.startDate,
      endDate: eventData.end_date || eventData.endDate,
      startTime: eventData.start_time || eventData.startTime,
      endTime: eventData.end_time || eventData.endTime,
      all_day: eventData.all_day,
      type: eventData.type || eventData.event_type,
      priority: eventData.priority,
      location: eventData.location,
      attendees: eventData.attendees,
      reminder: eventData.reminder,
      notes: eventData.notes,
      is_recurring: eventData.recurring || eventData.is_recurring,
      recurrence_pattern: eventData.recurring_pattern || eventData.recurrence_pattern,
      recurrence_end_date: eventData.recurring_end || eventData.recurrence_end_date,
      recurrence_interval: eventData.recurring_interval || eventData.recurrence_interval || eventData.recurrenceInterval,
      audio_url: eventData.audio_url,
      attachments: eventData.attachments,
      color: eventData.color,
      status: eventData.status,
      category: eventData.category,
    };

    const response = await createEventBase(transformedData);

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
  const startDateString = formatDateOnly(start);
  const endDateString = formatDateOnly(end);
  const startTimeString = allDay ? '' : formatTimeOnly(start);
  const endTimeString = allDay ? '' : formatTimeOnly(end);

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
  const rawInterval =
    apiEvent.recurrence_interval ??
    apiEvent.recurrenceInterval ??
    apiEvent.recurring_interval ??
    1;
  const normalizedInterval = Math.max(1, Number.parseInt(rawInterval, 10) || 1);
  const normalizedPattern = apiEvent.recurrence_pattern === 'biweekly'
    ? 'weekly'
    : (apiEvent.recurrence_pattern || 'weekly');

  const isWorkHours = apiEvent.source === 'work_hours' || apiEvent.is_work_hours || Boolean(apiEvent.work_hours);

  return {
    id: apiEvent.id,
    title: apiEvent.title,
    description: apiEvent.description || '',
    start,
    end,
    all_day: allDay,
    start_date: startDateString,
    end_date: endDateString,
    start_time: startTimeString,
    end_time: endTimeString,
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
    recurring_pattern: recurring ? normalizedPattern : null,
    recurring_interval: recurring ? (apiEvent.recurrence_pattern === 'biweekly'
      ? Math.max(2, normalizedInterval)
      : normalizedInterval) : 1,
    recurring_end: recurring && apiEvent.recurrence_end_date
      ? parseEventDate(apiEvent.recurrence_end_date)
      : null,
    tags,
    attachments,
    cover_image: apiEvent.cover_image || null,
    audio_url: apiEvent.audio_url || null,
    created_by: apiEvent.created_by ?? apiEvent.createdBy ?? null,
    created_by_name: apiEvent.created_by_name || apiEvent.createdByName || null,
    isWorkHours,
    read_only: isWorkHours || Boolean(apiEvent.read_only),
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
  let interval = Math.max(
    1,
    Number.parseInt(
      uiEvent.recurring_interval ??
        uiEvent.recurrence_interval ??
        uiEvent.recurrenceInterval ??
        1,
      10
    ) || 1
  );
  const normalizedPattern = uiEvent.recurring_pattern === 'biweekly'
    ? 'weekly'
    : (uiEvent.recurring_pattern || null);

  if (uiEvent.recurring_pattern === 'biweekly') {
    interval = Math.max(2, interval);
  }
  const eventType = uiEvent.type || uiEvent.event_type || 'Termin';
  const allDay = Boolean(uiEvent.all_day);
  const startTimestamp = buildDateTimeFromFields(
    uiEvent.start_date || uiEvent.start,
    uiEvent.start_time || formatTimeOnly(uiEvent.start),
    uiEvent.start || null,
    allDay
  );
  const endTimestamp = buildDateTimeFromFields(
    uiEvent.end_date || uiEvent.end,
    uiEvent.end_time || formatTimeOnly(uiEvent.end) || (allDay ? '23:59' : null),
    uiEvent.end || startTimestamp,
    allDay
  ) || startTimestamp;
  const normalizedStartDate = startTimestamp ? format(startTimestamp, 'yyyy-MM-dd') : (uiEvent.start_date || '');
  const normalizedEndDate = endTimestamp ? format(endTimestamp, 'yyyy-MM-dd') : (uiEvent.end_date || normalizedStartDate);
  const normalizedStartTime = allDay ? '' : formatTimeOnly(startTimestamp || uiEvent.start_time);
  const normalizedEndTime = allDay ? '' : formatTimeOnly(endTimestamp || uiEvent.end_time);

  return {
    start: startTimestamp,
    end: endTimestamp,
    title: uiEvent.title,
    description: uiEvent.description || '',
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    event_type: eventType,
    type: eventType,
    all_day: allDay,
    isAllDay: allDay,
    is_recurring: recurring,
    isRecurring: recurring,
    recurrence_pattern: recurring ? normalizedPattern : null,
    recurrencePattern: recurring ? normalizedPattern : null,
    recurrence_interval: recurring ? interval : null,
    recurrenceInterval: recurring ? interval : null,
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
  expandRecurringEvents,
  transformApiEventToUi,
  transformUiEventToApi,
  getEventColor,
};
