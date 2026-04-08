/**
 * Contacts Routes
 * Emergency contact management
 */

const express = require('express');
const router = express.Router();

const {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ConflictError
} = require('../middleware/errorHandler');

const { authenticate } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendSms, isSmsConfigured, buildMapLink } = require('../services/sms');
const { encryptText } = require('../services/chatCrypto');

const {
  required,
  isPhone,
  isPakistanPhone,
  maxLength,
  sanitizeString,
  sanitizePhone,
  normalizePakistanPhone
} = require('../middleware/validate');

const {
  contacts,
  getContactsByUserId,
  addActivity,
  addNotification,
  addChatMessage,
  getNextColor,
  locationHistory,
  uuidv4
} = require('../models/store');
const { findUserByPhone } = require('../repositories/userRepo');

// ─── Helper ────────────────────────────────────────────────
function findOwnedContact(id, userId) {
  const contact = contacts.find(c => c.id === id && c.userId === userId);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}

async function resolveContactUserId(phone, senderUserId) {
  const linkedUser = await findUserByPhone(phone);
  if (!linkedUser) return null;
  if (linkedUser.id === senderUserId) return null;
  return linkedUser.id;
}

async function ensureLinkedContactUserId(contact, senderUserId) {
  const resolvedId = await resolveContactUserId(contact.phone, senderUserId);
  contact.contactUserId = resolvedId;
  return resolvedId;
}

function mirrorMessageToRecipientChat(recipientUserId, senderName, encryptedText, meta, type = 'text') {
  if (!recipientUserId) return;

  addChatMessage(recipientUserId, {
    type,
    senderRole: 'contact',
    senderName,
    encryptedText,
    meta
  });

  addNotification(recipientUserId, {
    type: 'info',
    title: type === 'location' ? 'Live Location Received' : 'New Contact Message',
    message: `${senderName} sent you ${type === 'location' ? 'a live location update' : 'a chat message'}.`
  });
}

router.use(authenticate);

// ──────────────────────────────────────────────────────────
// GET /api/contacts - Get all emergency contacts
// ──────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  try {
    const userContacts = getContactsByUserId(req.user.id);
    res.json({
      success: true,
      data: { contacts: userContacts, count: userContacts.length }
    });
  } catch (err) {
    console.error('[ERROR] Failed to fetch contacts:', err.message);
    throw err;
  }
}));

// ──────────────────────────────────────────────────────────
// POST /api/contacts - Add new emergency contact
// ──────────────────────────────────────────────────────────
router.post('/', contactLimiter, asyncHandler(async (req, res) => {
  let { name, relation, phone, primary } = req.body;

  // Validate inputs
  try {
    required(name, 'name');
    required(phone, 'phone');
    maxLength(name, 60, 'name');
    isPhone(phone);
    isPakistanPhone(phone);
  } catch (err) {
    throw err;
  }

  // Sanitize inputs
  name = sanitizeString(name);
  phone = normalizePakistanPhone(phone);
  relation = relation ? sanitizeString(relation) : 'Contact';

  // Get user's existing contacts
  const userContacts = getContactsByUserId(req.user.id);

  // Check limit
  if (userContacts.length >= 10) {
    throw new ValidationError('You can have a maximum of 10 emergency contacts');
  }

  // Check for duplicate phone
  if (userContacts.some(c => c.phone === phone)) {
    throw new ConflictError('A contact with this phone number already exists');
  }

  // If setting as primary, unset existing primary
  if (primary) {
    userContacts.forEach(c => { c.primary = false; });
  }

  // Create contact
  const contact = {
    id: uuidv4(),
    userId: req.user.id,
    name,
    relation,
    phone,
    contactUserId: await resolveContactUserId(phone, req.user.id),
    color: getNextColor(req.user.id),
    primary: !!primary,
    smsAlertsOn: true,
    createdAt: new Date().toISOString()
  };

  contacts.push(contact);

  addActivity(req.user.id, {
    icon: 'safe',
    emoji: '👤',
    name: 'Contact Added',
    detail: `${name} added as emergency contact`,
    time: 'Just now',
    distLabel: 'Safe'
  });

  addNotification(req.user.id, {
    type: 'info',
    title: 'Contact Added',
    message: `${name} was added to your emergency contacts.`
  });

  res.status(201).json({
    success: true,
    message: `${name} added as emergency contact`,
    data: { contact }
  });
}));

