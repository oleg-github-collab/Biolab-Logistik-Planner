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
   * Get user data for AI context (ENHANCED with full system access)
   */
  async getUserContext(userId) {
    try {
      const user = await pool.query(
        `SELECT id, name, email, role, employment_type, weekly_hours_quota, created_at FROM users WHERE id = $1`,
        [userId]
      );

      if (user.rows.length === 0) return null;

      // Get ALL user's tasks (not limited to 20)
      const tasks = await pool.query(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.category, t.description,
                t.created_at, t.updated_at,
                u.name as assigned_to_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.assigned_to = $1
         ORDER BY
           CASE t.status
             WHEN 'in_progress' THEN 1
             WHEN 'todo' THEN 2
             WHEN 'review' THEN 3
             ELSE 4
           END,
           t.due_date ASC NULLS LAST`,
        [userId]
      );

      // Get ALL calendar events (extended timeframe: last 90 days and next 180 days)
      const events = await pool.query(
        `SELECT id, title, event_type, category, start_time, end_time, all_day, status,
                description, location, priority
         FROM calendar_events
         WHERE created_by = $1
         AND start_time >= CURRENT_DATE - INTERVAL '90 days'
         AND start_time <= CURRENT_DATE + INTERVAL '180 days'
         ORDER BY start_time ASC`,
        [userId]
      );

      // Get current week schedule
      const currentWeekStart = this.getMonday(new Date()).toISOString().split('T')[0];
      const schedule = await pool.query(
        `SELECT day_of_week, is_working, start_time, end_time, notes
         FROM weekly_schedules
         WHERE user_id = $1 AND week_start = $2
         ORDER BY day_of_week`,
        [userId, currentWeekStart]
      );

      // Get historical work hours (last 4 weeks)
      const workHistory = await pool.query(
        `SELECT week_start,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
         FROM weekly_schedules
         WHERE user_id = $1
         AND is_working = true
         AND week_start >= CURRENT_DATE - INTERVAL '4 weeks'
         GROUP BY week_start
         ORDER BY week_start DESC`,
        [userId]
      );

      // Get recent audit log entries for this user
      const auditLog = await pool.query(
        `SELECT action, entity_type, changes, created_at
         FROM audit_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      return {
        user: user.rows[0],
        tasks: tasks.rows,
        events: events.rows,
        schedule: schedule.rows,
        workHistory: workHistory.rows,
        auditLog: auditLog.rows
      };
    } catch (error) {
      logger.error('Error getting user context:', error);
      return null;
    }
  }

  /**
   * Get knowledge base articles for AI context (ENHANCED)
   */
  async getKnowledgeBaseContext(query = null) {
    try {
      let sql = `
        SELECT a.id, a.title, a.content, a.summary, a.tags,
               c.name as category_name, c.description as category_description
        FROM kb_articles a
        LEFT JOIN kb_categories c ON a.category_id = c.id
        WHERE a.status = 'published'
      `;

      const params = [];

      if (query) {
        // Enhanced search: title, content, summary, tags
        sql += ` AND (
          a.title ILIKE $1 OR
          a.content ILIKE $1 OR
          a.summary ILIKE $1 OR
          a.tags::text ILIKE $1 OR
          c.name ILIKE $1
        )`;
        params.push(`%${query}%`);
        sql += ` ORDER BY
          CASE
            WHEN a.title ILIKE $1 THEN 1
            WHEN a.summary ILIKE $1 THEN 2
            ELSE 3
          END,
          a.view_count DESC
          LIMIT 20`;
      } else {
        // Without query, get top articles from all categories
        sql += ` ORDER BY a.view_count DESC, a.updated_at DESC LIMIT 30`;
      }

      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting KB context:', error);
      return [];
    }
  }

  /**
   * Get team context (for admin queries)
   */
  async getTeamContext() {
    try {
      // Get all active users (excluding system users)
      const users = await pool.query(
        `SELECT id, name, email, role, employment_type, weekly_hours_quota, status
         FROM users
         WHERE is_active = true AND is_system_user = false
         ORDER BY name`
      );

      // Get current week for all users
      const currentWeekStart = this.getMonday(new Date()).toISOString().split('T')[0];
      const teamSchedule = await pool.query(
        `SELECT ws.user_id, u.name as user_name,
                SUM(EXTRACT(EPOCH FROM (ws.end_time - ws.start_time)) / 3600) as total_hours
         FROM weekly_schedules ws
         JOIN users u ON ws.user_id = u.id
         WHERE ws.week_start = $1 AND ws.is_working = true
         GROUP BY ws.user_id, u.name
         ORDER BY u.name`,
        [currentWeekStart]
      );

      // Get task statistics per user
      const taskStats = await pool.query(
        `SELECT assigned_to as user_id, u.name as user_name,
                status,
                COUNT(*) as count
         FROM tasks t
         JOIN users u ON t.assigned_to = u.id
         GROUP BY assigned_to, u.name, status
         ORDER BY u.name, status`
      );

      return {
        users: users.rows,
        teamSchedule: teamSchedule.rows,
        taskStats: taskStats.rows
      };
    } catch (error) {
      logger.error('Error getting team context:', error);
      return null;
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
   * Build system prompt for AI with ethical guidelines
   */
  buildSystemPrompt(userContext, kbArticles) {
    const { user, tasks, events, schedule, workHistory, auditLog } = userContext;

    let prompt = `Du bist BL_Bot, der intelligente und ethische KI-Assistent für Biolab Logistik Planner.

**🔒 DATENSCHUTZ & ETHIK (ABSOLUTE PRIORITÄT):**
- Teile NIEMALS Passwörter, API-Schlüssel oder sensible Credentials
- Gib KEINE personenbezogenen Daten anderer Benutzer weiter (außer bei berechtigten Admin-Anfragen)
- Respektiere die Privatsphäre aller Teammitglieder
- Verweigere Anfragen nach sensiblen Finanzdaten oder Gehaltsinformationen
- Sei transparent: wenn du etwas nicht weißt, sag es ehrlich
- Manipuliere oder verändere KEINE Daten - nur informieren und beraten

**📊 AKTUELLE SYSTEMDATEN (Stand: ${new Date().toLocaleString('de-DE')}):**

**Benutzer:**
- Name: ${user.name}
- E-Mail: ${user.email}
- Rolle: ${user.role}
- Beschäftigungsart: ${user.employment_type}
- Wochenstundenkontingent: ${user.weekly_hours_quota}h
- Mitglied seit: ${new Date(user.created_at).toLocaleDateString('de-DE')}

**Aktuelle Aufgaben (${tasks.length} gesamt):**
${tasks.length > 0 ? tasks.slice(0, 15).map(t => `- [${t.status}] [${t.priority}] ${t.title} ${t.due_date ? `(Fällig: ${new Date(t.due_date).toLocaleDateString('de-DE')})` : ''}`).join('\n') : '- Keine Aufgaben'}
${tasks.length > 15 ? `\n... und ${tasks.length - 15} weitere Aufgaben` : ''}

**Ereignisse (${events.length} in den nächsten 6 Monaten):**
${events.length > 0 ? events.slice(0, 10).map(e => `- ${e.title} (${e.event_type}) - ${new Date(e.start_time).toLocaleDateString('de-DE')}${e.priority ? ` [${e.priority}]` : ''}`).join('\n') : '- Keine Ereignisse'}
${events.length > 10 ? `\n... und ${events.length - 10} weitere Ereignisse` : ''}

**Wochenplan (KW ${this.getWeekNumber(new Date())}):**
${schedule.map(s => {
  const dayName = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][s.day_of_week];
  return `- ${dayName}: ${s.is_working ? `${s.start_time?.substring(0,5)} - ${s.end_time?.substring(0,5)}` : 'Frei'}`;
}).join('\n')}

**Arbeitszeit-Historie (letzte 4 Wochen):**
${workHistory.length > 0 ? workHistory.map(w => `- KW ${this.getWeekNumber(new Date(w.week_start))}: ${parseFloat(w.total_hours).toFixed(1)}h`).join('\n') : '- Keine Daten verfügbar'}

**Letzte Aktivitäten:**
${auditLog.length > 0 ? auditLog.slice(0, 5).map(a => `- ${a.action} ${a.entity_type} am ${new Date(a.created_at).toLocaleDateString('de-DE')}`).join('\n') : '- Keine Aktivitäten'}
`;

    if (kbArticles.length > 0) {
      prompt += `\n**📚 WISSENSDATENBANK (${kbArticles.length} relevante Artikel):**\n`;
      kbArticles.slice(0, 10).forEach(article => {
        prompt += `\n### ${article.title} (${article.category_name || 'Allgemein'})\n`;
        const content = article.summary || article.content;
        prompt += `${content.substring(0, 500)}${content.length > 500 ? '...' : ''}\n`;
        if (article.tags) {
          prompt += `Tags: ${Array.isArray(article.tags) ? article.tags.join(', ') : article.tags}\n`;
        }
      });
      if (kbArticles.length > 10) {
        prompt += `\n... und ${kbArticles.length - 10} weitere Artikel verfügbar\n`;
      }
    }

    prompt += `\n**🎯 DEINE AUFGABE & RICHTLINIEN:**

1. **Genauigkeit**: Antworte NUR mit Fakten aus den bereitgestellten Daten
2. **Klarheit**: Formuliere Antworten präzise, strukturiert und verständlich
3. **Hilfsbereitschaft**: Sei proaktiv und gib konkrete Handlungsempfehlungen
4. **Professionalität**: Bleibe höflich, respektvoll und sachlich
5. **Vollständigkeit**: Bei Statistiken nenne immer Zeiträume und Datenquellen
6. **Ehrlichkeit**: Wenn Daten fehlen, sage es klar und schlage Alternativen vor
7. **Sicherheit**: Bei sicherheitsrelevanten Fragen (Chemikalien, Verfahren) verweise auf KB-Artikel
8. **Aktualität**: Alle Daten sind LIVE aus der Datenbank - nutze das!

**🚫 NIEMALS:**
- Erfinde keine Daten oder Statistiken
- Teile sensible Informationen anderer Benutzer
- Gib medizinische, rechtliche oder finanzielle Beratung
- Manipuliere oder verändere Systemdaten
- Erlaube unsichere Praktiken oder Verstöße gegen Sicherheitsrichtlinien

**✅ FORMAT:**
- Nutze Markdown für Formatierung
- Verwende Emojis sparsam und professionell
- Strukturiere lange Antworten mit Überschriften
- Bei Zahlen: immer Einheiten angeben (h, €, %, etc.)
- Bei Daten: deutsches Format (DD.MM.YYYY)`;

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
   * Send message from BL_Bot to user (direct message)
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
   * Send message from BL_Bot to group conversation
   */
  async sendMessageToConversation(conversationId, message) {
    try {
      if (!this.initialized || !this.botUser) {
        logger.error('BL_Bot not initialized');
        return;
      }

      // Insert message into database
      const result = await pool.query(
        `INSERT INTO messages (sender_id, conversation_id, content, message_type, created_at)
         VALUES ($1, $2, $3, 'text', NOW())
         RETURNING *`,
        [this.botUser.id, conversationId, message]
      );

      const newMessage = result.rows[0];

      // Get conversation members
      const members = await pool.query(
        `SELECT user_id FROM message_conversation_members WHERE conversation_id = $1`,
        [conversationId]
      );

      // Send via WebSocket to all conversation members
      const io = getIO();
      if (io) {
        const payload = {
          conversationId,
          message: {
            ...newMessage,
            sender_name: this.botUser.name,
            sender_photo: this.botUser.profile_photo
          }
        };

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit('conversation:new_message', payload);

        // Also emit to individual user rooms
        members.rows.forEach(member => {
          if (member.user_id !== this.botUser.id) {
            io.to(`user_${member.user_id}`).emit('conversation:new_message', payload);
          }
        });
      }

      logger.info('BL_Bot message sent to conversation', { conversationId, messageId: newMessage.id });
    } catch (error) {
      logger.error('Error sending BL_Bot message to conversation:', error);
    }
  }

  /**
   * Process incoming message to BL_Bot (ENHANCED with complex query support)
   */
  async processIncomingMessage(userId, message) {
    try {
      logger.info('🤖 BL_Bot processing incoming message', {
        userId,
        message,
        messageLength: message?.length,
        openaiEnabled: !!this.openai
      });

      if (!message || typeof message !== 'string') {
        return 'Bitte senden Sie eine gültige Nachricht.';
      }

      const lowerMessage = message.toLowerCase().trim();

      // Get user to check permissions
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return 'Benutzer nicht gefunden.';
      }
      const userRole = userResult.rows[0].role;

      // TEAM/ADMIN queries (only for admin/superadmin)
      if (userRole === 'admin' || userRole === 'superadmin') {
        if (lowerMessage.includes('team') || lowerMessage.includes('alle') || lowerMessage.includes('übersicht')) {
          return await this.handleTeamQuery(message);
        }
      }

      // STATISTICS queries
      if (lowerMessage.includes('statistik') || lowerMessage.includes('stat') || lowerMessage.includes('analyse')) {
        return await this.handleStatisticsQuery(userId, message);
      }

      // Vacation query
      if (lowerMessage.includes('urlaub') || lowerMessage.includes('відпуст') || lowerMessage.includes('vacation')) {
        return await this.handleVacationQuery(userId);
      }

      // Sick leave query
      if (lowerMessage.includes('krank') || lowerMessage.includes('лікарня') || lowerMessage.includes('sick')) {
        return await this.handleSickLeaveQuery(userId);
      }

      // Tasks query
      if (lowerMessage.includes('aufgabe') || lowerMessage.includes('завдан') || lowerMessage.includes('task')) {
        return await this.handleTasksQuery(userId);
      }

      // Hours/schedule query
      if (lowerMessage.includes('stunden') || lowerMessage.includes('години') || lowerMessage.includes('zeitplan') || lowerMessage.includes('hours')) {
        return await this.handleScheduleQuery(userId);
      }

      // KNOWLEDGE BASE specific queries
      if (lowerMessage.includes('wie') || lowerMessage.includes('was ist') || lowerMessage.includes('erkläre')) {
        // Extract keywords for KB search
        const response = await this.generateAIResponse(message, userId);
        return response;
      }

      // COMPLEX MULTI-PART queries - Use AI for everything else
      return await this.generateAIResponse(message, userId);
    } catch (error) {
      logger.error('Error processing incoming message:', error);
      return 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Nachricht. Bitte versuchen Sie es erneut oder kontaktieren Sie den Administrator.';
    }
  }

  /**
   * Handle team-wide queries (admin only)
   */
  async handleTeamQuery(message) {
    try {
      const teamContext = await this.getTeamContext();
      if (!teamContext) {
        return 'Fehler beim Abrufen der Team-Daten.';
      }

      const { users, teamSchedule, taskStats } = teamContext;

      let response = `👥 **Team-Übersicht**\n\n`;
      response += `**Aktive Mitarbeiter:** ${users.length}\n\n`;

      // Work hours this week
      response += `**Arbeitsstunden diese Woche:**\n`;
      teamSchedule.forEach(s => {
        const user = users.find(u => u.id === s.user_id);
        if (user) {
          const quota = user.weekly_hours_quota;
          const status = s.total_hours < quota ? '📉' : s.total_hours > quota ? '📈' : '✅';
          response += `- ${s.user_name}: ${parseFloat(s.total_hours).toFixed(1)}h / ${quota}h ${status}\n`;
        }
      });

      // Task statistics
      response += `\n**Aufgaben-Status:**\n`;
      const tasksByUser = {};
      taskStats.forEach(t => {
        if (!tasksByUser[t.user_name]) {
          tasksByUser[t.user_name] = { todo: 0, in_progress: 0, review: 0, done: 0 };
        }
        tasksByUser[t.user_name][t.status] = parseInt(t.count);
      });

      Object.entries(tasksByUser).forEach(([userName, stats]) => {
        response += `- ${userName}: ${stats.in_progress} in Arbeit, ${stats.todo} offen, ${stats.done} erledigt\n`;
      });

      return response;
    } catch (error) {
      logger.error('Error handling team query:', error);
      return 'Fehler beim Abrufen der Team-Informationen.';
    }
  }

  /**
   * Handle statistics queries
   */
  async handleStatisticsQuery(userId, message) {
    try {
      const userContext = await this.getUserContext(userId);
      if (!userContext) {
        return 'Fehler beim Abrufen der Statistiken.';
      }

      const { tasks, events, workHistory } = userContext;

      let response = `📊 **Deine Statistiken**\n\n`;

      // Task statistics
      const taskStats = {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length
      };

      response += `**Aufgaben:**\n`;
      response += `- Gesamt: ${taskStats.total}\n`;
      response += `- In Arbeit: ${taskStats.inProgress}\n`;
      response += `- Zu erledigen: ${taskStats.todo}\n`;
      response += `- In Prüfung: ${taskStats.review}\n`;
      response += `- Erledigt: ${taskStats.done}\n`;
      if (taskStats.overdue > 0) {
        response += `- ⚠️ Überfällig: ${taskStats.overdue}\n`;
      }

      // Work hours trend
      response += `\n**Arbeitsstunden (letzte 4 Wochen):**\n`;
      workHistory.forEach(w => {
        response += `- KW ${this.getWeekNumber(new Date(w.week_start))}: ${parseFloat(w.total_hours).toFixed(1)}h\n`;
      });

      // Event statistics
      const eventTypes = {};
      events.forEach(e => {
        eventTypes[e.event_type] = (eventTypes[e.event_type] || 0) + 1;
      });

      response += `\n**Ereignisse (nächste 6 Monate):**\n`;
      Object.entries(eventTypes).forEach(([type, count]) => {
        response += `- ${type}: ${count}\n`;
      });

      return response;
    } catch (error) {
      logger.error('Error handling statistics query:', error);
      return 'Fehler beim Generieren der Statistiken.';
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
