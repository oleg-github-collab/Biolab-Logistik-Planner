const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const createError = {
  badRequest: (message = 'Bad Request') => new ApiError(400, message),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, message),
  forbidden: (message = 'Forbidden') => new ApiError(403, message),
  notFound: (message = 'Not Found') => new ApiError(404, message),
  conflict: (message = 'Conflict') => new ApiError(409, message),
  validation: (message = 'Validation Error') => new ApiError(422, message),
  tooManyRequests: (message = 'Too Many Requests') => new ApiError(429, message),
  internal: (message = 'Internal Server Error') => new ApiError(500, message, false),
  service: (message = 'Service Unavailable') => new ApiError(503, message)
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const handleDatabaseError = (error) => {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return createError.conflict('Resource already exists');
  }
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return createError.badRequest('Invalid reference to related resource');
  }
  if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return createError.badRequest('Required field is missing');
  }
  if (error.code === 'SQLITE_BUSY') {
    return createError.service('Database is busy, please try again');
  }
  return createError.internal('Database operation failed');
};

const handleValidationError = (error) => {
  const errors = error.details?.map(detail => ({
    field: detail.path?.join('.'),
    message: detail.message
  })) || [];

  return {
    ...createError.validation('Validation failed'),
    errors
  };
};

const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return createError.unauthorized('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return createError.unauthorized('Token expired');
  }
  return createError.unauthorized('Authentication failed');
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  logger.error('Error occurred', {
    error: {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      isOperational: err.isOperational
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    }
  });

  // Handle specific error types
  if (err.code?.startsWith('SQLITE_')) {
    error = handleDatabaseError(err);
  } else if (err.name === 'ValidationError' || err.isJoi) {
    error = handleValidationError(err);
  } else if (err.name?.includes('JWT') || err.name?.includes('Token')) {
    error = handleJWTError(err);
  } else if (!err.isOperational) {
    error = createError.internal('Something went wrong');
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const response = {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode || 500,
      timestamp: error.timestamp || new Date().toISOString(),
      ...(error.errors && { errors: error.errors }),
      ...(isDevelopment && {
        stack: error.stack,
        originalError: err.message
      })
    }
  };

  res.status(error.statusCode || 500).json(response);
};

const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;

  logger.warn('404 - Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: { message }
  });
};

const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }

      logger.info('Server closed successfully');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
  });
};

module.exports = {
  ApiError,
  createError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  gracefulShutdown,
  handleDatabaseError,
  handleValidationError,
  handleJWTError
};