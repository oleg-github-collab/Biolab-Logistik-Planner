/**
 * BL_Bot - Intelligent AI Assistant for Biolab Logistik Planner
 *
 * Features:
 * - Daily morning notifications (8:00 AM, weekdays only)
 * - Weekly reports every Friday at 3:00 PM with statistics and charts
 * - Natural language queries about user data, vacations, sick leaves, etc.
 * - Knowledge base consultation
 * - Full access to all team data as admin
 */

const { pool } = require('../config/database');
const { getIO } = require('../websocket');
const logger = require('../utils/logger');
const OpenAI = require('openai');

class BLBot {
  constructor() {
    this.botUser = null;
    this.openai = null;
    this.initialized = false;
  }

  /**
   * Initialize BL_Bot with OpenAI and database connection
   */
  async initialize() {
    try {
      // Initialize OpenAI
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('⚠️  BL_Bot: OPENAI_API_KEY not set, AI features will be disabled');
      } else {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      }

      // Get BL_Bot user from database
      const result = await pool.query(
        `SELECT * FROM users WHERE email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de') AND is_system_user = true LIMIT 1`
      );

      if (result.rows.length === 0) {
        logger.error('❌ BL_Bot user not found in database. Run migration 050_rename_bot_to_bl_bot.sql');
        return false;
      }

      this.botUser = result.rows[0];
      this.initialized = true;

      logger.info('✅ BL_Bot initialized successfully', {
        botId: this.botUser.id,
        botName: this.botUser.name,
        botEmail: this.botUser.email,
        role: this.botUser.role,
        aiEnabled: !!this.openai
      });

      return true;
    } catch (error) {
      logger.error('❌ BL_Bot initialization failed:', error);
      return false;
    }
  }

  /**
   * Get user data for AI context
   */
  async getUserContext(userId) {
    try {
      const user = await pool.query(
        `SELECT id, name, email, role, employment_type, weekly_hours_quota FROM users WHERE id = $1`,
        [userId]
      );

      if (user.rows.length === 0) return null;

      // Get user's tasks
      const tasks = await pool.query(
        `SELECT id, title, status, priority, due_date, category
         FROM tasks
         WHERE assigned_to = $1
         ORDER BY
           CASE status
             WHEN 'in_progress' THEN 1
             WHEN 'todo' THEN 2
             WHEN 'review' THEN 3
             ELSE 4
           END,
           due_date ASC NULLS LAST
         LIMIT 20`,
        [userId]
      );

      // Get recent calendar events (last 30 days and next 30 days)
      const events = await pool.query(
        `SELECT id, title, event_type, category, start_time, end_time, all_day, status
         FROM calendar_events
         WHERE created_by = $1
         AND start_time >= CURRENT_DATE - INTERVAL '30 days'
         AND start_time <= CURRENT_DATE + INTERVAL '30 days'
         ORDER BY start_time DESC`,
        [userId]
      );

      // Get current week schedule
      const currentWeekStart = this.getMonday(new Date()).toISOString().split('T')[0];
      const schedule = await pool.query(
        `SELECT day_of_week, is_working, start_time, end_time
         FROM weekly_schedules
         WHERE user_id = $1 AND week_start = $2
         ORDER BY day_of_week`,
        [userId, currentWeekStart]
      );

      return {
        user: user.rows[0],
        tasks: tasks.rows,
        events: events.rows,
        schedule: schedule.rows
      };
    } catch (error) {
      logger.error('Error getting user context:', error);
      return null;
    }
  }

  /**
   * Get knowledge base articles for AI context
   */
  async getKnowledgeBaseContext(query = null) {
    try {
      let sql = `
        SELECT a.id, a.title, a.content, a.summary, c.name as category_name
        FROM kb_articles a
        LEFT JOIN kb_categories c ON a.category_id = c.id
        WHERE a.status = 'published'
      `;

      const params = [];

      if (query) {
        sql += ` AND (a.title ILIKE $1 OR a.content ILIKE $1 OR a.summary ILIKE $1)`;
        params.push(`%${query}%`);
      }

      sql += ` ORDER BY a.view_count DESC LIMIT 10`;

      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting KB context:', error);
      return [];
    }
  }

  /**
   * Generate AI response using OpenAI
   */
  async generateAIResponse(userMessage, userId) {
    if (!this.openai) {
      return 'Вибачте, AI-функції зараз недоступні. Адміністратор ще не налаштував OpenAI API ключ.';
    }

    try {
      // Get user context
      const userContext = await this.getUserContext(userId);
      if (!userContext) {
        return 'Не вдалося отримати дані користувача.';
      }

      // Get relevant KB articles
      const kbArticles = await this.getKnowledgeBaseContext(userMessage);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(userContext, kbArticles);

      // Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return 'Вибачте, виникла помилка при обробці вашого запиту.';
    }
  }

  /**
   * Build system prompt for AI
   */
  buildSystemPrompt(userContext, kbArticles) {
    const { user, tasks, events, schedule } = userContext;

    let prompt = `Du bist BL_Bot, der intelligente KI-Assistent für Biolab Logistik Planner.

**Über den Benutzer:**
- Name: ${user.name}
- E-Mail: ${user.email}
- Rolle: ${user.role}
- Beschäftigungsart: ${user.employment_type}
- Wochenstundenkontingent: ${user.weekly_hours_quota}h

**Aktuelle Aufgaben (${tasks.length}):**
${tasks.map(t => `- [${t.status}] ${t.title} ${t.due_date ? `(Fällig: ${t.due_date})` : ''}`).join('\n')}

**Kommende Ereignisse (${events.length}):**
${events.slice(0, 5).map(e => `- ${e.title} (${e.event_type}) - ${new Date(e.start_time).toLocaleDateString('de-DE')}`).join('\n')}

**Wochenplan:**
${schedule.map(s => {
  const dayName = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][s.day_of_week];
  return `- ${dayName}: ${s.is_working ? `${s.start_time?.substring(0,5)} - ${s.end_time?.substring(0,5)}` : 'Frei'}`;
}).join('\n')}
`;

    if (kbArticles.length > 0) {
      prompt += `\n**Wissensdatenbank (relevante Artikel):**\n`;
      kbArticles.forEach(article => {
        prompt += `\n### ${article.title}\n${article.summary || article.content.substring(0, 300)}...\n`;
      });
    }

    prompt += `\n**Deine Aufgabe:**
- Beantworte Fragen auf Deutsch präzise und freundlich
- Nutze die Wissensdatenbank für fachliche Fragen
- Gib konkrete Daten und Statistiken wenn verfügbar
- Sei hilfsbereit und proaktiv
- Formatiere Antworten klar und strukturiert`;

    return prompt;
  }

  /**
   * Send daily morning notification (8:00 AM, weekdays only)
   */
  async sendDailyMorningNotification(userId) {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return;
      }

      const userContext = await this.getUserContext(userId);
      if (!userContext) return;

      const { user, tasks } = userContext;

      // Count tasks by status
      const todoTasks = tasks.filter(t => t.status === 'todo').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < today).length;

      const message = `☀️ Guten Morgen, ${user.name}!

📋 **Deine Aufgaben für heute:**
- ${inProgressTasks} in Bearbeitung
- ${todoTasks} zu erledigen
${overdueTasks > 0 ? `- ⚠️ ${overdueTasks} überfällig` : ''}

Viel Erfolg heute! 💪`;

      await this.sendMessage(userId, message);

      logger.info('Daily morning notification sent', { userId, userName: user.name });
    } catch (error) {
      logger.error('Error sending daily morning notification:', error);
    }
  }

  /**
   * Generate weekly report with statistics
   */
  async generateWeeklyReport(userId) {
    try {
      const userContext = await this.getUserContext(userId);
      if (!userContext) return null;

      const { user, tasks, events } = userContext;
      const today = new Date();
      const weekStart = this.getMonday(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Get completed tasks this week
      const completedThisWeek = await pool.query(
        `SELECT COUNT(*) as count
         FROM tasks
         WHERE assigned_to = $1
         AND status = 'done'
         AND updated_at >= $2
         AND updated_at < $3`,
        [userId, weekStart, weekEnd]
      );

      // Get worked hours this week
      const workedHours = await pool.query(
        `SELECT SUM(
           EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
         ) as total_hours
         FROM weekly_schedules
         WHERE user_id = $1
         AND week_start = $2
         AND is_working = true`,
        [userId, weekStart.toISOString().split('T')[0]]
      );

      const completedCount = completedThisWeek.rows[0].count;
      const totalHours = parseFloat(workedHours.rows[0].total_hours || 0).toFixed(1);
      const quota = user.weekly_hours_quota;
      const hoursStatus = totalHours < quota ? '📉 Unter' : totalHours > quota ? '📈 Über' : '✅ Genau';

      const report = `📊 **Wochenbericht für ${user.name}**
📅 KW ${this.getWeekNumber(today)} (${weekStart.toLocaleDateString('de-DE')} - ${weekEnd.toLocaleDateString('de-DE')})

✅ **Erledigte Aufgaben:** ${completedCount}
⏰ **Gearbeitete Stunden:** ${totalHours}h / ${quota}h ${hoursStatus}
📋 **Offene Aufgaben:** ${tasks.filter(t => t.status !== 'done').length}
📆 **Ereignisse diese Woche:** ${events.filter(e => {
  const eventDate = new Date(e.start_time);
  return eventDate >= weekStart && eventDate < weekEnd;
}).length}

${totalHours < quota ? '💡 **Tipp:** Du hast noch Stunden übrig diese Woche!' : ''}
${tasks.filter(t => t.status === 'in_progress').length > 5 ? '⚠️ **Achtung:** Viele parallele Aufgaben - fokussiere dich!' : ''}

Schönes Wochenende! 🎉`;

      return report;
    } catch (error) {
      logger.error('Error generating weekly report:', error);
      return null;
    }
  }

  /**
   * Send weekly report to user (Friday 3:00 PM)
   */
  async sendWeeklyReport(userId) {
    try {
      const report = await this.generateWeeklyReport(userId);
      if (!report) return;

      await this.sendMessage(userId, report);

      logger.info('Weekly report sent', { userId });
    } catch (error) {
      logger.error('Error sending weekly report:', error);
    }
  }

  /**
   * Send message from BL_Bot to user
   */
  async sendMessage(recipientId, message) {
    try {
      if (!this.initialized || !this.botUser) {
        logger.error('BL_Bot not initialized');
        return;
      }

      // Insert message into database
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at)
         VALUES ($1, $2, $3, false, NOW())
         RETURNING *`,
        [this.botUser.id, recipientId, message]
      );

      const newMessage = result.rows[0];

      // Send via WebSocket
      const io = getIO();
      if (io) {
        io.to(`user_${recipientId}`).emit('message:new', {
          ...newMessage,
          sender_name: this.botUser.name,
          sender_photo: this.botUser.profile_photo
        });
      }

      logger.info('BL_Bot message sent', { recipientId, messageId: newMessage.id });
    } catch (error) {
      logger.error('Error sending BL_Bot message:', error);
    }
  }

  /**
   * Process incoming message to BL_Bot
   */
  async processIncomingMessage(userId, message) {
    try {
      // Check for common queries
      const lowerMessage = message.toLowerCase();

      // Vacation query
      if (lowerMessage.includes('urlaub') || lowerMessage.includes('відпуст')) {
        return await this.handleVacationQuery(userId);
      }

      // Sick leave query
      if (lowerMessage.includes('krank') || lowerMessage.includes('лікарня')) {
        return await this.handleSickLeaveQuery(userId);
      }

      // Tasks query
      if (lowerMessage.includes('aufgabe') || lowerMessage.includes('завдан')) {
        return await this.handleTasksQuery(userId);
      }

      // Hours/schedule query
      if (lowerMessage.includes('stunden') || lowerMessage.includes('години') || lowerMessage.includes('zeitplan')) {
        return await this.handleScheduleQuery(userId);
      }

      // Default: Use AI to answer
      return await this.generateAIResponse(message, userId);
    } catch (error) {
      logger.error('Error processing incoming message:', error);
      return 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Nachricht.';
    }
  }

  /**
   * Handle vacation query
   */
  async handleVacationQuery(userId) {
    try {
      const vacations = await pool.query(
        `SELECT title, start_time, end_time
         FROM calendar_events
         WHERE created_by = $1
         AND event_type = 'Urlaub'
         ORDER BY start_time DESC
         LIMIT 5`,
        [userId]
      );

      if (vacations.rows.length === 0) {
        return '🏖️ Du hast noch keine Urlaubseinträge in deinem Kalender.';
      }

      const lastVacation = vacations.rows[0];
      const lastDate = new Date(lastVacation.start_time);

      let response = `🏖️ **Deine letzten Urlaube:**\n\n`;
      vacations.rows.forEach(v => {
        const start = new Date(v.start_time).toLocaleDateString('de-DE');
        const end = new Date(v.end_time).toLocaleDateString('de-DE');
        response += `📅 ${start} - ${end}: ${v.title}\n`;
      });

      response += `\n➡️ Letzter Urlaub war am ${lastDate.toLocaleDateString('de-DE')}`;

      return response;
    } catch (error) {
      logger.error('Error handling vacation query:', error);
      return 'Fehler beim Abrufen der Urlaubsdaten.';
    }
  }

  /**
   * Handle sick leave query
   */
  async handleSickLeaveQuery(userId) {
    try {
      const sickLeaves = await pool.query(
        `SELECT title, start_time, end_time
         FROM calendar_events
         WHERE created_by = $1
         AND event_type = 'Krankheit'
         ORDER BY start_time DESC
         LIMIT 5`,
        [userId]
      );

      if (sickLeaves.rows.length === 0) {
        return '🏥 Du hast keine Krankmeldungen in deinem Kalender.';
      }

      const lastSickLeave = sickLeaves.rows[0];
      const lastDate = new Date(lastSickLeave.start_time);

      let response = `🏥 **Deine Krankmeldungen:**\n\n`;
      sickLeaves.rows.forEach(s => {
        const start = new Date(s.start_time).toLocaleDateString('de-DE');
        const end = new Date(s.end_time).toLocaleDateString('de-DE');
        response += `📅 ${start} - ${end}: ${s.title}\n`;
      });

      response += `\n➡️ Letzte Krankmeldung: ${lastDate.toLocaleDateString('de-DE')}`;

      return response;
    } catch (error) {
      logger.error('Error handling sick leave query:', error);
      return 'Fehler beim Abrufen der Krankheitsdaten.';
    }
  }

  /**
   * Handle tasks query
   */
  async handleTasksQuery(userId) {
    try {
      const tasks = await pool.query(
        `SELECT title, status, priority, due_date
         FROM tasks
         WHERE assigned_to = $1
         AND status != 'done'
         ORDER BY
           CASE priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END,
           due_date ASC NULLS LAST
         LIMIT 10`,
        [userId]
      );

      if (tasks.rows.length === 0) {
        return '✅ Super! Du hast keine offenen Aufgaben.';
      }

      let response = `📋 **Deine offenen Aufgaben (${tasks.rows.length}):**\n\n`;
      tasks.rows.forEach(t => {
        const emoji = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '🟢';
        const dueDate = t.due_date ? ` (Fällig: ${new Date(t.due_date).toLocaleDateString('de-DE')})` : '';
        response += `${emoji} [${t.status}] ${t.title}${dueDate}\n`;
      });

      return response;
    } catch (error) {
      logger.error('Error handling tasks query:', error);
      return 'Fehler beim Abrufen der Aufgaben.';
    }
  }

  /**
   * Handle schedule/hours query
   */
  async handleScheduleQuery(userId) {
    try {
      const user = await pool.query(
        `SELECT name, weekly_hours_quota FROM users WHERE id = $1`,
        [userId]
      );

      if (user.rows.length === 0) return 'Benutzer nicht gefunden.';

      const currentWeekStart = this.getMonday(new Date()).toISOString().split('T')[0];

      const schedule = await pool.query(
        `SELECT day_of_week, is_working, start_time, end_time
         FROM weekly_schedules
         WHERE user_id = $1 AND week_start = $2
         ORDER BY day_of_week`,
        [userId, currentWeekStart]
      );

      const workedHours = await pool.query(
        `SELECT SUM(
           EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
         ) as total_hours
         FROM weekly_schedules
         WHERE user_id = $1
         AND week_start = $2
         AND is_working = true`,
        [userId, currentWeekStart]
      );

      const totalHours = parseFloat(workedHours.rows[0].total_hours || 0).toFixed(1);
      const quota = user.rows[0].weekly_hours_quota;

      let response = `⏰ **Dein Stundenplan diese Woche:**\n\n`;
      const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

      schedule.rows.forEach(s => {
        const day = dayNames[s.day_of_week];
        if (s.is_working) {
          response += `✅ ${day}: ${s.start_time?.substring(0,5)} - ${s.end_time?.substring(0,5)}\n`;
        } else {
          response += `❌ ${day}: Frei\n`;
        }
      });

      response += `\n📊 **Summe:** ${totalHours}h / ${quota}h`;
      if (totalHours < quota) {
        response += ` (${(quota - totalHours).toFixed(1)}h unter Soll)`;
      } else if (totalHours > quota) {
        response += ` (${(totalHours - quota).toFixed(1)}h Überstunden)`;
      }

      return response;
    } catch (error) {
      logger.error('Error handling schedule query:', error);
      return 'Fehler beim Abrufen des Zeitplans.';
    }
  }

  /**
   * Utility: Get Monday of current week
   */
  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Utility: Get ISO week number
   */
  getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

// Export singleton instance
const blBot = new BLBot();
module.exports = blBot;
