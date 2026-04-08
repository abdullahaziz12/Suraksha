/**
 * Rate Limiting Middleware
 * Prevents abuse and protects critical endpoints
 */

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
  },
  skip: (req) => req.method === 'GET' && req.path === '/api/health'
});

// ─── Auth Limiter (stricter) ────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many login/register attempts — please try again in 15 minutes.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
  skip: (req) => {
    if (req.method !== 'POST') return true;
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
});

// ─── SOS Limiter (generous — safety critical) ───────────────
const sosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Allow 20 SOS calls per minute (safety is critical)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'SOS_RATE_LIMIT',
      message: 'SOS rate limit reached. If you are in immediate danger, call local emergency services (15) directly.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// ─── Contact Limiter ───────────────────────────────────────
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'CONTACT_RATE_LIMIT',
      message: 'Too many contact operations — please wait before retrying.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// ─── Location Limiter ──────────────────────────────────────
const locationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Up to 1 location update per second
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'LOCATION_RATE_LIMIT',
      message: 'Too many location updates — please wait before retrying.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

// ─── Ride Limiter ─────────────────────────────────────────
const rideLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RIDE_RATE_LIMIT',
      message: 'Too many ride operations — please wait before retrying.'
    }
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  sosLimiter,
  contactLimiter,
  locationLimiter,
  rideLimiter
};
