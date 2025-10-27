/**
 * Application Constants
 * Centralized configuration for all magic numbers and strings
 */

module.exports = {
  // Security
  JWT: {
    EXPIRES_IN: '7d',
    REFRESH_EXPIRES_IN: '30d',
    ALGORITHM: 'HS256'
  },

  // Password Policy
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
    BCRYPT_ROUNDS: 12
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    LOGIN_MAX: 5,
    REGISTER_MAX: 3,
    API_MAX: 1000
  },

  // Database
  DATABASE: {
    POOL_SIZE: process.env.NODE_ENV === 'production' ? 5 : 20,
    IDLE_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
  },

  // WebSocket
  WEBSOCKET: {
    HEARTBEAT_INTERVAL: 30000,
    HEARTBEAT_TIMEOUT: 60000,
    RECONNECT_INTERVAL: 5000,
    MAX_RECONNECT_ATTEMPTS: 10,
    MESSAGE_QUEUE_SIZE: 100
  },

  // Redis
  REDIS: {
    ONLINE_TTL: 300, // 5 minutes
    CACHE_TTL: 3600, // 1 hour
    SESSION_TTL: 86400, // 24 hours
    SCAN_COUNT: 100 // For SCAN instead of KEYS
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm'
    ],
    UPLOAD_DIR: './uploads'
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // Cache Headers
  CACHE: {
    NO_CACHE: 'no-cache, no-store, must-revalidate',
    STATIC_ASSETS: 'public, max-age=31536000', // 1 year
    API_CACHE: 'private, max-age=0'
  },

  // CORS Whitelist
  CORS_WHITELIST: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://biolab-logistik-planner.railway.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),

  // Log Levels
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    HTTP: 3,
    VERBOSE: 4,
    DEBUG: 5,
    SILLY: 6
  },

  // Task Status
  TASK_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    OVERDUE: 'overdue'
  },

  // User Roles
  USER_ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    EMPLOYEE: 'employee'
  },

  // Event Types
  EVENT_TYPES: {
    MEETING: 'meeting',
    TASK: 'task',
    REMINDER: 'reminder',
    HOLIDAY: 'holiday',
    ABSENCE: 'absence'
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    MESSAGE: 'message',
    TASK: 'task'
  },

  // Response Messages
  MESSAGES: {
    SUCCESS: {
      CREATED: 'Erfolgreich erstellt',
      UPDATED: 'Erfolgreich aktualisiert',
      DELETED: 'Erfolgreich gelöscht',
      LOGGED_IN: 'Erfolgreich angemeldet',
      LOGGED_OUT: 'Erfolgreich abgemeldet'
    },
    ERROR: {
      UNAUTHORIZED: 'Nicht autorisiert',
      FORBIDDEN: 'Zugriff verweigert',
      NOT_FOUND: 'Nicht gefunden',
      VALIDATION_FAILED: 'Validierung fehlgeschlagen',
      SERVER_ERROR: 'Interner Serverfehler',
      RATE_LIMIT: 'Zu viele Anfragen. Bitte später versuchen.',
      INVALID_CREDENTIALS: 'Ungültige Anmeldedaten',
      TOKEN_EXPIRED: 'Token abgelaufen',
      TOKEN_INVALID: 'Ungültiger Token',
      WEAK_PASSWORD: 'Passwort erfüllt nicht die Sicherheitsanforderungen',
      EMAIL_EXISTS: 'E-Mail-Adresse bereits registriert',
      DATABASE_ERROR: 'Datenbankfehler',
      FILE_TOO_LARGE: 'Datei ist zu groß',
      INVALID_FILE_TYPE: 'Ungültiger Dateityp'
    }
  }
};