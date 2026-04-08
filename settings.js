const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { isIn } = require('../middleware/validate');
const { addActivity } = require('../models/store');

router.use(authenticate);

const BOOLEAN_SETTINGS = [
  'gyroscopeEnabled', 'gpsEnabled', 'tripleTapEnabled',
  'alertSound', 'vibration', 'autoSmsLocation',
  'incognitoTracking', 'endToEndEncryption', 'dataRetention30Days',
  'shareLiveRoute', 'arrivalAlert', 'deviationAlert',
  'tripleTapSilent', 'shakeAlert', 'fallDetection',
  'loudImpact', 'backgroundMonitoring'
];

// ─── GET /api/settings ──────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      protectionEnabled: req.user.protectionEnabled,
      sosCountdownSeconds: req.user.sosCountdownSeconds,
      settings: req.user.settings
    }
  });
}));

// ─── PATCH /api/settings ────────────────────────────────────
router.patch('/', asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('settings must be an object');
  }

  const updated = [];

  for (const [key, value] of Object.entries(settings)) {
    if (BOOLEAN_SETTINGS.includes(key)) {
      if (typeof value !== 'boolean') {
        throw new ValidationError(`${key} must be a boolean`, key);
      }
      req.user.settings[key] = value;
      updated.push(key);

    } else if (key === 'tripleTapSpeed') {
      isIn(value, ['slow', 'medium', 'fast'], 'tripleTapSpeed');
      req.user.settings.tripleTapSpeed = value;
      updated.push(key);

    } else if (key === 'sensitivityLevel') {
      isIn(value, ['low', 'medium', 'high'], 'sensitivityLevel');
      req.user.settings.sensitivityLevel = value;
      updated.push(key);

    } else {
      throw new ValidationError(`Unknown setting: ${key}`, key);
    }
  }

  res.json({
    success: true,
    message: `Updated ${updated.length} setting(s)`,
    data: { settings: req.user.settings, updated }
  });
}));

// ─── PATCH /api/settings/protection ────────────────────────
router.patch('/protection', asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled must be a boolean');
  }

  req.user.protectionEnabled = enabled;

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
}));

// ─── PATCH /api/settings/sos-countdown ─────────────────────
router.patch('/sos-countdown', asyncHandler(async (req, res) => {
  const { seconds } = req.body;

  if (typeof seconds !== 'number' || !Number.isInteger(seconds)) {
    throw new ValidationError('seconds must be an integer');
  }
  if (seconds < 3 || seconds > 30) {
    throw new ValidationError('SOS countdown must be between 3 and 30 seconds');
  }

  req.user.sosCountdownSeconds = seconds;

  res.json({
    success: true,
    message: `SOS countdown set to ${seconds} seconds`,
    data: { sosCountdownSeconds: req.user.sosCountdownSeconds }
  });
}));

module.exports = router;
