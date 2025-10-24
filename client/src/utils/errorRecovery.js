/**
 * Error Recovery System
 * Handles errors gracefully with automatic recovery strategies
 */

import { showError, showWarning, showInfo } from './toast';

class ErrorRecoveryManager {
  constructor() {
    this.errorHandlers = new Map();
    this.retryStrategies = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.circuitBreakers = new Map();
  }

  /**
   * Register error handler for specific error type
   */
  registerHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  /**
   * Register retry strategy
   */
  registerRetryStrategy(operation, strategy) {
    this.retryStrategies.set(operation, strategy);
  }

  /**
   * Handle error with appropriate recovery strategy
   */
  async handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);

    // Record error
    this.recordError(errorInfo);

    // Check circuit breaker
    if (this.isCircuitOpen(errorInfo.type)) {
      showError('Service vorübergehend nicht verfügbar. Bitte später versuchen.');
      return { recovered: false, reason: 'circuit-breaker-open' };
    }

    // Try registered handler first
    const handler = this.errorHandlers.get(errorInfo.type);
    if (handler) {
      try {
        const result = await handler(errorInfo, context);
        if (result.recovered) {
          showInfo('Problem wurde automatisch behoben');
          this.resetCircuitBreaker(errorInfo.type);
          return result;
        }
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Try generic recovery strategies
    const recovery = await this.tryRecoveryStrategies(errorInfo, context);

    if (!recovery.recovered) {
      this.tripCircuitBreaker(errorInfo.type);
      this.showUserFriendlyError(errorInfo);
    } else {
      this.resetCircuitBreaker(errorInfo.type);
    }

    return recovery;
  }

  /**
   * Analyze error to determine type and severity
   */
  analyzeError(error, context) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      type: 'unknown',
      severity: 'medium',
      recoverable: true
    };

    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      errorInfo.type = 'network';
      errorInfo.severity = 'high';
      errorInfo.recoverable = true;
    }

    // Authentication errors
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorInfo.type = 'authentication';
      errorInfo.severity = 'critical';
      errorInfo.recoverable = false;
    }

    // Permission errors
    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorInfo.type = 'permission';
      errorInfo.severity = 'high';
      errorInfo.recoverable = false;
    }

    // Validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      errorInfo.type = 'validation';
      errorInfo.severity = 'low';
      errorInfo.recoverable = true;
    }

    // Database errors
    if (error.message?.includes('database') || error.message?.includes('SQL')) {
      errorInfo.type = 'database';
      errorInfo.severity = 'critical';
      errorInfo.recoverable = false;
    }

    // Timeout errors
    if (error.message?.includes('timeout')) {
      errorInfo.type = 'timeout';
      errorInfo.severity = 'medium';
      errorInfo.recoverable = true;
    }

    return errorInfo;
  }

  /**
   * Try various recovery strategies
   */
  async tryRecoveryStrategies(errorInfo, context) {
    const strategies = [
      { name: 'retry', fn: this.retryStrategy.bind(this) },
      { name: 'fallback', fn: this.fallbackStrategy.bind(this) },
      { name: 'cache', fn: this.cacheStrategy.bind(this) },
      { name: 'degraded', fn: this.degradedModeStrategy.bind(this) }
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy.fn(errorInfo, context);
        if (result.recovered) {
          console.log(`✅ Recovered using ${strategy.name} strategy`);
          return result;
        }
      } catch (strategyError) {
        console.warn(`Strategy ${strategy.name} failed:`, strategyError);
      }
    }

    return { recovered: false, reason: 'all-strategies-failed' };
  }

  /**
   * Retry strategy with exponential backoff
   */
  async retryStrategy(errorInfo, context) {
    if (!errorInfo.recoverable || errorInfo.type === 'validation') {
      return { recovered: false, reason: 'not-retryable' };
    }

    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const delay = baseDelay * Math.pow(2, attempt - 1);

      console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        if (context.retryFn && typeof context.retryFn === 'function') {
          await context.retryFn();
          return { recovered: true, strategy: 'retry', attempts: attempt };
        }
      } catch (retryError) {
        console.warn(`Retry attempt ${attempt} failed:`, retryError);
        if (attempt === maxRetries) {
          return { recovered: false, reason: 'max-retries-exceeded' };
        }
      }
    }

    return { recovered: false, reason: 'retry-failed' };
  }

  /**
   * Fallback to alternative data source or method
   */
  async fallbackStrategy(errorInfo, context) {
    if (context.fallbackFn && typeof context.fallbackFn === 'function') {
      try {
        const result = await context.fallbackFn();
        showWarning('Verwende alternative Datenquelle');
        return { recovered: true, strategy: 'fallback', data: result };
      } catch (fallbackError) {
        console.warn('Fallback failed:', fallbackError);
      }
    }

    return { recovered: false, reason: 'no-fallback-available' };
  }

  /**
   * Use cached data if available
   */
  async cacheStrategy(errorInfo, context) {
    if (errorInfo.type !== 'network' && errorInfo.type !== 'timeout') {
      return { recovered: false, reason: 'cache-not-applicable' };
    }

    if (context.cacheKey) {
      try {
        const cachedData = localStorage.getItem(context.cacheKey);
        if (cachedData) {
          showInfo('Verwende zwischengespeicherte Daten');
          return {
            recovered: true,
            strategy: 'cache',
            data: JSON.parse(cachedData),
            stale: true
          };
        }
      } catch (cacheError) {
        console.warn('Cache read failed:', cacheError);
      }
    }

    return { recovered: false, reason: 'no-cache-available' };
  }

  /**
   * Enter degraded mode with limited functionality
   */
  async degradedModeStrategy(errorInfo, context) {
    if (context.degradedMode && typeof context.degradedMode === 'function') {
      try {
        const result = await context.degradedMode();
        showWarning('Eingeschränkter Modus aktiv');
        return { recovered: true, strategy: 'degraded', data: result };
      } catch (degradedError) {
        console.warn('Degraded mode failed:', degradedError);
      }
    }

    return { recovered: false, reason: 'degraded-mode-not-available' };
  }

  /**
   * Circuit breaker pattern
   */
  tripCircuitBreaker(errorType) {
    const breaker = this.circuitBreakers.get(errorType) || {
      failures: 0,
      lastFailure: null,
      state: 'closed'
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();

    // Open circuit after 5 failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      breaker.opensAt = Date.now();
      console.warn(`⚡ Circuit breaker opened for ${errorType}`);

      // Auto-close after 1 minute
      setTimeout(() => {
        breaker.state = 'half-open';
        console.log(`🔄 Circuit breaker half-open for ${errorType}`);
      }, 60000);
    }

    this.circuitBreakers.set(errorType, breaker);
  }

  /**
   * Reset circuit breaker on successful operation
   */
  resetCircuitBreaker(errorType) {
    const breaker = this.circuitBreakers.get(errorType);
    if (breaker) {
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
        console.log(`✅ Circuit breaker closed for ${errorType}`);
      } else {
        breaker.failures = Math.max(0, breaker.failures - 1);
      }
      this.circuitBreakers.set(errorType, breaker);
    }
  }

  /**
   * Check if circuit is open
   */
  isCircuitOpen(errorType) {
    const breaker = this.circuitBreakers.get(errorType);
    return breaker && breaker.state === 'open';
  }

  /**
   * Record error in history
   */
  recordError(errorInfo) {
    this.errorHistory.push(errorInfo);

    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error recorded:', errorInfo);
    }
  }

  /**
   * Show user-friendly error message
   */
  showUserFriendlyError(errorInfo) {
    const messages = {
      network: 'Netzwerkfehler. Bitte Verbindung prüfen.',
      authentication: 'Sitzung abgelaufen. Bitte neu anmelden.',
      permission: 'Keine Berechtigung für diese Aktion.',
      validation: 'Eingabedaten sind ungültig.',
      database: 'Datenbankfehler. Bitte Administrator kontaktieren.',
      timeout: 'Zeitüberschreitung. Bitte erneut versuchen.',
      unknown: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.'
    };

    const message = messages[errorInfo.type] || messages.unknown;

    if (errorInfo.severity === 'critical') {
      showError(message);
    } else if (errorInfo.severity === 'high') {
      showWarning(message);
    } else {
      showInfo(message);
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      bySeverity: {},
      recent: this.errorHistory.slice(-10)
    };

    this.errorHistory.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
  }

  /**
   * Export error log for debugging
   */
  exportErrorLog() {
    const log = {
      exportedAt: new Date().toISOString(),
      errors: this.errorHistory,
      statistics: this.getStatistics(),
      circuitBreakers: Array.from(this.circuitBreakers.entries())
    };

    return JSON.stringify(log, null, 2);
  }
}

// Singleton instance
const errorRecovery = new ErrorRecoveryManager();

// Register default handlers
errorRecovery.registerHandler('authentication', async (errorInfo, context) => {
  // Redirect to login
  if (window.location.pathname !== '/login') {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return { recovered: true, action: 'redirect-to-login' };
  }
  return { recovered: false };
});

errorRecovery.registerHandler('network', async (errorInfo, context) => {
  // Check if online
  if (!navigator.onLine) {
    showWarning('Offline-Modus aktiv');
    return { recovered: true, action: 'offline-mode' };
  }
  return { recovered: false };
});

export default errorRecovery;