// ──────────────────────────────────────────────────────────
// PUT /api/contacts/:id - Update emergency contact
// ──────────────────────────────────────────────────────────
router.put('/:id', contactLimiter, asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  let { name, relation, phone, primary, smsAlertsOn } = req.body;

  // Validate and update name
  if (name !== undefined) {
    try {
      required(name, 'name');
      maxLength(name, 60, 'name');
      contact.name = sanitizeString(name);
    } catch (err) {
      throw err;
    }
  }

  // Update relation
  if (relation !== undefined) {
    contact.relation = sanitizeString(relation);
  }

  // Validate and update phone
  if (phone !== undefined) {
    try {
      isPhone(phone);
      isPakistanPhone(phone);
      const normalizedPhone = normalizePakistanPhone(phone);
      // Check for duplicate (excluding self)
      const userContacts = getContactsByUserId(req.user.id);
      if (userContacts.some(c => c.phone === normalizedPhone && c.id !== contact.id)) {
        throw new ConflictError('Another contact already has this phone number');
      }
      contact.phone = normalizedPhone;
      contact.contactUserId = await resolveContactUserId(contact.phone, req.user.id);
    } catch (err) {
      throw err;
    }
  }

  // Update primary status
  if (primary !== undefined) {
    if (primary) {
      getContactsByUserId(req.user.id).forEach(c => { c.primary = false; });
    }
    contact.primary = !!primary;
  }

  // Update SMS alerts
  if (smsAlertsOn !== undefined) {
    contact.smsAlertsOn = !!smsAlertsOn;
  }

  res.json({
    success: true,
    message: 'Contact updated successfully',
    data: { contact }
  });
}));

// ──────────────────────────────────────────────────────────
// DELETE /api/contacts/:id - Remove emergency contact
// ──────────────────────────────────────────────────────────
router.delete('/:id', contactLimiter, asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  const idx = contacts.indexOf(contact);
  contacts.splice(idx, 1);

  addActivity(req.user.id, {
    icon: 'info',
    emoji: '🗑️',
    name: 'Contact Removed',
    detail: `${contact.name} removed from emergency contacts`,
    time: 'Just now',
    distLabel: 'Info'
  });

  addNotification(req.user.id, {
    type: 'warn',
    title: 'Contact Removed',
    message: `${contact.name} was removed from emergency contacts.`
  });

  res.json({
    success: true,
    message: `${contact.name} removed from emergency contacts`
  });
}));

// ──────────────────────────────────────────────────────────
// POST /api/contacts/:id/set-primary - Set as primary contact
// ──────────────────────────────────────────────────────────
router.post('/:id/set-primary', contactLimiter, asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  getContactsByUserId(req.user.id).forEach(c => { c.primary = false; });
  contact.primary = true;

  res.json({
    success: true,
    message: `${contact.name} is now your primary emergency contact`,
    data: { contact }
  });
}));

