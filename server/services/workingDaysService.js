/**
 * Working Days Service
 * Ultra-reliable service for calculating working days, excluding weekends and public holidays
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get Monday of the week for any given date
 * @param {Date|string} date - Any date
 * @returns {Date} Monday of that week (00:00:00 local time)
 */
function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Reset to start of day

  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate difference: Monday is day 1
  // If Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Get Sunday of the week for any given date
 * @param {Date|string} date - Any date
 * @returns {Date} Sunday of that week (23:59:59 local time)
 */
function getSunday(date) {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date|string} date
 * @returns {boolean}
 */
function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Get all public holidays for a date range
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Set<string>>} Set of date strings (YYYY-MM-DD)
 */
async function getPublicHolidays(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const result = await pool.query(
      `SELECT date FROM public_holidays
       WHERE date >= $1 AND date <= $2`,
      [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    );

    return new Set(result.rows.map(row => row.date.toISOString().split('T')[0]));
  } catch (error) {
    logger.error('Error fetching public holidays', error);
    return new Set(); // Return empty set on error
  }
}

/**
 * Check if a date is a public holiday
 * @param {Date|string} date
 * @param {Set<string>} [holidaysSet] - Optional pre-fetched holidays set
 * @returns {Promise<boolean>}
 */
async function isPublicHoliday(date, holidaysSet = null) {
  const dateStr = new Date(date).toISOString().split('T')[0];

  if (holidaysSet) {
    return holidaysSet.has(dateStr);
  }

  try {
    const result = await pool.query(
      'SELECT 1 FROM public_holidays WHERE date = $1 LIMIT 1',
      [dateStr]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking public holiday', error);
    return false;
  }
}

/**
 * Check if a date is a working day (not weekend, not public holiday)
 * @param {Date|string} date
 * @param {Set<string>} [holidaysSet] - Optional pre-fetched holidays set
 * @returns {Promise<boolean>}
 */
async function isWorkingDay(date, holidaysSet = null) {
  if (isWeekend(date)) {
    return false;
  }

  const isHoliday = await isPublicHoliday(date, holidaysSet);
  return !isHoliday;
}

/**
 * Get all working days in a week (Monday to Friday, excluding public holidays)
 * @param {Date|string} weekStart - Monday of the week
 * @returns {Promise<Date[]>} Array of working day dates
 */
async function getWorkingDaysInWeek(weekStart) {
  const monday = getMonday(weekStart);
  const sunday = getSunday(weekStart);

  // Get public holidays for this week
  const holidays = await getPublicHolidays(monday, sunday);

  const workingDays = [];

  // Iterate Monday to Friday only
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);

    const dateStr = day.toISOString().split('T')[0];
    if (!holidays.has(dateStr)) {
      workingDays.push(day);
    }
  }

  return workingDays;
}

/**
 * Count working days in a date range
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<number>}
 */
async function countWorkingDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return 0;
  }

  // Get all public holidays in this range
  const holidays = await getPublicHolidays(start, end);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];

    // Check if it's a working day (Mon-Fri and not a holiday)
    if (!isWeekend(current) && !holidays.has(dateStr)) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get week boundaries (Monday 00:00 to Sunday 23:59)
 * @param {Date|string} date - Any date in the week
 * @returns {Object} { weekStart: Date, weekEnd: Date }
 */
function getWeekBoundaries(date) {
  const weekStart = getMonday(date);
  const weekEnd = getSunday(date);

  return { weekStart, weekEnd };
}

/**
 * Format date for database (YYYY-MM-DD)
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateForDB(date) {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Get ISO week number (Monday-based week numbering)
 * @param {Date|string} date
 * @returns {number}
 */
function getISOWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Calculate expected working hours for a week based on user quota
 * Distributes hours only across working days (excludes weekends and holidays)
 * @param {number} weeklyQuota - User's weekly hours quota
 * @param {Date|string} weekStart - Monday of the week
 * @returns {Promise<number>} Expected hours for this specific week
 */
async function calculateExpectedHoursForWeek(weeklyQuota, weekStart) {
  const workingDays = await getWorkingDaysInWeek(weekStart);

  // If there are no working days (e.g., entire week is holidays), return 0
  if (workingDays.length === 0) {
    return 0;
  }

  // Standard week has 5 working days
  // If week has fewer working days due to holidays, adjust proportionally
  const standardWorkingDays = 5;
  const actualWorkingDays = workingDays.length;

  return (weeklyQuota / standardWorkingDays) * actualWorkingDays;
}

module.exports = {
  getMonday,
  getSunday,
  isWeekend,
  isPublicHoliday,
  isWorkingDay,
  getWorkingDaysInWeek,
  countWorkingDays,
  getWeekBoundaries,
  formatDateForDB,
  getISOWeekNumber,
  getPublicHolidays,
  calculateExpectedHoursForWeek
};
