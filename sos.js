const express = require('express');
const router = express.Router();

const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { sosLimiter } = require('../middleware/rateLimiter');
const { sosEvents, addSosEvent, getContactsByUserId, addActivity } = require('../models/store');

router.use(authenticate);

// ─── POST /api/sos/trigger ──────────────────────────────────
router.post('/trigger', sosLimiter, asyncHandler(async (req, res) => {
  const { latitude, longitude, source = 'manual', accuracy } = req.body;

  // Build alert payload
  const contacts = getContactsByUserId(req.user.id);
  const alertedContacts = contacts.filter(c => c.smsAlertsOn).map(c => ({
    name: c.name,
    phone: c.phone,
    notified: true
  }));

  const event = addSosEvent(req.user.id, {
    status: 'active',
    source,          // 'manual' | 'gyroscope' | 'triple_tap' | 'ride_deviation'
    location: latitude && longitude ? { latitude, longitude, accuracy } : null,
    alertedContacts,
    authorities: ['Police 15', 'Rescue 1122', 'Helpline 1098']
  });

  addActivity(req.user.id, {
    icon: 'sos', emoji: '🆘',
    name: 'SOS Alert Triggered',
    detail: `Police, Rescue, and ${alertedContacts.length} contact(s) alerted`,
    time: 'Just now', distLabel: 'LIVE'
  });

  res.status(201).json({
    success: true,
    message: 'SOS triggered — all contacts and authorities alerted',
    data: {
      eventId: event.id,
      alertedContacts,
      authorities: event.authorities,
      timestamp: event.createdAt
    }
  });
}));

// ─── POST /api/sos/cancel ───────────────────────────────────
router.post('/cancel', asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  // Find the active SOS event for this user
  let event;
  if (eventId) {
    event = sosEvents.find(e => e.id === eventId && e.userId === req.user.id);
    if (!event) throw new NotFoundError('SOS event');
  } else {
    event = sosEvents.find(e => e.userId === req.user.id && e.status === 'active');
  }

  if (event) {
    event.status = 'cancelled';
    event.cancelledAt = new Date().toISOString();
  }

  addActivity(req.user.id, {
    icon: 'safe', emoji: '✅',
    name: 'SOS Cancelled',
    detail: 'Emergency alert cancelled — user safe',
    time: 'Just now', distLabel: 'Safe'
  });

  res.json({
    success: true,
    message: 'SOS cancelled — you are marked safe',
    data: { event: event || null }
  });
}));

// ─── POST /api/sos/all-safe ─────────────────────────────────
router.post('/all-safe', asyncHandler(async (req, res) => {
  // Mark all active SOS events for this user as resolved
  sosEvents
    .filter(e => e.userId === req.user.id && e.status === 'active')
    .forEach(e => {
      e.status = 'resolved';
      e.resolvedAt = new Date().toISOString();
    });

  addActivity(req.user.id, {
    icon: 'safe', emoji: '🛡️',
    name: 'All Clear',
    detail: 'All emergency alerts resolved — user safe',
    time: 'Just now', distLabel: 'Safe'
  });

  res.json({ success: true, message: 'All clear sent — you are marked safe' });
}));

// ─── GET /api/sos/history ───────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const events = sosEvents
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(e => ({ ...e, userId: undefined })); // strip userId from response

  res.json({ success: true, data: { events, count: events.length } });
}));

// ─── GET /api/sos/active ────────────────────────────────────
router.get('/active', asyncHandler(async (req, res) => {
  const activeEvent = sosEvents.find(e => e.userId === req.user.id && e.status === 'active');
  res.json({
    success: true,
    data: { active: !!activeEvent, event: activeEvent ? { ...activeEvent, userId: undefined } : null }
  });
}));

module.exports = router;
