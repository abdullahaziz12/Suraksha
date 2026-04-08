/**
 * Location Routes
 * GPS location tracking and sharing
 */

const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { locationLimiter } = require('../middleware/rateLimiter');
const { isLatitude, isLongitude, isNumber } = require('../middleware/validate');

const { locationHistory, uuidv4 } = require('../models/store');

router.use(authenticate);

// ──────────────────────────────────────────────────────────
// POST /api/location/update - Update user location
// ──────────────────────────────────────────────────────────
router.post('/update', locationLimiter, asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, accuracy, altitude, heading, speed } = req.body;

    // Validate required fields
    if (latitude === undefined || longitude === undefined) {
      throw new ValidationError('latitude and longitude are required');
    }

    // Validate data types
    isLatitude(latitude);
    isLongitude(longitude);

    if (accuracy !== undefined && accuracy !== null) {
      isNumber(accuracy, 'accuracy');
    }
    if (altitude !== undefined && altitude !== null) {
      isNumber(altitude, 'altitude');
    }
    if (heading !== undefined && heading !== null) {
      isNumber(heading, 'heading');
      if (heading < 0 || heading > 360) {
        throw new ValidationError('heading must be between 0 and 360');
      }
    }
    if (speed !== undefined && speed !== null) {
      isNumber(speed, 'speed');
      if (speed < 0) {
        throw new ValidationError('speed must be non-negative');
      }
    }

    // Create location entry
    const entry = {
      id: uuidv4(),
      userId: req.user.id,
      latitude: parseFloat(latitude.toFixed(8)),
      longitude: parseFloat(longitude.toFixed(8)),
      accuracy: accuracy || null,
      altitude: altitude || null,
      heading: heading || null,
      speed: speed || null,
      timestamp: new Date().toISOString()
    };

    locationHistory.unshift(entry);

    // Keep only the last 500 location records to prevent memory leaks
    if (locationHistory.length > 500) {
      locationHistory.splice(500);
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        latitude: entry.latitude,
        longitude: entry.longitude,
        timestamp: entry.timestamp
      }
    });
  } catch (err) {
    console.error('[ERROR] Location update failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/location/current - Get current location
// ──────────────────────────────────────────────────────────
router.get('/current', asyncHandler(async (req, res) => {
  try {
    const latest = locationHistory.find(l => l.userId === req.user.id);

    if (!latest) {
      return res.json({
        success: true,
        data: { location: null, message: 'No location data yet' }
      });
    }

    res.json({
      success: true,
      data: { location: { ...latest, userId: undefined } }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get current location:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/location/history - Get location history
// ──────────────────────────────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const history = locationHistory
      .filter(l => l.userId === req.user.id)
      .slice(0, limit)
      .map(l => ({ ...l, userId: undefined }));

    res.json({
      success: true,
      data: { history, count: history.length }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get location history:', err.message);
    throw err;
  }
}));

module.exports = router;
