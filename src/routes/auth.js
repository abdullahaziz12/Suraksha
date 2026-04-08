/**
 * Authentication Routes
 * Handles user registration, login, logout, and profile management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const {
  asyncHandler,
  ValidationError,
  AuthError,
  ConflictError
} = require('../middleware/errorHandler');

const { authenticate, generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const {
  required,
  isEmail,
  minLength,
  isStrongPassword,
  maxLength,
  isPakistanPhone,
  normalizePakistanPhone,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone
} = require('../middleware/validate');
const { generateOtp, sendOtpEmail } = require('../services/email');

const {
  revokedTokens,
  addActivity
} = require('../models/store');
const {
  findUserByEmail,
  createUser,
  saveUser,
  normalizeRecord
} = require('../repositories/userRepo');

const pendingEmailVerifications = new Map();

// ─── Helper ────────────────────────────────────────────────
function safeUser(u) {
  const raw = normalizeRecord(u);
  const { passwordHash, _id, ...safe } = raw;
  return safe;
}

// ──────────────────────────────────────────────────────────
// POST /api/auth/register - Register new account
// ──────────────────────────────────────────────────────────
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  let { name, email, password, phone } = req.body;

  // Validate inputs
  try {
    required(name, 'name');
    required(email, 'email');
    required(password, 'password');
    required(phone, 'phone');
    isEmail(email);
    minLength(password, 8, 'password');
    isStrongPassword(password, 'password');
    maxLength(name, 60, 'name');
    isPakistanPhone(phone, 'phone');
  } catch (err) {
    throw err;
  }

  // Sanitize inputs
  name = sanitizeString(name);
  email = sanitizeEmail(email);
  phone = normalizePakistanPhone(phone);

  // Check for duplicate email
  if (await findUserByEmail(email)) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash password with error handling
  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(password, 12);
  } catch (err) {
    console.error('[ERROR] Password hashing failed:', err.message);
    throw new Error('Failed to create account');
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  pendingEmailVerifications.set(email, {
    name,
    email,
    phone,
    passwordHash,
    otp,
    expiresAt,
    attempts: 0
  });

  const emailResult = await sendOtpEmail(email, otp, name);

  res.status(200).json({
    success: true,
    message: 'OTP sent to your email. Verify OTP to activate your account.',
    data: {
      pendingVerification: true,
      email,
      otpSent: emailResult.sent,
      fallback: emailResult.fallback,
      otpPreview: process.env.NODE_ENV !== 'production' ? otp : undefined
    }
  });
}));

// ──────────────────────────────────────────────────────────
// POST /api/auth/verify-email-otp - Verify OTP and activate account
// ──────────────────────────────────────────────────────────
router.post('/verify-email-otp', authLimiter, asyncHandler(async (req, res) => {
  let { email, otp } = req.body;

  required(email, 'email');
  required(otp, 'otp');
  isEmail(email);

  email = sanitizeEmail(email);
  otp = String(otp).trim();

  const pending = pendingEmailVerifications.get(email);
  if (!pending) {
    throw new ValidationError('No pending verification found. Please register again.');
  }

  if (Date.now() > pending.expiresAt) {
    pendingEmailVerifications.delete(email);
    throw new ValidationError('OTP has expired. Please register again.');
  }

  pending.attempts += 1;
  if (pending.attempts > 5) {
    pendingEmailVerifications.delete(email);
    throw new ValidationError('Too many incorrect OTP attempts. Please register again.');
  }

  if (otp !== pending.otp) {
    throw new ValidationError('Invalid OTP. Please try again.');
  }

  if (await findUserByEmail(email)) {
    pendingEmailVerifications.delete(email);
    throw new ConflictError('An account with this email already exists');
  }

  const user = await createUser({
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
    phone: pending.phone,
    avatar: pending.name[0].toUpperCase(),
    emailVerified: true,
    protectionEnabled: true,
    sosCountdownSeconds: 5,
    createdAt: new Date().toISOString(),
    settings: {
      gyroscopeEnabled: true,
      gpsEnabled: true,
      tripleTapEnabled: true,
      alertSound: true,
      vibration: true,
      autoSmsLocation: true,
      incognitoTracking: false,
      endToEndEncryption: true,
      dataRetention30Days: true,
      shareLiveRoute: true,
      arrivalAlert: true,
      deviationAlert: true,
      tripleTapSilent: true,
      tripleTapSpeed: 'fast',
      sensitivityLevel: 'high',
      shakeAlert: true,
      fallDetection: true,
      loudImpact: true,
      backgroundMonitoring: true,
    }
  });
  pendingEmailVerifications.delete(email);

  const token = generateToken(user.id);

  addActivity(user.id, {
    icon: 'safe',
    emoji: '✅',
    name: 'Account Verified',
    detail: 'Email verified and account activated',
    time: 'Just now',
    distLabel: 'Safe'
  });

  res.status(201).json({
    success: true,
    message: 'Email verified successfully',
    data: {
      token,
      user: safeUser(user)
    }
  });
}));

// ──────────────────────────────────────────────────────────
// POST /api/auth/login - Login to account
// ──────────────────────────────────────────────────────────
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  let { email, password } = req.body;

  // Validate inputs
  try {
    required(email, 'email');
    required(password, 'password');
    isEmail(email);
  } catch (err) {
    throw err;
  }

  // Sanitize inputs
  email = sanitizeEmail(email);

  // Find user
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AuthError('Invalid email or password');
  }

  // Verify password with error handling
  let valid = false;
  try {
    valid = await bcrypt.compare(password, user.passwordHash);
  } catch (err) {
    console.error('[ERROR] Password verification failed:', err.message);
    throw new AuthError('Login failed. Please try again');
  }

  if (!valid) {
    throw new AuthError('Invalid email or password');
  }

  // Generate token
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

// ──────────────────────────────────────────────────────────
// POST /api/auth/logout - Logout (revoke token)
// ──────────────────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  try {
    revokedTokens.add(req.token);

    addActivity(req.user.id, {
      icon: 'info',
      emoji: '🚪',
      name: 'Logged Out',
      detail: 'Session ended',
      time: 'Just now',
      distLabel: 'Info'
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    throw new Error('Logout failed');
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/auth/me - Get current user profile
// ──────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: safeUser(req.user) }
  });
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/auth/profile - Update user profile
// ──────────────────────────────────────────────────────────
router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = req.user;

  // Update name if provided
  if (name !== undefined) {
    try {
      required(name, 'name');
      maxLength(name, 60, 'name');
      user.name = sanitizeString(name);
      user.avatar = user.name[0].toUpperCase();
    } catch (err) {
      throw err;
    }
  }

  // Update phone if provided
  if (phone !== undefined) {
    required(phone, 'phone');
    isPakistanPhone(phone, 'phone');
    user.phone = normalizePakistanPhone(phone);
  }

  await saveUser(user);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: safeUser(user) }
  });
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/auth/password - Change password
// ──────────────────────────────────────────────────────────
router.patch('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validate inputs
  try {
    required(currentPassword, 'currentPassword');
    required(newPassword, 'newPassword');
    minLength(newPassword, 8, 'newPassword');
    isStrongPassword(newPassword, 'newPassword');
  } catch (err) {
    throw err;
  }

  // Verify current password
  let valid = false;
  try {
    valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
  } catch (err) {
    console.error('[ERROR] Password verification failed:', err.message);
    throw new AuthError('Password verification failed');
  }

  if (!valid) {
    throw new AuthError('Current password is incorrect');
  }

  // Hash and set new password
  try {
    req.user.passwordHash = await bcrypt.hash(newPassword, 12);
    await saveUser(req.user);
  } catch (err) {
    console.error('[ERROR] Password hashing failed:', err.message);
    throw new Error('Failed to update password');
  }

  addActivity(req.user.id, {
    icon: 'safe',
    emoji: '🔐',
    name: 'Password Changed',
    detail: 'Your password was updated',
    time: 'Just now',
    distLabel: 'Safe'
  });

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

module.exports = router;
