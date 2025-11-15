import { format as dateFnsFormat, parseISO, isValid, addMinutes } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Safely parse a date value to a valid Date object
 * @param {Date|string|number} value - Date value to parse
 * @param {Date} fallback - Fallback date if parsing fails (default: new Date())
 * @returns {Date} Valid Date object
 */
export const safeParseDate = (value, fallback = null) => {
  // Already a Date object
  if (value instanceof Date) {
    return isValid(value) ? value : (fallback || new Date());
  }

  // String date
  if (typeof value === 'string') {
    try {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed : (fallback || new Date());
    } catch (error) {
      console.warn('Failed to parse date string:', value, error);
      return fallback || new Date();
    }
  }

  // Number (timestamp)
  if (typeof value === 'number') {
    const date = new Date(value);
    return isValid(date) ? date : (fallback || new Date());
  }

  // Null or undefined
  return fallback || new Date();
};

/**
 * Safely format a date with validation
 * @param {Date|string|number} date - Date to format
 * @param {string} formatString - Format string for date-fns
 * @param {Object} options - Options including fallback and locale
 * @returns {string} Formatted date string or fallback
 */
export const safeFormat = (date, formatString = 'PPP', options = {}) => {
  const { fallback = '—', locale = de } = options;

  try {
    const parsedDate = safeParseDate(date);

    if (!isValid(parsedDate)) {
      return fallback;
    }

    return dateFnsFormat(parsedDate, formatString, { locale });
  } catch (error) {
    console.warn('Failed to format date:', date, error);
    return fallback;
  }
};

/**
 * Safely get start and end dates for an event
 * @param {Object} event - Event object with start and end properties
 * @returns {Object} Object with validStart and validEnd Date objects
 */
export const safeEventDates = (event) => {
  if (!event) {
    const now = new Date();
    return { validStart: now, validEnd: addMinutes(now, 60) };
  }

  const start = safeParseDate(event.start || event.start_time);
  const end = safeParseDate(event.end || event.end_time, addMinutes(start, 60));

  return { validStart: start, validEnd: end };
};

/**
 * Format time range for display
 * @param {Date|string} start - Start date/time
 * @param {Date|string} end - End date/time
 * @param {boolean} allDay - Is all-day event
 * @returns {string} Formatted time range
 */
export const formatTimeRange = (start, end, allDay = false) => {
  if (allDay) {
    return 'Ganztägig';
  }

  const { validStart, validEnd } = safeEventDates({ start, end });

  const startTime = safeFormat(validStart, 'HH:mm', { fallback: '00:00' });
  const endTime = safeFormat(validEnd, 'HH:mm', { fallback: '00:00' });

  return `${startTime} – ${endTime}`;
};

/**
 * Check if a date value is valid
 * @param {any} date - Date to check
 * @returns {boolean} True if valid date
 */
export const isValidDate = (date) => {
  const parsed = safeParseDate(date, null);
  return parsed !== null && isValid(parsed);
};

/**
 * Get display date for event
 * @param {Object} event - Event object
 * @returns {string} Formatted date
 */
export const getEventDisplayDate = (event) => {
  if (!event) return '—';

  const { validStart } = safeEventDates(event);
  return safeFormat(validStart, 'PPP', { fallback: '—' });
};

/**
 * Get display time for event
 * @param {Object} event - Event object
 * @returns {string} Formatted time range
 */
export const getEventDisplayTime = (event) => {
  if (!event) return '—';

  const { validStart, validEnd } = safeEventDates(event);
  return formatTimeRange(validStart, validEnd, event.all_day);
};
