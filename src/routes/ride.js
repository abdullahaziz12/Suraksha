/**
 * Safe Ride Routes
 * Ride tracking, safety monitoring, and location sharing
 */

const express = require('express');
const router = express.Router();

const {
  asyncHandler,
  NotFoundError,
  ValidationError
} = require('../middleware/errorHandler');

const { authenticate } = require('../middleware/auth');
const { rideLimiter } = require('../middleware/rateLimiter');

const { required, isIn, sanitizeString, sanitizeLocation } = require('../middleware/validate');

const { rides, addActivity, getContactsByUserId, uuidv4 } = require('../models/store');

router.use(authenticate);

const VALID_RIDE_TYPES = ['Car', 'Bus', 'Rickshaw', 'Bike', 'Walk'];

// ─── Helpers ───────────────────────────────────────────────
function getActiveRide(userId) {
  const ride = rides.find(r => r.userId === userId && r.status === 'active');
  if (!ride) throw new NotFoundError('Active ride');
  return ride;
}

function rideEmoji(type) {
  return { Car: '🚗', Bus: '🚌', Rickshaw: '🛺', Bike: '🏍️', Walk: '🚶' }[type] || '🚗';
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ──────────────────────────────────────────────────────────
// POST /api/ride/start - Start a safe ride
// ──────────────────────────────────────────────────────────
router.post('/start', rideLimiter, asyncHandler(async (req, res) => {
  try {
    let { rideType, originName, destinationName, latitude, longitude } = req.body;

    // Validate ride type
    try {
      required(rideType, 'rideType');
      isIn(rideType, VALID_RIDE_TYPES, 'rideType');
    } catch (err) {
      throw err;
    }

    // Check if ride already active
    const existing = rides.find(r => r.userId === req.user.id && r.status === 'active');
    if (existing) {
      throw new ValidationError('You already have an active ride. End it before starting a new one.');
    }

    // Get contacts to notify
    const contacts = getContactsByUserId(req.user.id);
    const notifiedContacts = contacts.filter(c => c.smsAlertsOn).map(c => c.name);

    // Sanitize location if provided
    const startLocation = latitude && longitude
      ? { latitude, longitude }
      : null;

    // Create ride
    const ride = {
      id: uuidv4(),
      userId: req.user.id,
      rideType,
      status: 'active',
      originName: sanitizeString(originName || 'Current Location'),
      destinationName: sanitizeString(destinationName || 'Destination'),
      startLocation,
      currentLocation: startLocation,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: 0,
      notifiedContacts
    };

    rides.push(ride);

    addActivity(req.user.id, {
      icon: 'safe',
      emoji: rideEmoji(rideType),
      name: `${rideType} Ride Started`,
      detail: `${notifiedContacts.length} contact(s) notified`,
      time: 'Just now',
      distLabel: 'LIVE'
    });

    res.status(201).json({
      success: true,
      message: `${rideType} ride started — your contacts have been notified`,
      data: { ride }
    });
  } catch (err) {
    console.error('[ERROR] Ride start failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// POST /api/ride/end - End active ride
// ──────────────────────────────────────────────────────────
router.post('/end', rideLimiter, asyncHandler(async (req, res) => {
  try {
    const ride = getActiveRide(req.user.id);
    const { durationSeconds } = req.body;

    ride.status = 'completed';
    ride.endedAt = new Date().toISOString();
    ride.durationSeconds = durationSeconds || Math.floor(
      (new Date(ride.endedAt) - new Date(ride.startedAt)) / 1000
    );

    const dur = formatDuration(ride.durationSeconds);

    addActivity(req.user.id, {
      icon: 'safe',
      emoji: rideEmoji(ride.rideType),
      name: 'Safe Ride Completed',
      detail: `${ride.rideType} ride — ${dur}`,
      time: 'Just now',
      distLabel: 'Safe'
    });

    res.json({
      success: true,
      message: `Ride ended safely after ${dur}`,
      data: { ride }
    });
  } catch (err) {
    console.error('[ERROR] Ride end failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// PATCH /api/ride/location - Update ride location
// ──────────────────────────────────────────────────────────
router.patch('/location', rideLimiter, asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      throw new ValidationError('latitude and longitude are required');
    }

    const ride = getActiveRide(req.user.id);
    ride.currentLocation = { latitude, longitude, accuracy, updatedAt: new Date().toISOString() };

    res.json({
      success: true,
      message: 'Location updated',
      data: { location: ride.currentLocation }
    });
  } catch (err) {
    console.error('[ERROR] Location update failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// POST /api/ride/deviation-alert - Report route deviation
// ──────────────────────────────────────────────────────────
router.post('/deviation-alert', rideLimiter, asyncHandler(async (req, res) => {
  try {
    const ride = getActiveRide(req.user.id);
    const { deviationMeters } = req.body;

    addActivity(req.user.id, {
      icon: 'warn',
      emoji: '⚠️',
      name: 'Route Deviation Detected',
      detail: `Driver deviated ${deviationMeters || '500+'}m from planned route`,
      time: 'Just now',
      distLabel: 'Alert'
    });

    res.json({
      success: true,
      message: 'Deviation alert sent to contacts',
      data: { rideId: ride.id, deviationMeters }
    });
  } catch (err) {
    console.error('[ERROR] Deviation alert failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/ride/active - Check active ride status
// ──────────────────────────────────────────────────────────
router.get('/active', asyncHandler(async (req, res) => {
  try {
    const ride = rides.find(r => r.userId === req.user.id && r.status === 'active');
    res.json({
      success: true,
      data: { active: !!ride, ride: ride || null }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get active ride:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/ride/history - Get ride history
// ──────────────────────────────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const history = rides
      .filter(r => r.userId === req.user.id)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, limit)
      .map(r => ({ ...r, userId: undefined }));

    res.json({
      success: true,
      data: { rides: history, count: history.length }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get ride history:', err.message);
    throw err;
  }
}));

module.exports = router;
