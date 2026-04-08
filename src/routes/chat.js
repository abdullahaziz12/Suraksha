/**
 * Trustee Chat Routes
 * Encrypted in-app emergency chat room with optional live-location messages.
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { encryptText, decryptText } = require('../services/chatCrypto');
const { sendSms, isSmsConfigured, buildMapLink } = require('../services/sms');

const {
  getOrCreateTrusteeRoom,
  getChatMessagesByUserId,
  addChatMessage,
  subscribeToChat,
  getContactsByUserId,
  addNotification,
  addActivity
} = require('../models/store');

router.use(authenticate);

function serializeMessage(msg) {
  return {
    id: msg.id,
    roomId: msg.roomId,
    type: msg.type,
    senderRole: msg.senderRole,
    senderName: msg.senderName,
    text: decryptText(msg.encryptedText),
    meta: msg.meta || {},
    createdAt: msg.createdAt
  };
}

// GET /api/chat/room
router.get('/room', asyncHandler(async (req, res) => {
  const room = getOrCreateTrusteeRoom(req.user.id);
  res.json({
    success: true,
    data: { room }
  });
}));

// GET /api/chat/messages
router.get('/messages', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);
  const messages = getChatMessagesByUserId(req.user.id, limit).map(serializeMessage);

  res.json({
    success: true,
    data: {
      messages,
      count: messages.length
    }
  });
}));

// GET /api/chat/stream (SSE)
router.get('/stream', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, timestamp: new Date().toISOString() })}\n\n`);

  const listener = (message) => {
    const payload = serializeMessage(message);
    res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const unsubscribe = subscribeToChat(req.user.id, listener);

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}));

// POST /api/chat/messages
router.post('/messages', asyncHandler(async (req, res) => {
  const {
    type = 'text',
    message,
    latitude,
    longitude,
    shareToContacts = false,
    source = 'chat'
  } = req.body;

  if (!['text', 'location'].includes(type)) {
    throw new ValidationError('type must be either text or location');
  }

  let text = '';
  const meta = { source };

  if (type === 'text') {
    if (!message || !String(message).trim()) {
      throw new ValidationError('message is required for text chat');
    }
    text = String(message).trim();
  } else {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ValidationError('Valid latitude and longitude are required for location message');
    }

    const mapLink = buildMapLink(lat, lng);
    text = `Shared live location: ${mapLink}`;
    meta.latitude = lat;
    meta.longitude = lng;
    meta.mapLink = mapLink;
  }

  const stored = addChatMessage(req.user.id, {
    type,
    senderRole: 'user',
    senderName: req.user.name || 'You',
    encryptedText: encryptText(text),
    meta
  });

  let smsSummary = null;
  if (shareToContacts) {
    const smsContacts = getContactsByUserId(req.user.id).filter(c => c.smsAlertsOn);

    if (smsContacts.length) {
      if (isSmsConfigured()) {
        const smsResults = await Promise.all(smsContacts.map(async (contact) => {
          const result = await sendSms({ to: contact.phone, body: text });
          return {
            name: contact.name,
            phone: contact.phone,
            notified: result.ok,
            providerMessageId: result.sid || null,
            error: result.ok ? null : result.error
          };
        }));

        const sent = smsResults.filter(r => r.notified).length;
        smsSummary = {
          attempted: smsResults.length,
          sent,
          failed: smsResults.length - sent,
          configured: true
        };
      } else {
        smsSummary = {
          attempted: smsContacts.length,
          sent: 0,
          failed: smsContacts.length,
          configured: false,
          error: 'SMS service not configured'
        };
      }
    }
  }

  addNotification(req.user.id, {
    type: 'info',
    title: type === 'location' ? 'Live Location Shared' : 'Message Sent',
    message: type === 'location'
      ? 'Your live location was posted to trustee chat room.'
      : 'Your message was posted to trustee chat room.'
  });

  addActivity(req.user.id, {
    icon: 'safe',
    emoji: type === 'location' ? '📍' : '💬',
    name: type === 'location' ? 'Location Shared in Chat' : 'Chat Message Sent',
    detail: shareToContacts ? 'Posted in trustee chat and shared to contacts' : 'Posted in trustee chat room',
    time: 'Just now',
    distLabel: 'Info'
  });

  res.status(201).json({
    success: true,
    message: shareToContacts
      ? 'Message posted in trustee chat and forwarded to contacts'
      : 'Message posted in trustee chat room',
    data: {
      messageItem: serializeMessage(stored),
      smsSummary
    }
  });
}));

module.exports = router;
