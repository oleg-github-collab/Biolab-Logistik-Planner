const db = require('../database');

/**
 * Auto-schedule Vollzeit employees for a given week
 * Creates schedule entries for Mon-Fri 8:00-17:00
 */
async function autoScheduleVollzeit(userId, weekStart) {
  return new Promise((resolve, reject) => {
    // Get user details to check if they're Vollzeit
    db.get(
      `SELECT employment_type, default_start_time, default_end_time
       FROM users WHERE id = ?`,
      [userId],
      (err, user) => {
        if (err) {
          return reject(err);
        }

        if (!user || user.employment_type !== 'Vollzeit') {
          return resolve({ message: 'User is not Vollzeit' });
        }

        const startTime = user.default_start_time || '08:00';
        const endTime = user.default_end_time || '17:00';

        // Create schedule for Monday (1) to Friday (5)
        const promises = [];
        for (let day = 1; day <= 5; day++) {
          promises.push(
            new Promise((res, rej) => {
              // Check if schedule already exists
              db.get(
                `SELECT id FROM weekly_schedules
                 WHERE user_id = ? AND week_start = ? AND day_of_week = ?`,
                [userId, weekStart, day],
                (err, existing) => {
                  if (err) return rej(err);

                  if (existing) {
                    // Already scheduled
                    return res({ day, status: 'exists' });
                  }

                  // Create new schedule entry
                  db.run(
                    `INSERT INTO weekly_schedules
                     (user_id, week_start, day_of_week, start_time, end_time, status)
                     VALUES (?, ?, ?, ?, ?, 'Arbeit')`,
                    [userId, weekStart, day, startTime, endTime],
                    function(err) {
                      if (err) return rej(err);
                      res({ day, id: this.lastID, status: 'created' });
                    }
                  );
                }
              );
            })
          );
        }

        Promise.all(promises)
          .then(results => resolve({
            message: 'Auto-schedule completed',
            results
          }))
          .catch(reject);
      }
    );
  });
}

/**
 * Auto-schedule Vollzeit employee when they register or update
 */
async function autoScheduleOnEmploymentChange(userId, employmentType) {
  if (employmentType !== 'Vollzeit') {
    return { message: 'Not Vollzeit, no auto-schedule' };
  }

  // Get current week start (Monday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  const weekStart = monday.toISOString().split('T')[0];

  return autoScheduleVollzeit(userId, weekStart);
}

/**
 * Check and create auto-schedules for all Vollzeit employees for upcoming weeks
 */
async function batchAutoScheduleVollzeit(weeksAhead = 4) {
  return new Promise((resolve, reject) => {
    // Get all Vollzeit users
    db.all(
      `SELECT id FROM users WHERE employment_type = 'Vollzeit'`,
      [],
      async (err, users) => {
        if (err) return reject(err);

        const results = [];
        const today = new Date();

        for (let week = 0; week < weeksAhead; week++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + (week * 7));

          const dayOfWeek = targetDate.getDay();
          const diff = targetDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const monday = new Date(targetDate.setDate(diff));
          const weekStart = monday.toISOString().split('T')[0];

          for (const user of users) {
            try {
              const result = await autoScheduleVollzeit(user.id, weekStart);
              results.push({ userId: user.id, weekStart, ...result });
            } catch (error) {
              results.push({ userId: user.id, weekStart, error: error.message });
            }
          }
        }

        resolve({
          message: `Batch auto-schedule completed for ${users.length} Vollzeit employees`,
          results
        });
      }
    );
  });
}

module.exports = {
  autoScheduleVollzeit,
  autoScheduleOnEmploymentChange,
  batchAutoScheduleVollzeit
};
