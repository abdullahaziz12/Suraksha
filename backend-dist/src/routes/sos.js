/**
 * SOS Routes
 * Emergency alert triggering and management
 */

const express = require('express');
const router = express.Router();

const {
  asyncHandler,
  NotFoundError,
  ValidationError
} = require('../middleware/errorHandler');

const { authenticate } = require('../middleware/auth');
const { sosLimiter } = require('../middleware/rateLimiter');
const { sendSms, isSmsConfigured, buildMapLink } = require('../services/sms');
const { encryptText } = require('../services/chatCrypto');

const { sosEvents, addActivity, getContactsByUserId, addSosEvent, addChatMessage } = require('../models/store');
const { addNotification } = require('../models/store');

router.use(authenticate);

// ──────────────────────────────────────────────────────────
// POST /api/sos/trigger - Trigger SOS alert
// ──────────────────────────────────────────────────────────
router.post('/trigger', sosLimiter, asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, source = 'manual', accuracy } = req.body;

    const latitudeNum = Number(latitude);
    const longitudeNum = Number(longitude);
    const hasLocation = Number.isFinite(latitudeNum) && Number.isFinite(longitudeNum);
    const locationLink = hasLocation ? buildMapLink(latitudeNum, longitudeNum) : '';
    const timestamp = new Date().toISOString();
    const smsConfigured = isSmsConfigured();

    // Build alert payload
    const contacts = getContactsByUserId(req.user.id);
    const smsContacts = contacts.filter(c => c.smsAlertsOn);

    if (!smsContacts.length) {
      throw new ValidationError('No emergency contacts are enabled for SMS alerts');
    }

    const smsText = [
      `SOS ALERT from ${req.user.name || 'Suraksha user'}.`,
      `Possible emergency detected via ${source}.`,
      hasLocation ? `Location: ${locationLink}` : 'Location unavailable.',
      `Time: ${timestamp}`
    ].join(' ');

    const deliveryResults = await Promise.all(smsContacts.map(async (contact) => {
      if (!smsConfigured) {
        return {
          name: contact.name,
          phone: contact.phone,
          notified: false,
          providerMessageId: null,
          error: 'SMS service not configured'
        };
      }

      const smsResult = await sendSms({
        to: contact.phone,
        body: smsText
      });

      return {
        name: contact.name,
        phone: contact.phone,
        notified: smsResult.ok,
        providerMessageId: smsResult.sid || null,
        error: smsResult.ok ? null : smsResult.error
      };
    }));

    const sentCount = deliveryResults.filter(item => item.notified).length;
    const failedCount = deliveryResults.length - sentCount;

    const alertedContacts = deliveryResults;

    // Create SOS event
    const event = addSosEvent(req.user.id, {
      status: 'active',
      source, // 'manual' | 'gyroscope' | 'triple_tap' | 'ride_deviation'
      location: hasLocation
        ? { latitude: latitudeNum, longitude: longitudeNum, accuracy }
        : null,
      alertedContacts,
      authorities: ['Police 15', 'Rescue 1122', 'Helpline 1098']
    });

    // Log activity
    addActivity(req.user.id, {
      icon: 'sos',
      emoji: '🆘',
      name: 'SOS Alert Triggered',
      detail: `${sentCount}/${alertedContacts.length} contact(s) alerted by SMS`,
      time: 'Just now',
      distLabel: 'LIVE'
    });

    addNotification(req.user.id, {
      type: failedCount === 0 ? 'sos' : 'warn',
      title: 'SOS Triggered',
      message: failedCount === 0
        ? `Emergency alerts sent to ${sentCount} contact(s)`
        : `Partial delivery: ${sentCount}/${alertedContacts.length} contact(s) received SMS`
    });

    addChatMessage(req.user.id, {
      type: 'text',
      senderRole: 'system',
      senderName: 'Suraksha SOS',
      encryptedText: encryptText(
        hasLocation
          ? `SOS triggered via ${source}. Live location: ${locationLink}. Time: ${timestamp}`
          : `SOS triggered via ${source}. Location unavailable. Time: ${timestamp}`
      ),
      meta: {
        kind: 'sos',
        source,
        latitude: hasLocation ? latitudeNum : null,
        longitude: hasLocation ? longitudeNum : null,
        locationLink: hasLocation ? locationLink : null,
        smsConfigured
      }
    });

    res.status(201).json({
      success: true,
      message: failedCount === 0
        ? 'SOS triggered in real time. SMS alerts sent to all emergency contacts and trustee chat updated'
        : `SOS triggered in real time. SMS sent to ${sentCount}/${alertedContacts.length} contact(s); trustee chat updated`,
      data: {
        eventId: event.id,
        alertedContacts,
        deliverySummary: {
          total: alertedContacts.length,
          sent: sentCount,
          failed: failedCount,
          configured: smsConfigured
        },
        authorities: event.authorities,
        timestamp: event.createdAt
      }
    });
  } catch (err) {
    console.error('[ERROR] SOS trigger failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// POST /api/sos/cancel - Cancel active SOS alert
// ──────────────────────────────────────────────────────────
router.post('/cancel', asyncHandler(async (req, res) => {
  try {
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
      icon: 'safe',
      emoji: '✅',
      name: 'SOS Cancelled',
      detail: 'Emergency alert cancelled — user safe',
      time: 'Just now',
      distLabel: 'Safe'
    });

    addNotification(req.user.id, {
      type: 'safe',
      title: 'SOS Cancelled',
      message: 'Emergency status cleared. You are marked safe.'
    });

    res.json({
      success: true,
      message: 'SOS cancelled — you are marked safe',
      data: { event: event || null }
    });
  } catch (err) {
    console.error('[ERROR] SOS cancel failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// POST /api/sos/all-safe - Mark all SOS as resolved
// ──────────────────────────────────────────────────────────
router.post('/all-safe', asyncHandler(async (req, res) => {
  try {
    // Mark all active SOS events for this user as resolved
    sosEvents
      .filter(e => e.userId === req.user.id && e.status === 'active')
      .forEach(e => {
        e.status = 'resolved';
        e.resolvedAt = new Date().toISOString();
      });

    addActivity(req.user.id, {
      icon: 'safe',
      emoji: '🛡️',
      name: 'All Clear',
      detail: 'All emergency alerts resolved — user safe',
      time: 'Just now',
      distLabel: 'Safe'
    });

    addNotification(req.user.id, {
      type: 'safe',
      title: 'All Clear Sent',
      message: 'All active emergency alerts have been resolved.'
    });

    res.json({
      success: true,
      message: 'All clear sent — you are marked safe'
    });
  } catch (err) {
    console.error('[ERROR] All safe failed:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/sos/active - Get active SOS event
// ──────────────────────────────────────────────────────────
router.get('/active', asyncHandler(async (req, res) => {
  try {
    const activeEvent = sosEvents.find(e => e.userId === req.user.id && e.status === 'active');
    res.json({
      success: true,
      data: {
        active: !!activeEvent,
        event: activeEvent ? { ...activeEvent, userId: undefined } : null
      }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get active SOS:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// GET /api/sos/history - Get SOS event history
// ──────────────────────────────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const events = sosEvents
      .filter(e => e.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(e => ({ ...e, userId: undefined }));

    res.json({
      success: true,
      data: { events, count: events.length }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get SOS history:', err.message);
    throw err;
  }
}));

module.exports = router;
