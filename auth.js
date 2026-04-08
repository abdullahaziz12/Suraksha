const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { asyncHandler, ValidationError, AuthError, ConflictError } = require('../middleware/errorHandler');
const { authenticate, generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { required, isEmail, minLength, maxLength, sanitizeString } = require('../middleware/validate');
const { users, getUserByEmail, revokedTokens, uuidv4 } = require('../models/store');

// ─── POST /api/auth/register ────────────────────────────────
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  let { name, email, password, phone } = req.body;

  // Validate
  required(name,     'name');
  required(email,    'email');
  required(password, 'password');
  isEmail(email);
  minLength(password, 8, 'password');
  maxLength(name, 60, 'name');
  name  = sanitizeString(name);
  email = sanitizeString(email).toLowerCase();

  // Check duplicate
  if (getUserByEmail(email)) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    phone: phone ? sanitizeString(phone) : '',
    avatar: name[0].toUpperCase(),
    protectionEnabled: true,
    sosCountdownSeconds: 5,
    settings: {
      gyroscopeEnabled: true, gpsEnabled: true, tripleTapEnabled: true,
      alertSound: true, vibration: true, autoSmsLocation: true,
      incognitoTracking: false, endToEndEncryption: true, dataRetention30Days: true,
      shareLiveRoute: true, arrivalAlert: true, deviationAlert: true,
      tripleTapSilent: true, tripleTapSpeed: 'fast', sensitivityLevel: 'high',
      shakeAlert: true, fallDetection: true, loudImpact: true, backgroundMonitoring: true,
    }
  };

  users.push(user);
  const token = generateToken(user.id);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      token,
      user: safeUser(user)
    }
  });
}));

// ─── POST /api/auth/login ───────────────────────────────────
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  let { email, password } = req.body;

  required(email,    'email');
  required(password, 'password');
  isEmail(email);

  email = sanitizeString(email).toLowerCase();
  const user = getUserByEmail(email);

  if (!user) {
    throw new AuthError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Invalid email or password');
  }

  const token = generateToken(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: safeUser(user)
    }
  });
}));

// ─── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  revokedTokens.add(req.token);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// ─── GET /api/auth/me ───────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: safeUser(req.user) }
  });
}));

// ─── PATCH /api/auth/profile ────────────────────────────────
router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = req.user;

  if (name !== undefined) {
    required(name, 'name');
    maxLength(name, 60, 'name');
    user.name = sanitizeString(name);
    user.avatar = user.name[0].toUpperCase();
  }
  if (phone !== undefined) {
    user.phone = sanitizeString(phone);
  }

  res.json({
    success: true,
    message: 'Profile updated',
    data: { user: safeUser(user) }
  });
}));

// ─── PATCH /api/auth/password ───────────────────────────────
router.patch('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  required(currentPassword, 'currentPassword');
  required(newPassword,     'newPassword');
  minLength(newPassword, 8, 'newPassword');

  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!valid) {
    throw new AuthError('Current password is incorrect');
  }

  req.user.passwordHash = await bcrypt.hash(newPassword, 12);

  res.json({ success: true, message: 'Password updated successfully' });
}));

// ─── Helper ────────────────────────────────────────────────
function safeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

module.exports = router;
