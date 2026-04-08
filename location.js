const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { locationHistory, uuidv4 } = require('../models/store');

router.use(authenticate);

// ─── POST /api/location/update ──────────────────────────────
router.post('/update', asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy, altitude, heading, speed } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw new ValidationError('latitude and longitude are required');
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new ValidationError('latitude and longitude must be numbers');
  }
  if (latitude < -90 || latitude > 90) {
    throw new ValidationError('latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new ValidationError('longitude must be between -180 and 180');
  }

  const entry = {
    id: uuidv4(),
    userId: req.user.id,
    latitude,
    longitude,
    accuracy:  accuracy  || null,
    altitude:  altitude  || null,
    heading:   heading   || null,
    speed:     speed     || null,
    timestamp: new Date().toISOString()
  };

  locationHistory.unshift(entry);

  // Keep only the last 500 location records in memory
  if (locationHistory.length > 500) locationHistory.splice(500);

  res.json({
    success: true,
    message: 'Location updated',
    data: {
      latitude: entry.latitude,
      longitude: entry.longitude,
      timestamp: entry.timestamp
    }
  });
}));

// ─── GET /api/location/current ──────────────────────────────
router.get('/current', asyncHandler(async (req, res) => {
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
}));

// ─── GET /api/location/history ──────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const history = locationHistory
    .filter(l => l.userId === req.user.id)
    .slice(0, limit)
    .map(l => ({ ...l, userId: undefined }));

  res.json({
    success: true,
    data: { history, count: history.length }
  });
}));

module.exports = router;