// ──────────────────────────────────────────────────────────
// POST /api/contacts/:id/share-location - Share location
// ──────────────────────────────────────────────────────────
router.post('/:id/share-location', contactLimiter, asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  const recipientUserId = await ensureLinkedContactUserId(contact, req.user.id);
  const smsConfigured = isSmsConfigured();

  const latestLocation = locationHistory.find(l => l.userId === req.user.id);
  const locationLink = latestLocation
    ? buildMapLink(Number(latestLocation.latitude), Number(latestLocation.longitude))
    : '';

  const smsText = [
    `${req.user.name || 'Your contact'} shared their live location with you from Suraksha.`,
    locationLink ? `Location: ${locationLink}` : 'Location unavailable right now.',
    `Time: ${new Date().toISOString()}`
  ].join(' ');

  const smsResult = smsConfigured
    ? await sendSms({ to: contact.phone, body: smsText })
    : { ok: false, error: 'SMS service not configured', sid: null };

  addActivity(req.user.id, {
    icon: 'safe',
    emoji: '📍',
    name: 'Location Shared',
    detail: smsResult.ok
      ? `Live location sent to ${contact.name}`
      : `Location posted in trustee chat; SMS failed for ${contact.name}`,
    time: 'Just now',
    distLabel: 'Safe'
  });

  addChatMessage(req.user.id, {
    type: 'location',
    senderRole: 'user',
    senderName: req.user.name || 'You',
    encryptedText: encryptText(smsText),
    meta: {
      contactName: contact.name,
      contactUserId: recipientUserId,
      mapLink: locationLink || null,
      smsConfigured,
      smsDelivered: smsResult.ok
    }
  });

  mirrorMessageToRecipientChat(
    recipientUserId,
    req.user.name || 'Your contact',
    encryptText(smsText),
    {
      contactName: req.user.name || 'Suraksha user',
      contactUserId: req.user.id,
      mapLink: locationLink || null,
      incoming: true
    },
    'location'
  );

  res.json({
    success: true,
    message: smsResult.ok
      ? `Location shared with ${contact.name} and trustee chat`
      : `Location posted in trustee chat; SMS failed for ${contact.name}`,
    data: {
      simulated: false,
      contact: contact.name,
      providerMessageId: smsResult.sid || null,
      smsConfigured,
      smsDelivered: smsResult.ok,
      smsError: smsResult.ok ? null : smsResult.error
    }
  });

  addNotification(req.user.id, {
    type: 'info',
    title: 'Location Shared',
    message: `Live location shared with ${contact.name}.`
  });
}));

// ──────────────────────────────────────────────────────────
// POST /api/contacts/:id/send-message - Send message to contact
// ──────────────────────────────────────────────────────────
router.post('/:id/send-message', contactLimiter, asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  const recipientUserId = await ensureLinkedContactUserId(contact, req.user.id);
  const { message } = req.body;
  const smsConfigured = isSmsConfigured();

  const text = message || 'I am safe.';

  const smsResult = smsConfigured
    ? await sendSms({
      to: contact.phone,
      body: text
    })
    : { ok: false, error: 'SMS service not configured', sid: null };

  addChatMessage(req.user.id, {
    type: 'text',
    senderRole: 'user',
    senderName: req.user.name || 'You',
    encryptedText: encryptText(text),
    meta: {
      contactName: contact.name,
      contactUserId: recipientUserId,
      smsConfigured,
      smsDelivered: smsResult.ok
    }
  });

  mirrorMessageToRecipientChat(
    recipientUserId,
    req.user.name || 'Your contact',
    encryptText(text),
    {
      contactName: req.user.name || 'Suraksha user',
      contactUserId: req.user.id,
      incoming: true
    },
    'text'
  );

  res.json({
    success: true,
    message: smsResult.ok
      ? `Message sent to ${contact.name} and trustee chat`
      : `Message posted in trustee chat; SMS failed for ${contact.name}`,
    data: {
      simulated: false,
      contact: contact.name,
      message: text,
      providerMessageId: smsResult.sid || null,
      smsConfigured,
      smsDelivered: smsResult.ok,
      smsError: smsResult.ok ? null : smsResult.error
    }
  });

  addNotification(req.user.id, {
    type: 'info',
    title: 'Message Sent',
    message: `Emergency message sent to ${contact.name}.`
  });
}));

module.exports = router;
