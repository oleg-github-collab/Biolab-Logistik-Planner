const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

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
  internal: (message = 'Internal Server Error') => new ApiError(500, message, false)
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';

    logger.error('Unhandled Error', err, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.user?.id
    });
  } else {
    logger.warn('Operational Error', {
      statusCode,
      message,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    });
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    message = 'Data conflict - resource already exists';
  }

  if (err.code === 'SQLITE_BUSY') {
    statusCode = 503;
    message = 'Database is busy, please try again';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = err.message;
  }

  const response = {
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  res.status(statusCode).json(response);
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

module.exports = {
  ApiError,
  createError,
  asyncHandler,
  errorHandler,
  notFoundHandler
};