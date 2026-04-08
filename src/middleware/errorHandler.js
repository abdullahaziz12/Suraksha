/**
 * Centralized Error Handling Middleware
 * Exception & Error Handling for all routes
 */

// ─── Custom Error Classes ───────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 422, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

// ─── 404 Handler ───────────────────────────────────────────
function notFound(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
}

// ─── Global Error Handler ───────────────────────────────────
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }

  // Handle JSON parse errors
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  // Handle uncaught exceptions
  if (err.isOperational === false) {
    statusCode = 500;
    code = 'INTERNAL_ERROR';
    message = 'An unexpected error occurred. Please try again later.';
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${statusCode} ${code}: ${message}`);
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
  }

  // Log important business errors
  if (statusCode >= 400 && statusCode < 500 && statusCode !== 404) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${statusCode} ${code}: ${message}`);
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(err.field && { field: err.field }),
      ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack })
    },
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
}

// ─── Async wrapper ─────────────────────────────────────────
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // Ensure it's an AppError instance
      if (!(err instanceof AppError) && !(err instanceof Error)) {
        err = new InternalServerError(err.toString());
      }
      next(err);
    });
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  notFound,
  errorHandler,
  asyncHandler
};
