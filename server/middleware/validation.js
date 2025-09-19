const { createError } = require('./errorHandler');
const logger = require('../utils/logger');

const validate = {
  // User validation
  registerUser: (req, res, next) => {
    const { name, email, password, role } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    req.body.name = name?.trim() || '';

    if (!email || !isValidEmail(email)) {
      errors.push('Valid email address is required');
    }

    req.body.email = email?.trim() || '';

    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (role) {
      const normalizedRole = String(role).toLowerCase();

      if (!['admin', 'user', 'employee'].includes(normalizedRole)) {
        errors.push('Role must be either admin or employee');
      } else {
        req.body.role = normalizedRole === 'user' ? 'employee' : normalizedRole;
      }
    } else {
      req.body.role = 'employee';
    }

    if (errors.length > 0) {
      logger.warn('Validation failed for user registration', {
        errors,
        email,
        ip: req.ip
      });
      throw createError.validation(errors.join(', '));
    }

    next();
  },

  loginUser: (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    if (!email || !isValidEmail(email)) {
      errors.push('Valid email address is required');
    }

    if (!password) {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      logger.security('Invalid login attempt', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw createError.validation(errors.join(', '));
    }

    next();
  },

  // Schedule validation
  scheduleEvent: (req, res, next) => {
    const { title, start_time, end_time, day_of_week } = req.body;
    const errors = [];

    if (!title || title.trim().length < 1) {
      errors.push('Event title is required');
    }

    if (!start_time || !isValidTime(start_time)) {
      errors.push('Valid start time is required (HH:MM format)');
    }

    if (!end_time || !isValidTime(end_time)) {
      errors.push('Valid end time is required (HH:MM format)');
    }

    if (start_time && end_time && start_time >= end_time) {
      errors.push('End time must be after start time');
    }

    if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
      errors.push('Valid day of week is required (0-6)');
    }

    if (errors.length > 0) {
      logger.warn('Schedule validation failed', {
        errors,
        userId: req.user?.id
      });
      throw createError.validation(errors.join(', '));
    }

    next();
  },

  // Message validation
  sendMessage: (req, res, next) => {
    const errors = [];

    const rawMessage = typeof req.body.message === 'string'
      ? req.body.message
      : typeof req.body.content === 'string'
        ? req.body.content
        : '';
    const trimmedMessage = rawMessage.trim();

    if (!trimmedMessage) {
      errors.push('Message content is required');
    } else if (trimmedMessage.length > 5000) {
      errors.push('Message content cannot exceed 5000 characters');
    }

    const normalizedIsGroup = Boolean(req.body.isGroup ?? req.body.is_group ?? false);
    const rawReceiver = req.body.receiverId ?? req.body.receiver_id ?? req.body.recipient_id;
    let receiverId = null;

    if (!normalizedIsGroup) {
      const numericReceiver = Number(rawReceiver);
      if (!Number.isInteger(numericReceiver) || numericReceiver <= 0) {
        errors.push('Valid receiver ID is required');
      } else {
        receiverId = numericReceiver;
      }
    }

    if (errors.length > 0) {
      logger.warn('Message validation failed', {
        errors,
        userId: req.user?.id,
        receiverId: rawReceiver,
        isGroup: normalizedIsGroup
      });
      throw createError.validation(errors.join(', '));
    }

    req.body.message = trimmedMessage;
    req.body.isGroup = normalizedIsGroup;

    if (!normalizedIsGroup) {
      req.body.receiverId = receiverId;
    } else {
      req.body.receiverId = null;
    }

    next();
  },

  // Waste management validation
  wasteEntry: (req, res, next) => {
    const { waste_type, amount, unit, disposal_date } = req.body;
    const errors = [];

    if (!waste_type || waste_type.trim().length < 1) {
      errors.push('Waste type is required');
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      errors.push('Valid amount greater than 0 is required');
    }

    if (!unit || unit.trim().length < 1) {
      errors.push('Unit of measurement is required');
    }

    if (!disposal_date || !isValidDate(disposal_date)) {
      errors.push('Valid disposal date is required');
    }

    if (errors.length > 0) {
      logger.warn('Waste entry validation failed', {
        errors,
        userId: req.user?.id
      });
      throw createError.validation(errors.join(', '));
    }

    next();
  },

  // Task validation
  createTask: (req, res, next) => {
    const { title, description, priority, due_date } = req.body;
    const errors = [];

    if (!title || title.trim().length < 1) {
      errors.push('Task title is required');
    }

    if (title && title.length > 200) {
      errors.push('Task title cannot exceed 200 characters');
    }

    if (description && description.length > 1000) {
      errors.push('Task description cannot exceed 1000 characters');
    }

    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      errors.push('Priority must be one of: low, medium, high, urgent');
    }

    if (due_date && !isValidDate(due_date)) {
      errors.push('Valid due date is required if provided');
    }

    if (errors.length > 0) {
      logger.warn('Task validation failed', {
        errors,
        userId: req.user?.id
      });
      throw createError.validation(errors.join(', '));
    }

    next();
  },

  // Common validations
  objectId: (paramName) => (req, res, next) => {
    const id = req.params[paramName];

    if (!id || isNaN(id) || parseInt(id) < 1) {
      logger.warn('Invalid ID parameter', {
        paramName,
        value: id,
        userId: req.user?.id
      });
      throw createError.badRequest(`Invalid ${paramName} parameter`);
    }

    req.params[paramName] = parseInt(id);
    next();
  },

  pagination: (req, res, next) => {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      throw createError.badRequest('Page must be a positive integer');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw createError.badRequest('Limit must be between 1 and 100');
    }

    req.pagination = {
      page: pageNum,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    };

    next();
  }
};

// Helper functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidTime(time) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

module.exports = validate;