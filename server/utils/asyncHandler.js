/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to properly catch errors
 */

const logger = require('./logger');

/**
 * Wraps async functions to catch errors and pass them to Express error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error with request context
      logger.error('Unhandled async error', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        body: req.body
      });

      // Pass error to Express error handler
      next(error);
    });
  };
};

/**
 * Wrap multiple middleware functions
 * @param {...Function} middlewares - Middleware functions to wrap
 * @returns {Array<Function>} Array of wrapped middleware
 */
const asyncMiddleware = (...middlewares) => {
  return middlewares.map(middleware => {
    // Only wrap if it's an async function
    if (middleware.constructor.name === 'AsyncFunction') {
      return asyncHandler(middleware);
    }
    return middleware;
  });
};

/**
 * Create error response with consistent format
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Error response object
 */
const createError = (statusCode, message, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

/**
 * Handle validation errors consistently
 * @param {Object} error - Joi validation error
 * @returns {Object} Formatted validation error
 */
const handleValidationError = (error) => {
  const errors = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message
  }));

  return createError(400, 'Validierung fehlgeschlagen', errors);
};

/**
 * Handle database errors
 * @param {Object} error - Database error
 * @returns {Object} Formatted database error
 */
const handleDatabaseError = (error) => {
  // PostgreSQL unique constraint violation
  if (error.code === '23505') {
    return createError(409, 'Eintrag existiert bereits');
  }

  // Foreign key violation
  if (error.code === '23503') {
    return createError(400, 'Referenzierter Eintrag existiert nicht');
  }

  // Default database error
  return createError(500, 'Datenbankfehler aufgetreten');
};

/**
 * Global error handler middleware
 * @param {Error} error - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
const errorHandler = (error, req, res, next) => {
  // Set default status code if not set
  const statusCode = error.statusCode || 500;

  // Log error details
  logger.error('Request failed', {
    statusCode,
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id
  });

  // Send error response
  res.status(statusCode).json({
    error: error.message || 'Ein unerwarteter Fehler ist aufgetreten',
    details: error.details || undefined,
    requestId: req.id // If using request ID middleware
  });
};

module.exports = {
  asyncHandler,
  asyncMiddleware,
  createError,
  handleValidationError,
  handleDatabaseError,
  errorHandler
};