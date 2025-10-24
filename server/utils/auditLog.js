/**
 * Audit Log System
 * Tracks critical operations for security and compliance
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class AuditLogger {
  constructor() {
    this.auditDir = path.join(__dirname, '../logs/audit');
    this.ensureAuditDirectory();
    this.buffer = [];
    this.bufferSize = 10;
    this.flushInterval = 5000; // 5 seconds
    this.startAutoFlush();
  }

  /**
   * Ensure audit directory exists
   */
  ensureAuditDirectory() {
    try {
      if (!fs.existsSync(this.auditDir)) {
        fs.mkdirSync(this.auditDir, { recursive: true });
        console.log(`Audit directory created: ${this.auditDir}`);
      }
    } catch (error) {
      console.error('Failed to create audit directory:', error);
      // Fallback to temp directory
      this.auditDir = require('os').tmpdir();
      console.log(`Using fallback audit directory: ${this.auditDir}`);
    }
  }

  /**
   * Log audit event
   */
  log(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      ...event
    };

    // Add to buffer
    this.buffer.push(auditEntry);

    // Immediate flush for critical events
    if (event.severity === 'critical') {
      this.flush();
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }

    return auditEntry;
  }

  /**
   * Log authentication event
   */
  logAuth(action, userId, email, details = {}) {
    return this.log({
      category: 'authentication',
      action,
      userId,
      email,
      severity: action.includes('failed') ? 'high' : 'medium',
      ...details
    });
  }

  /**
   * Log authorization event
   */
  logAuthz(action, userId, resource, allowed, reason = null) {
    return this.log({
      category: 'authorization',
      action,
      userId,
      resource,
      allowed,
      reason,
      severity: allowed ? 'low' : 'medium'
    });
  }

  /**
   * Log data modification
   */
  logDataChange(action, userId, entityType, entityId, changes = {}) {
    return this.log({
      category: 'data_modification',
      action,
      userId,
      entityType,
      entityId,
      changes,
      severity: action === 'delete' ? 'high' : 'medium'
    });
  }

  /**
   * Log system event
   */
  logSystem(action, details = {}) {
    return this.log({
      category: 'system',
      action,
      ...details,
      severity: details.severity || 'low'
    });
  }

  /**
   * Log security event
   */
  logSecurity(action, userId, details = {}) {
    return this.log({
      category: 'security',
      action,
      userId,
      severity: 'critical',
      ...details
    });
  }

  /**
   * Flush buffer to file
   */
  flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = path.join(this.auditDir, `audit-${date}.jsonl`);

      const lines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

      fs.appendFile(filename, lines, (err) => {
        if (err) {
          console.error('Failed to write audit log:', err);
          // Don't re-add to buffer to prevent memory leak in production
          // Just log to console as fallback
          console.log('AUDIT LOG (fallback):', JSON.stringify(entries));
        }
      });
    } catch (error) {
      console.error('Failed to flush audit buffer:', error);
      // Fallback logging
      console.log('AUDIT LOG (fallback):', JSON.stringify(entries));
    }
  }

  /**
   * Start auto-flush timer
   */
  startAutoFlush() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Query audit logs
   */
  async query(filters = {}) {
    try {
      const { startDate, endDate, category, userId, action, limit = 100 } = filters;

      const results = [];
      const files = await this.getAuditFiles(startDate, endDate);

      for (const file of files) {
        try {
          if (!fs.existsSync(file)) continue;

          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);

              // Apply filters
              if (category && entry.category !== category) continue;
              if (userId && entry.userId !== userId) continue;
              if (action && entry.action !== action) continue;

              results.push(entry);

              if (results.length >= limit) {
                return results;
              }
            } catch (err) {
              console.warn('Failed to parse audit log line:', err.message);
            }
          }
        } catch (err) {
          console.error('Failed to read audit file:', file, err.message);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit files for date range
   */
  async getAuditFiles(startDate, endDate) {
    try {
      if (!fs.existsSync(this.auditDir)) {
        console.warn('Audit directory does not exist:', this.auditDir);
        return [];
      }

      const files = fs.readdirSync(this.auditDir);

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();

      return files
        .filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'))
        .filter(file => {
          try {
            const dateStr = file.replace('audit-', '').replace('.jsonl', '');
            const fileDate = new Date(dateStr);
            return fileDate >= start && fileDate <= end;
          } catch (err) {
            console.warn('Failed to parse audit file date:', file);
            return false;
          }
        })
        .map(file => path.join(this.auditDir, file))
        .sort();
    } catch (error) {
      console.error('Failed to get audit files:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.query({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 10000
    });

    const stats = {
      total: logs.length,
      byCategory: {},
      bySeverity: {},
      byAction: {},
      topUsers: {},
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days
      }
    };

    logs.forEach(log => {
      // By category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;

      // By severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;

      // By action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // By user
      if (log.userId) {
        stats.topUsers[log.userId] = (stats.topUsers[log.userId] || 0) + 1;
      }
    });

    // Sort top users
    stats.topUsers = Object.entries(stats.topUsers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

    return stats;
  }

  /**
   * Cleanup old audit logs
   */
  async cleanup(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = fs.readdirSync(this.auditDir);
    let deletedCount = 0;

    files.forEach(file => {
      if (!file.startsWith('audit-') || !file.endsWith('.jsonl')) {
        return;
      }

      const dateStr = file.replace('audit-', '').replace('.jsonl', '');
      const fileDate = new Date(dateStr);

      if (fileDate < cutoffDate) {
        const filePath = path.join(this.auditDir, file);
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info(`Deleted old audit log: ${file}`);
      }
    });

    return deletedCount;
  }

  /**
   * Export audit logs for analysis
   */
  async export(filters = {}, format = 'json') {
    const logs = await this.query(filters);

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    if (format === 'csv') {
      if (logs.length === 0) {
        return '';
      }

      const headers = Object.keys(logs[0]).join(',');
      const rows = logs.map(log =>
        Object.values(log).map(val =>
          typeof val === 'object' ? JSON.stringify(val) : val
        ).join(',')
      );

      return [headers, ...rows].join('\n');
    }

    throw new Error(`Unsupported format: ${format}`);
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

// Graceful shutdown - flush on exit
process.on('SIGTERM', () => {
  auditLogger.flush();
});

process.on('SIGINT', () => {
  auditLogger.flush();
});

module.exports = auditLogger;
