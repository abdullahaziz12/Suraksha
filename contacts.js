const express = require('express');
const router = express.Router();

const { asyncHandler, NotFoundError, ValidationError, ConflictError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { required, isPhone, maxLength, sanitizeString } = require('../middleware/validate');
const { contacts, getContactsByUserId, addActivity, getNextColor, uuidv4 } = require('../models/store');

// All contact routes require authentication
router.use(authenticate);

// ─── GET /api/contacts ──────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const userContacts = getContactsByUserId(req.user.id);
  res.json({
    success: true,
    data: { contacts: userContacts, count: userContacts.length }
  });
}));

// ─── POST /api/contacts ─────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  let { name, relation, phone, primary } = req.body;

  required(name,  'name');
  required(phone, 'phone');
  maxLength(name, 60, 'name');
  isPhone(phone);
  name     = sanitizeString(name);
  phone    = sanitizeString(phone);
  relation = relation ? sanitizeString(relation) : 'Contact';

  const userContacts = getContactsByUserId(req.user.id);

  // Max 10 emergency contacts
  if (userContacts.length >= 10) {
    throw new ValidationError('You can have a maximum of 10 emergency contacts');
  }

  // Duplicate phone check
  if (userContacts.some(c => c.phone === phone)) {
    throw new ConflictError('A contact with this phone number already exists');
  }

  // If primary requested, unset existing primary
  if (primary) {
    userContacts.forEach(c => { c.primary = false; });
  }

  const contact = {
    id: uuidv4(),
    userId: req.user.id,
    name, relation, phone,
    color: getNextColor(req.user.id),
    primary: !!primary,
    smsAlertsOn: true,
    createdAt: new Date().toISOString()
  };

  contacts.push(contact);

  addActivity(req.user.id, {
    icon: 'safe', emoji: '👤',
    name: 'Contact Added',
    detail: `${name} added as emergency contact`,
    time: 'Just now', distLabel: 'Safe'
  });

  res.status(201).json({
    success: true,
    message: `${name} added as emergency contact`,
    data: { contact }
  });
}));

// ─── PUT /api/contacts/:id ──────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  let { name, relation, phone, primary, smsAlertsOn } = req.body;

  if (name !== undefined) {
    required(name, 'name');
    maxLength(name, 60, 'name');
    contact.name = sanitizeString(name);
  }
  if (relation !== undefined) contact.relation = sanitizeString(relation);
  if (phone !== undefined) {
    isPhone(phone, 'phone');
    // Check for duplicate (excluding self)
    const userContacts = getContactsByUserId(req.user.id);
    if (userContacts.some(c => c.phone === phone && c.id !== contact.id)) {
      throw new ConflictError('Another contact already has this phone number');
    }
    contact.phone = sanitizeString(phone);
  }
  if (primary !== undefined) {
    if (primary) {
      getContactsByUserId(req.user.id).forEach(c => { c.primary = false; });
    }
    contact.primary = !!primary;
  }
  if (smsAlertsOn !== undefined) contact.smsAlertsOn = !!smsAlertsOn;

  res.json({
    success: true,
    message: 'Contact updated',
    data: { contact }
  });
}));

// ─── DELETE /api/contacts/:id ───────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  const idx = contacts.indexOf(contact);
  contacts.splice(idx, 1);

  addActivity(req.user.id, {
    icon: 'info', emoji: '🗑️',
    name: 'Contact Removed',
    detail: `${contact.name} removed from emergency contacts`,
    time: 'Just now', distLabel: 'Info'
  });

  res.json({ success: true, message: `${contact.name} removed from emergency contacts` });
}));

// ─── POST /api/contacts/:id/set-primary ────────────────────
router.post('/:id/set-primary', asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  getContactsByUserId(req.user.id).forEach(c => { c.primary = false; });
  contact.primary = true;

  res.json({
    success: true,
    message: `${contact.name} is now your primary emergency contact`,
    data: { contact }
  });
}));

// ─── POST /api/contacts/:id/share-location ─────────────────
router.post('/:id/share-location', asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);

  addActivity(req.user.id, {
    icon: 'safe', emoji: '📍',
    name: 'Location Shared',
    detail: `Live location sent to ${contact.name}`,
    time: 'Just now', distLabel: 'Safe'
  });

  res.json({
    success: true,
    message: `Location shared with ${contact.name}`,
    data: { simulated: true, contact: contact.name }
  });
}));

// ─── POST /api/contacts/:id/send-message ───────────────────
router.post('/:id/send-message', asyncHandler(async (req, res) => {
  const contact = findOwnedContact(req.params.id, req.user.id);
  const { message } = req.body;

  res.json({
    success: true,
    message: `Message sent to ${contact.name}`,
    data: { simulated: true, contact: contact.name, message: message || 'I am safe.' }
  });
}));

// ─── Helper ────────────────────────────────────────────────
function findOwnedContact(id, userId) {
  const contact = contacts.find(c => c.id === id && c.userId === userId);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}

module.exports = router;
