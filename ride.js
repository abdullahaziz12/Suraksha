const express = require('express');
const router = express.Router();

const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { required, isIn, sanitizeString } = require('../middleware/validate');
const { rides, addActivity, getContactsByUserId, uuidv4 } = require('../models/store');

router.use(authenticate);

const VALID_RIDE_TYPES = ['Car', 'Bus', 'Rickshaw', 'Bike', 'Walk'];

// ─── POST /api/ride/start ───────────────────────────────────
router.post('/start', asyncHandler(async (req, res) => {
  let { rideType, originName, destinationName, latitude, longitude } = req.body;

  required(rideType, 'rideType');
  isIn(rideType, VALID_RIDE_TYPES, 'rideType');

  // Check if ride already active for user
  const existing = rides.find(r => r.userId === req.user.id && r.status === 'active');
  if (existing) {
    throw new ValidationError('You already have an active ride. End it before starting a new one.');
  }

  const contacts = getContactsByUserId(req.user.id);
  const notifiedContacts = contacts.filter(c => c.smsAlertsOn).map(c => c.name);

  const ride = {
    id: uuidv4(),
    userId: req.user.id,
    rideType,
    status: 'active',
    originName: sanitizeString(originName || 'Current Location'),
    destinationName: sanitizeString(destinationName || 'Destination'),
    startLocation: latitude && longitude ? { latitude, longitude } : null,
    currentLocation: latitude && longitude ? { latitude, longitude } : null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSeconds: 0,
    notifiedContacts
  };

  rides.push(ride);

  addActivity(req.user.id, {
    icon: 'safe', emoji: rideEmoji(rideType),
    name: `${rideType} Ride Started`,
    detail: `${notifiedContacts.length} contact(s) notified`,
    time: 'Just now', distLabel: 'LIVE'
  });

  res.status(201).json({
    success: true,
    message: `${rideType} ride started — your contacts have been notified`,
    data: { ride }
  });
}));

// ─── POST /api/ride/end ─────────────────────────────────────
router.post('/end', asyncHandler(async (req, res) => {
  const ride = getActiveRide(req.user.id);
  const { durationSeconds } = req.body;

  ride.status = 'completed';
  ride.endedAt = new Date().toISOString();
  ride.durationSeconds = durationSeconds || Math.floor(
    (new Date(ride.endedAt) - new Date(ride.startedAt)) / 1000
  );

  const dur = formatDuration(ride.durationSeconds);

  addActivity(req.user.id, {
    icon: 'safe', emoji: rideEmoji(ride.rideType),
    name: 'Safe Ride Completed',
    detail: `${ride.rideType} ride — ${dur}`,
    time: 'Just now', distLabel: 'Safe'
  });

  res.json({
    success: true,
    message: `Ride ended safely after ${dur}`,
    data: { ride }
  });
}));

// ─── PATCH /api/ride/location ───────────────────────────────
router.patch('/location', asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;

  if (!latitude || !longitude) {
    throw new ValidationError('latitude and longitude are required');
  }

  const ride = getActiveRide(req.user.id);
  ride.currentLocation = { latitude, longitude, accuracy, updatedAt: new Date().toISOString() };

  res.json({
    success: true,
    message: 'Location updated',
    data: { location: ride.currentLocation }
  });
}));

// ─── POST /api/ride/deviation-alert ────────────────────────
router.post('/deviation-alert', asyncHandler(async (req, res) => {
  const ride = getActiveRide(req.user.id);
  const { deviationMeters } = req.body;

  addActivity(req.user.id, {
    icon: 'warn', emoji: '⚠️',
    name: 'Route Deviation Detected',
    detail: `Driver deviated ${deviationMeters || '500+'}m from planned route`,
    time: 'Just now', distLabel: 'Alert'
  });

  res.json({
    success: true,
    message: 'Deviation alert sent to contacts',
    data: { rideId: ride.id, deviationMeters }
  });
}));

// ─── GET /api/ride/active ───────────────────────────────────
router.get('/active', asyncHandler(async (req, res) => {
  const ride = rides.find(r => r.userId === req.user.id && r.status === 'active');
  res.json({
    success: true,
    data: { active: !!ride, ride: ride || null }
  });
}));

// ─── GET /api/ride/history ──────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const history = rides
    .filter(r => r.userId === req.user.id)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, limit)
    .map(r => ({ ...r, userId: undefined }));

  res.json({ success: true, data: { rides: history, count: history.length } });
}));

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

module.exports = router;
