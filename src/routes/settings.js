/**
 * Settings Routes
 * User preferences and configuration management
 */

const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { isIn, isInteger, required } = require('../middleware/validate');
const { addActivity } = require('../models/store');
const { saveUser } = require('../repositories/userRepo');

router.use(authenticate);

// List of valid boolean setting keys
const BOOLEAN_SETTINGS = [
  'gyroscopeEnabled',
  'gpsEnabled',
  'tripleTapEnabled',
  'alertSound',
  'vibration',
  'autoSmsLocation',
  'incognitoTracking',
  'endToEndEncryption',
  'dataRetention30Days',
  'shareLiveRoute',
  'arrivalAlert',
  'deviationAlert',
  'tripleTapSilent',
  'shakeAlert',
  'fallDetection',
  'loudImpact',
  'backgroundMonitoring'
];

// ──────────────────────────────────────────────────────────
// GET /api/settings - Get user settings
// ──────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        protectionEnabled: req.user.protectionEnabled,
        sosCountdownSeconds: req.user.sosCountdownSeconds,
        settings: req.user.settings
      }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get settings:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/settings - Update multiple settings
// ──────────────────────────────────────────────────────────
router.patch('/', asyncHandler(async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('settings must be an object');
    }

    const updated = [];

    for (const [key, value] of Object.entries(settings)) {
      // Boolean settings
      if (BOOLEAN_SETTINGS.includes(key)) {
        if (typeof value !== 'boolean') {
          throw new ValidationError(`${key} must be a boolean`, key);
        }
        req.user.settings[key] = value;
        updated.push(key);
      }
      // Triple tap speed setting
      else if (key === 'tripleTapSpeed') {
        try {
          isIn(value, ['slow', 'medium', 'fast'], 'tripleTapSpeed');
          req.user.settings.tripleTapSpeed = value;
          updated.push(key);
        } catch (err) {
          throw err;
        }
      }
      // Sensitivity level setting
      else if (key === 'sensitivityLevel') {
        try {
          isIn(value, ['low', 'medium', 'high'], 'sensitivityLevel');
          req.user.settings.sensitivityLevel = value;
          updated.push(key);
        } catch (err) {
          throw err;
        }
      }
      // Unknown setting
      else {
        throw new ValidationError(`Unknown setting: ${key}`, key);
      }
    }

    await saveUser(req.user);

    res.json({
      success: true,
      message: `Updated ${updated.length} setting(s)`,
      data: { settings: req.user.settings, updated }
    });
  } catch (err) {
    console.error('[ERROR] Settings update failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/settings/protection - Toggle protection
// ──────────────────────────────────────────────────────────
router.patch('/protection', asyncHandler(async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('enabled must be a boolean');
    }

    req.user.protectionEnabled = enabled;
  await saveUser(req.user);

    addActivity(req.user.id, {
      icon: enabled ? 'safe' : 'warn',
      emoji: enabled ? '🛡️' : '⚠️',
      name: enabled ? 'Protection Enabled' : 'Protection Disabled',
      detail: enabled ? 'All safety monitors are active' : 'Safety monitoring is off',
      time: 'Just now',
      distLabel: enabled ? 'Safe' : 'Alert'
    });

    res.json({
      success: true,
      message: `Protection ${enabled ? 'enabled' : 'disabled'}`,
      data: { protectionEnabled: req.user.protectionEnabled }
    });
  } catch (err) {
    console.error('[ERROR] Protection toggle failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/settings/sos-countdown - Set SOS countdown
// ──────────────────────────────────────────────────────────
router.patch('/sos-countdown', asyncHandler(async (req, res) => {
  try {
    const { seconds } = req.body;

    try {
      required(seconds, 'seconds');
      isInteger(seconds, 'seconds');
    } catch (err) {
      throw err;
    }

    if (seconds < 3 || seconds > 30) {
      throw new ValidationError('SOS countdown must be between 3 and 30 seconds');
    }

    req.user.sosCountdownSeconds = seconds;
  await saveUser(req.user);

    addActivity(req.user.id, {
      icon: 'safe',
      emoji: '⏱️',
      name: 'SOS Countdown Changed',
      detail: `SOS countdown set to ${seconds} seconds`,
      time: 'Just now',
      distLabel: 'Safe'
    });

    res.json({
      success: true,
      message: `SOS countdown set to ${seconds} seconds`,
      data: { sosCountdownSeconds: req.user.sosCountdownSeconds }
    });
  } catch (err) {
    console.error('[ERROR] SOS countdown update failed:', err.message);
    throw err;
  }
}));

module.exports = router;
