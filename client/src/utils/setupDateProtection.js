/**
 * Global Date Format Protection
 * Monkey-patches date-fns format() to prevent "Invalid time value" crashes
 * Import this ONCE at app startup in index.js
 */

import * as dateFns from 'date-fns';

const originalFormat = dateFns.format;

// Safe wrapper for date-fns format
const safeFormat = (date, formatStr, options = {}) => {
  try {
    // Check if date is valid
    if (!date) {
      console.warn('[DateProtection] Null/undefined date passed to format()');
      return '—';
    }

    // Validate Date object
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        console.warn('[DateProtection] Invalid Date object:', date);
        return '—';
      }
      return originalFormat(date, formatStr, options);
    }

    // Try to parse string/number
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      console.warn('[DateProtection] Cannot parse date:', date);
      return '—';
    }

    return originalFormat(parsed, formatStr, options);
  } catch (error) {
    console.error('[DateProtection] Error in format():', error, { date, formatStr });
    return '—';
  }
};

// Apply monkey patch
export const setupDateProtection = () => {
  // Override format in date-fns module
  dateFns.format = safeFormat;

  console.log('[DateProtection] Global date format protection enabled ✓');
};

// Also export safe format for direct use
export { safeFormat };
