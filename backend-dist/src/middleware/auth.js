/**
 * Authentication Middleware
 * JWT token management and user authentication
 */

const jwt = require('jsonwebtoken');
const { AuthError } = require('./errorHandler');
const { revokedTokens } = require('../models/store');
const { findUserById } = require('../repositories/userRepo');

const JWT_SECRET = process.env.JWT_SECRET || 'suraksha-secret-key-2026';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// ─── Generate JWT Token ────────────────────────────────────
function generateToken(userId) {
  try {
    const token = jwt.sign(
      { userId, iat: Date.now() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY, algorithm: 'HS256' }
    );
    return token;
  } catch (err) {
    console.error('[ERROR] Token generation failed:', err.message);
    throw new AuthError('Failed to generate authentication token');
  }
}

// ─── Verify JWT Token ──────────────────────────────────────
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw err; // Let global handler catch this
    }
    throw new AuthError('Invalid or expired token');
  }
}

// ─── Authenticate Middleware ───────────────────────────────
function authenticate(req, res, next) {
  (async () => {
    // Get token from header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.headers['x-auth-token'] || '';

    if (!token) {
      throw new AuthError('No authentication token provided. Use "Authorization: Bearer <token>" header');
    }

    // Check if token is revoked (logout)
    if (revokedTokens.has(token)) {
      throw new AuthError('Token has been revoked. Please login again');
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user
    const user = await findUserById(decoded.userId);
    if (!user) {
      throw new AuthError('User not found. Please login again');
    }

    // Attach to request
    req.user = user;
    req.token = token;
    req.userId = decoded.userId;
  })()
    .then(() => next())
    .catch((err) => next(err));
}

// ─── Optional Auth (doesn't fail if no token) ──────────────
function optionalAuth(req, res, next) {
  (async () => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.headers['x-auth-token'] || '';

    if (token && !revokedTokens.has(token)) {
      const decoded = verifyToken(token);
      const user = await findUserById(decoded.userId);
      if (user) {
        req.user = user;
        req.token = token;
        req.userId = decoded.userId;
      }
    }
  })()
    .catch(() => {
      // Silently fail - user remains unauthenticated.
    })
    .finally(() => next());
}

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  verifyToken,
  JWT_SECRET,
  JWT_EXPIRY
};
