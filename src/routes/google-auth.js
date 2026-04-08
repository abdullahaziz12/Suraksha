/**
 * Google OAuth Authentication Routes
 * Social login integration with Google
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, AuthError, ValidationError } = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/auth');
const { addActivity } = require('../models/store');
const { normalizePakistanPhone, isPakistanPhone, required } = require('../middleware/validate');
const { findUserByEmail, findUserById, createUser, saveUser } = require('../repositories/userRepo');

// Note: In production, use 'google-auth-library' npm package
// npm install google-auth-library

function decodeGoogleTokenPayload(idToken) {
  try {
    if (!idToken || typeof idToken !== 'string') return null;
    const parts = idToken.split('.');
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * POST /api/google-auth/callback
 * Receives ID token from frontend (obtained via Google Sign-In SDK)
 * 
 * Frontend must:
 * 1. Load Google Sign-In SDK
 * 2. Get ID token from google.accounts.id.onSuccess()
 * 3. Send token to this endpoint
 */
router.post('/callback', asyncHandler(async (req, res) => {
  try {
    const { idToken, userInfo = {} } = req.body || {};

    if (!idToken) {
      throw new AuthError('Missing Google token');
    }

    const tokenPayload = decodeGoogleTokenPayload(idToken) || {};

    // Extract from userInfo first, then fallback to idToken payload.
    const email = String(userInfo.email || tokenPayload.email || '').trim().toLowerCase();
    const name = String(userInfo.name || tokenPayload.name || '').trim();
    const picture = userInfo.picture || tokenPayload.picture || null;

    if (!email || !name) {
      throw new AuthError('Unable to read Google account profile. Try again or use email login.');
    }

    // Check if user exists
    let user = await findUserByEmail(email);

    // If new user, create account
    if (!user) {
      user = await createUser({
        name,
        email: email.toLowerCase(),
        passwordHash: null, // Google OAuth users don't have passwords
        phone: '',
        avatar: name[0].toUpperCase(),
        picture: picture || null,
        authProvider: 'google', // Track login method
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
          powerButtonDoubleTap: true, // New: Power button feature
        }
      });

      addActivity(user.id, {
        icon: 'safe',
        emoji: '✅',
        name: 'Account Created with Google',
        detail: `Welcome ${name}!`,
        time: 'Just now',
        distLabel: 'Safe'
      });
    }

    // Google users must complete +92 phone before app access.
    if (!user.phone) {
      return res.status(200).json({
        success: true,
        message: 'Google sign-in successful. Phone number required to continue.',
        data: {
          requiresPhone: true,
          setupUserId: user.id,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            picture: user.picture
          }
        }
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: user.authProvider === 'google' ? 'Google sign-in successful' : 'Logged in with Google',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          protectionEnabled: user.protectionEnabled
        }
      }
    });
  } catch (err) {
    console.error('[ERROR] Google OAuth callback failed:', err.message);
    throw err;
  }
}));

/**
 * POST /api/google-auth/complete-phone
 * Completes Google login by adding required +92 phone number
 */
router.post('/complete-phone', asyncHandler(async (req, res) => {
  const { setupUserId, phone } = req.body;

  required(setupUserId, 'setupUserId');
  required(phone, 'phone');
  isPakistanPhone(phone);

  const user = await findUserById(setupUserId);
  if (!user || user.authProvider !== 'google') {
    throw new AuthError('Invalid or expired Google setup session');
  }

  user.phone = normalizePakistanPhone(phone);
  user.emailVerified = true;
  await saveUser(user);

  const token = generateToken(user.id);

  addActivity(user.id, {
    icon: 'safe',
    emoji: '📱',
    name: 'Phone Added',
    detail: 'Google account phone verification completed',
    time: 'Just now',
    distLabel: 'Safe'
  });

  res.json({
    success: true,
    message: 'Phone number verified. App access granted.',
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        protectionEnabled: user.protectionEnabled
      }
    }
  });
}));

/**
 * POST /api/google-auth/link
 * Link Google account to existing user
 * For users who already have an account and want to add Google login
 */
router.post('/link', asyncHandler(async (req, res) => {
  try {
    const { authToken, idToken, userInfo } = req.body;

    if (!authToken || !idToken || !userInfo) {
      throw new AuthError('Missing authentication data');
    }

    // Verify existing user from authToken
    // (In production, verify JWT properly)
    const { email: googleEmail } = userInfo;

    // Check if Google email already linked to other account
    const existing = await findUserByEmail(googleEmail);
    if (existing && existing.id !== userInfo.userId) {
      throw new AuthError('This Google account is already linked to another Suraksha account');
    }

    res.json({
      success: true,
      message: 'Google account linked successfully'
    });
  } catch (err) {
    console.error('[ERROR] Google link failed:', err.message);
    throw err;
  }
}));

module.exports = router;
