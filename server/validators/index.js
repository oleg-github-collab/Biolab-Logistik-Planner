/**
 * Universal Input Validation using Joi
 * Prevents SQL injection, XSS, and ensures data integrity
 */

const Joi = require('joi');
const { PASSWORD, UPLOAD, PAGINATION } = require('../config/constants');

// Custom password validator
const passwordValidator = (value, helpers) => {
  if (value.length < PASSWORD.MIN_LENGTH) {
    return helpers.error('password.tooShort');
  }
  if (value.length > PASSWORD.MAX_LENGTH) {
    return helpers.error('password.tooLong');
  }
  if (PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(value)) {
    return helpers.error('password.noUppercase');
  }
  if (PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(value)) {
    return helpers.error('password.noLowercase');
  }
  if (PASSWORD.REQUIRE_NUMBER && !/\d/.test(value)) {
    return helpers.error('password.noNumber');
  }
  if (PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
    return helpers.error('password.noSpecial');
  }
  return value;
};

// Reusable schemas
const schemas = {
  // User schemas
  register: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .pattern(/^[a-zA-ZäöüÄÖÜß\s\-']+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name darf nur Buchstaben, Leerzeichen und Bindestriche enthalten'
      }),
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .max(255)
      .required()
      .messages({
        'string.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
      }),
    password: Joi.string()
      .custom(passwordValidator)
      .required()
      .messages({
        'password.tooShort': `Passwort muss mindestens ${PASSWORD.MIN_LENGTH} Zeichen lang sein`,
        'password.tooLong': `Passwort darf maximal ${PASSWORD.MAX_LENGTH} Zeichen lang sein`,
        'password.noUppercase': 'Passwort muss mindestens einen Großbuchstaben enthalten',
        'password.noLowercase': 'Passwort muss mindestens einen Kleinbuchstaben enthalten',
        'password.noNumber': 'Passwort muss mindestens eine Zahl enthalten',
        'password.noSpecial': 'Passwort muss mindestens ein Sonderzeichen enthalten'
      }),
    role: Joi.string()
      .valid('superadmin', 'admin', 'employee')
      .default('employee'),
    employment_type: Joi.string()
      .valid('Vollzeit', 'Teilzeit', 'Werkstudent')
      .default('Vollzeit'),
    position_description: Joi.string()
      .max(500)
      .trim()
      .allow('', null),
    weekly_hours_quota: Joi.number()
      .min(1)
      .max(80)
      .default(40)
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required(),
    password: Joi.string()
      .required()
  }),

  updateProfile: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .pattern(/^[a-zA-ZäöüÄÖÜß\s\-']+$/),
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .max(255),
    employment_type: Joi.string()
      .valid('Vollzeit', 'Teilzeit', 'Werkstudent'),
    position_description: Joi.string()
      .max(500)
      .trim()
      .allow('', null),
    weekly_hours_quota: Joi.number()
      .min(1)
      .max(80),
    phone: Joi.string()
      .pattern(/^[\d\s\-\+\(\)]+$/)
      .allow('', null),
    address: Joi.string()
      .max(500)
      .allow('', null)
  }).min(1),

  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required(),
    newPassword: Joi.string()
      .custom(passwordValidator)
      .required()
      .invalid(Joi.ref('currentPassword'))
      .messages({
        'any.invalid': 'Neues Passwort muss sich vom aktuellen unterscheiden'
      })
  }),

  completeFirstLogin: Joi.object({
    weekly_hours_quota: Joi.number()
      .min(1)
      .max(80)
      .required()
      .messages({
        'number.min': 'Wochenstunden müssen mindestens 1 sein',
        'number.max': 'Wochenstunden dürfen maximal 80 sein',
        'any.required': 'Wochenstunden sind erforderlich'
      })
  }),

  // Message schemas
  sendMessage: Joi.object({
    recipientId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': 'Empfänger ist erforderlich',
        'number.positive': 'Ungültige Empfänger-ID'
      }),
    content: Joi.string()
      .min(1)
      .max(5000)
      .trim()
      .when('gif', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required()
      }),
    gif: Joi.string()
      .uri()
      .optional()
  }).or('content', 'gif').messages({
    'object.missing': 'Nachrichteninhalt oder GIF ist erforderlich'
  }),

  startConversation: Joi.object({
    receiver_id: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': 'Empfänger-ID ist erforderlich'
      })
  }),

  typingIndicator: Joi.object({
    recipientId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': 'Empfänger ist erforderlich'
      }),
    isTyping: Joi.boolean()
      .required()
  }),

  // Task schemas
  createTask: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .trim()
      .required()
      .messages({
        'any.required': 'Title is required',
        'string.empty': 'Title is required'
      }),
    description: Joi.string()
      .max(2000)
      .trim()
      .allow('', null),
    status: Joi.string()
      .valid('todo', 'inprogress', 'review', 'done')
      .default('todo')
      .messages({
        'any.only': 'Invalid status'
      }),
    priority: Joi.string()
      .valid('low', 'medium', 'high')
      .default('medium')
      .messages({
        'any.only': 'Invalid priority'
      }),
    assigneeId: Joi.number()
      .integer()
      .positive()
      .allow(null),
    dueDate: Joi.date()
      .iso()
      .allow(null),
    tags: Joi.array()
      .items(Joi.string().max(30))
      .max(10)
      .default([])
  }),

  updateTask: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .trim(),
    description: Joi.string()
      .max(2000)
      .trim()
      .allow('', null),
    status: Joi.string()
      .valid('todo', 'inprogress', 'review', 'done'),
    priority: Joi.string()
      .valid('low', 'medium', 'high'),
    assigneeId: Joi.number()
      .integer()
      .positive()
      .allow(null),
    dueDate: Joi.date()
      .iso()
      .allow(null),
    tags: Joi.array()
      .items(Joi.string().max(30))
      .max(10)
  }).min(1),

  // Schedule schemas
  createEvent: Joi.object({
    title: Joi.string()
      .min(3)
      .max(200)
      .trim()
      .required(),
    description: Joi.string()
      .max(2000)
      .trim()
      .allow('', null),
    event_date: Joi.date()
      .iso()
      .required(),
    start_time: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required()
      .messages({
        'string.pattern.base': 'Zeit muss im Format HH:MM sein'
      }),
    end_time: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    event_type: Joi.string()
      .valid('meeting', 'task', 'reminder', 'holiday', 'absence')
      .default('meeting'),
    priority: Joi.string()
      .valid('low', 'medium', 'high')
      .default('medium'),
    location: Joi.string()
      .max(200)
      .trim()
      .allow('', null),
    attendees: Joi.array()
      .items(Joi.number().integer().positive())
      .max(50)
  }),

  // Waste management schemas
  createWasteItem: Joi.object({
    name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required(),
    category: Joi.string()
      .valid('hazardous', 'biological', 'chemical', 'recyclable', 'general')
      .required(),
    quantity: Joi.number()
      .positive()
      .max(10000)
      .required(),
    unit: Joi.string()
      .valid('kg', 'l', 'pieces', 'containers')
      .required(),
    location: Joi.string()
      .max(200)
      .trim(),
    disposal_method: Joi.string()
      .max(500)
      .trim(),
    disposal_date: Joi.date()
      .iso()
      .min('now')
      .allow(null),
    hazard_level: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .when('category', {
        is: 'hazardous',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
    notes: Joi.string()
      .max(1000)
      .trim()
      .allow('', null)
  }),

  // Query schemas
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(PAGINATION.DEFAULT_PAGE),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(PAGINATION.MAX_LIMIT)
      .default(PAGINATION.DEFAULT_LIMIT),
    sort: Joi.string()
      .valid('asc', 'desc')
      .default('desc'),
    sortBy: Joi.string()
      .max(50)
      .pattern(/^[a-zA-Z_]+$/)
      .default('created_at')
  }),

  dateRange: Joi.object({
    startDate: Joi.date()
      .iso(),
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .messages({
        'date.min': 'Enddatum muss nach Startdatum liegen'
      })
  }),

  search: Joi.object({
    query: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .pattern(/^[a-zA-Z0-9äöüÄÖÜß\s\-\.]+$/)
      .messages({
        'string.pattern.base': 'Suchbegriff enthält ungültige Zeichen'
      }),
    fields: Joi.array()
      .items(Joi.string().pattern(/^[a-zA-Z_]+$/))
      .max(10)
  }),

  // File upload schema
  fileUpload: Joi.object({
    file: Joi.object({
      mimetype: Joi.string()
        .valid(...UPLOAD.ALLOWED_MIME_TYPES)
        .required()
        .messages({
          'any.only': 'Dateityp nicht erlaubt. Erlaubte Typen: Bilder (JPEG, PNG, GIF, WebP) und Audio (MP3, WAV, OGG, WebM)'
        }),
      size: Joi.number()
        .max(UPLOAD.MAX_FILE_SIZE)
        .required()
        .messages({
          'number.max': `Datei darf maximal ${UPLOAD.MAX_FILE_SIZE / (1024 * 1024)}MB groß sein`
        })
    }).required()
  }),

  // ID parameter
  id: Joi.object({
    id: Joi.number()
      .integer()
      .positive()
      .required()
  }),

  // UUID parameter
  uuid: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'Ungültige ID'
      })
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(
      req.body || req.query || req.params,
      {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      }
    );

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validierung fehlgeschlagen',
        details: errors
      });
    }

    // Replace request data with sanitized values
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = value;
    } else if (req.query && Object.keys(req.query).length > 0) {
      req.query = value;
    } else if (req.params && Object.keys(req.params).length > 0) {
      req.params = value;
    }

    next();
  };
};

// SQL injection prevention helper
const sanitizeSQL = (input) => {
  if (typeof input !== 'string') return input;

  // Remove SQL keywords and special characters
  return input
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|ONCLICK)\b)/gi, '')
    .replace(/[;'"\\]/g, '')
    .trim();
};

// XSS prevention helper
const sanitizeHTML = (input) => {
  if (typeof input !== 'string') return input;

  // Escape HTML special characters
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

module.exports = {
  schemas,
  validate,
  sanitizeSQL,
  sanitizeHTML
};