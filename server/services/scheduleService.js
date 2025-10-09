const db = require('../database');
const { format, addDays, startOfWeek, endOfWeek, isWeekend, startOfDay, endOfDay } = require('date-fns');

class ScheduleService {
  /**
   * Generates automatic schedule for Vollzeit employees (8:00-16:30 working hours)
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for schedule generation
   * @param {Date} endDate - End date for schedule generation
   */
  static async generateVollzeitSchedule(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      // First check if user is Vollzeit and has auto_schedule enabled
      db.get(
        "SELECT employment_type, auto_schedule, default_start_time, default_end_time FROM users WHERE id = ?",
        [userId],
        async (err, user) => {
          if (err) {
            return reject(err);
          }

          if (!user || user.employment_type !== 'Vollzeit' || !user.auto_schedule) {
            return resolve([]); // No automatic scheduling needed
          }

          const events = [];
          let currentDate = new Date(startDate);

          while (currentDate <= endDate) {
            // Skip weekends (Saturday = 6, Sunday = 0)
            if (!isWeekend(currentDate)) {
              const dateStr = format(currentDate, 'yyyy-MM-dd');

              // Check if there's already an event for this date
              const existingEvent = await this.checkExistingEvent(userId, dateStr);

              if (!existingEvent) {
                const startTime = user.default_start_time || '08:00';
                const endTime = user.default_end_time || '16:30';

                const event = {
                  title: 'Arbeit',
                  description: 'Automatisch generierte Arbeitszeit',
                  start_date: dateStr,
                  end_date: dateStr,
                  start_time: startTime,
                  end_time: endTime,
                  type: 'Arbeit',
                  is_all_day: false,
                  priority: 'medium',
                  category: 'work',
                  auto_generated: true
                };

                events.push(event);
              }
            }

            currentDate = addDays(currentDate, 1);
          }

          // Insert all events
          try {
            for (const event of events) {
              await this.createEvent(userId, event);
            }
            resolve(events);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Check if an event already exists for a specific date
   */
  static checkExistingEvent(userId, dateStr) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM events WHERE user_id = ? AND start_date = ? AND type = 'Arbeit'",
        [userId, dateStr],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  /**
   * Create a single event
   */
  static createEvent(userId, eventData) {
    return new Promise((resolve, reject) => {
      const startDateTime = eventData.is_all_day
        ? `${eventData.start_date}T00:00:00`
        : `${eventData.start_date}T${eventData.start_time}:00`;

      const endDateTime = eventData.is_all_day
        ? `${eventData.end_date}T23:59:59`
        : `${eventData.end_date}T${eventData.end_time}:00`;

      db.run(
        `INSERT INTO events (
          user_id, title, description, start_date, end_date, start_time, end_time,
          type, is_all_day, priority, category, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          userId,
          eventData.title,
          eventData.description,
          startDateTime,
          endDateTime,
          eventData.start_time,
          eventData.end_time,
          eventData.type,
          eventData.is_all_day ? 1 : 0,
          eventData.priority,
          eventData.category
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Generate schedule for the upcoming week for all Vollzeit employees
   */
  static async generateWeeklyScheduleForAllVollzeit() {
    return new Promise((resolve, reject) => {
      // Get all Vollzeit employees with auto_schedule enabled
      db.all(
        "SELECT id FROM users WHERE employment_type = 'Vollzeit' AND auto_schedule = 1",
        [],
        async (err, users) => {
          if (err) {
            return reject(err);
          }

          const today = new Date();
          const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
          const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday

          try {
            for (const user of users) {
              await this.generateVollzeitSchedule(user.id, weekStart, weekEnd);
            }
            resolve(`Generated schedules for ${users.length} Vollzeit employees`);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Create absence event (Urlaub, Krankheit, Überstundenabbau)
   * This will override any automatic work schedule for the specified period
   */
  static async createAbsenceEvent(userId, absenceData) {
    return new Promise(async (resolve, reject) => {
      try {
        // First, delete any existing work events for the absence period
        await this.deleteWorkEventsInPeriod(userId, absenceData.start_date, absenceData.end_date);

        // Create the absence event
        const eventId = await this.createEvent(userId, {
          title: absenceData.title,
          description: absenceData.description || '',
          start_date: absenceData.start_date,
          end_date: absenceData.end_date,
          start_time: absenceData.start_time || '00:00',
          end_time: absenceData.end_time || '23:59',
          type: absenceData.type, // 'Urlaub', 'Krankheit', 'Überstundenabbau'
          is_all_day: absenceData.is_all_day || true,
          priority: 'high',
          category: 'absence'
        });

        resolve(eventId);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Delete work events in a specific period (for absence management)
   */
  static deleteWorkEventsInPeriod(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM events WHERE user_id = ? AND type = 'Arbeit' AND start_date >= ? AND end_date <= ?",
        [userId, startDate, endDate],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * Get user's employment info
   */
  static getUserEmploymentInfo(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT employment_type, auto_schedule, default_start_time, default_end_time FROM users WHERE id = ?",
        [userId],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }
}

module.exports = ScheduleService;