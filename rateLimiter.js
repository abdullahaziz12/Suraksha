const rateLimit = require('express-rate-limit');

// ─── General API Limiter ────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests — please wait a few minutes before retrying.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// ─── Auth Limiter (stricter) ────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many login attempts — please try again in 15 minutes.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// ─── SOS Limiter (generous — safety critical) ───────────────
const sosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'SOS_RATE_LIMIT',
      message: 'SOS rate limit reached. If you are in danger, call 15 directly.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

module.exports = { generalLimiter, authLimiter, sosLimiter };
