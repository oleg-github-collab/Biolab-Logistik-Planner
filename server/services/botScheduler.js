/**
 * Bot Scheduler - Manages automated tasks for BL_Bot
 *
 * Schedules:
 * - Daily morning notifications at 8:00 AM (weekdays only)
 * - Weekly reports every Friday at 3:00 PM
 */

const cron = require('node-cron');
const { pool } = require('../config/database');
const blBot = require('./blBot');
const logger = require('../utils/logger');

class BotScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start all scheduled tasks
   */
  async start() {
    if (this.isRunning) {
      logger.warn('BotScheduler is already running');
      console.log('⚠️  BotScheduler is already running');
      return;
    }

    console.log('🤖 Initializing BL_Bot...');
    logger.info('Initializing BL_Bot...');

    // Initialize BL_Bot first
    const initialized = await blBot.initialize();

    console.log('🤖 BL_Bot initialization result:', initialized);
    logger.info('BL_Bot initialization result', { initialized });

    if (!initialized) {
      logger.error('❌ BL_Bot initialization failed, scheduler will not start');
      console.error('❌ BL_Bot initialization failed, scheduler will not start');
      return;
    }

    // Schedule daily morning notifications (8:00 AM, Monday-Friday)
    const morningJob = cron.schedule('0 8 * * 1-5', async () => {
      logger.info('🌅 Running daily morning notifications...');
      await this.sendDailyNotifications();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });

    // Schedule weekly reports (Friday 3:00 PM)
    const weeklyJob = cron.schedule('0 15 * * 5', async () => {
      logger.info('📊 Running weekly reports...');
      await this.sendWeeklyReports();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });

    this.jobs.push(morningJob, weeklyJob);
    this.isRunning = true;

    logger.info('✅ BotScheduler started successfully', {
      jobs: [
        'Daily notifications: 8:00 AM (Mon-Fri)',
        'Weekly reports: 3:00 PM (Friday)'
      ]
    });
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;
    logger.info('⏹️  BotScheduler stopped');
  }

  /**
   * Send daily morning notifications to all active users
   */
  async sendDailyNotifications() {
    try {
      // Get all active users (excluding system users)
      const users = await pool.query(
        `SELECT id, name, email FROM users WHERE is_active = true AND is_system_user = false`
      );

      logger.info(`Sending daily notifications to ${users.rows.length} users`);

      for (const user of users.rows) {
        try {
          await blBot.sendDailyMorningNotification(user.id);
        } catch (error) {
          logger.error(`Error sending daily notification to user ${user.id}:`, error);
        }
      }

      logger.info('✅ Daily notifications completed');
    } catch (error) {
      logger.error('Error in sendDailyNotifications:', error);
    }
  }

  /**
   * Send weekly reports to all active users
   */
  async sendWeeklyReports() {
    try {
      // Get all active users (excluding system users)
      const users = await pool.query(
        `SELECT id, name, email FROM users WHERE is_active = true AND is_system_user = false`
      );

      logger.info(`Sending weekly reports to ${users.rows.length} users`);

      for (const user of users.rows) {
        try {
          await blBot.sendWeeklyReport(user.id);
        } catch (error) {
          logger.error(`Error sending weekly report to user ${user.id}:`, error);
        }
      }

      logger.info('✅ Weekly reports completed');
    } catch (error) {
      logger.error('Error in sendWeeklyReports:', error);
    }
  }

  /**
   * Manually trigger daily notifications (for testing)
   */
  async triggerDailyNotifications() {
    logger.info('🔧 Manually triggering daily notifications...');
    await this.sendDailyNotifications();
  }

  /**
   * Manually trigger weekly reports (for testing)
   */
  async triggerWeeklyReports() {
    logger.info('🔧 Manually triggering weekly reports...');
    await this.sendWeeklyReports();
  }
}

// Export singleton instance
const botScheduler = new BotScheduler();
module.exports = botScheduler;
