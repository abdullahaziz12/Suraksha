/**
 * Suraksha In-Memory Data Store
 * Acts as the database for this demo backend.
 * In production, replace with a real DB (MongoDB / PostgreSQL).
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── Users ─────────────────────────────────────────────────
const users = [
  {
    id: 'user-001',
    name: 'Aisha Khan',
    email: 'aisha@suraksha.app',
    passwordHash: bcrypt.hashSync('password123', 10),
    phone: '+92 300 000 0001',
    avatar: 'A',
    protectionEnabled: true,
    sosCountdownSeconds: 5,
    settings: {
      gyroscopeEnabled: true,
      gpsEnabled: true,
      tripleTapEnabled: true,
      alertSound: true,
      vibration: true,
      autoSmsLocation: true,
      incognitoTracking: false,
      endToEndEncryption: true,
      dataRetention30Days: true,
      shareLiveRoute: true,
      arrivalAlert: true,
      deviationAlert: true,
      tripleTapSilent: true,
      tripleTapSpeed: 'fast',
      sensitivityLevel: 'high',
      shakeAlert: true,
      fallDetection: true,
      loudImpact: true,
      backgroundMonitoring: true,
    }
  }
];

// ─── Contacts ──────────────────────────────────────────────
const contacts = [
  { id: uuidv4(), userId: 'user-001', name: 'Sara Ahmed',  relation: 'Sister', phone: '+92 300 111 2233', color: 'c1', primary: true,  smsAlertsOn: true,  createdAt: new Date().toISOString() },
  { id: uuidv4(), userId: 'user-001', name: 'Mama Fatima', relation: 'Mother', phone: '+92 321 555 6677', color: 'c2', primary: false, smsAlertsOn: true,  createdAt: new Date().toISOString() },
  { id: uuidv4(), userId: 'user-001', name: 'Nadia Malik', relation: 'Friend', phone: '+92 333 987 6543', color: 'c3', primary: false, smsAlertsOn: true,  createdAt: new Date().toISOString() },
];

// ─── SOS Events ────────────────────────────────────────────
const sosEvents = [];

// ─── Rides ─────────────────────────────────────────────────
const rides = [];

// ─── Location History ──────────────────────────────────────
const locationHistory = [];

// ─── Activity Feed ─────────────────────────────────────────
const activityFeed = [
  { id: uuidv4(), userId: 'user-001', icon: 'safe', emoji: '📍', name: 'App Started',    detail: 'Suraksha protection active',           time: '5m ago',  distLabel: 'Safe', createdAt: new Date().toISOString() },
  { id: uuidv4(), userId: 'user-001', icon: 'safe', emoji: '🛡️', name: 'Shield Enabled', detail: 'All monitors running',                 time: '10m ago', distLabel: 'Safe', createdAt: new Date().toISOString() },
];

// ─── Active Sessions (JWT tokens invalidation list) ────────
const revokedTokens = new Set();

// ─── Helper utilities ──────────────────────────────────────
const avatarColors = ['c1', 'c2', 'c3', 'c4', 'c5'];

function getUserById(id) {
  return users.find(u => u.id === id) || null;
}
function getUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}
function getContactsByUserId(userId) {
  return contacts.filter(c => c.userId === userId);
}
function getActivitiesByUserId(userId, limit = 20) {
  return activityFeed
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
function addActivity(userId, item) {
  const entry = {
    id: uuidv4(),
    userId,
    ...item,
    createdAt: new Date().toISOString()
  };
  activityFeed.unshift(entry);
  // Keep only last 100 entries per user
  const userEntries = activityFeed.filter(a => a.userId === userId);
  if (userEntries.length > 100) {
    const oldest = userEntries[userEntries.length - 1];
    const idx = activityFeed.indexOf(oldest);
    if (idx !== -1) activityFeed.splice(idx, 1);
  }
  return entry;
}
function addSosEvent(userId, data) {
  const event = { id: uuidv4(), userId, ...data, createdAt: new Date().toISOString() };
  sosEvents.unshift(event);
  return event;
}
function getNextColor(userId) {
  const existing = contacts.filter(c => c.userId === userId);
  return avatarColors[existing.length % avatarColors.length];
}

module.exports = {
  users, contacts, sosEvents, rides, locationHistory, activityFeed, revokedTokens,
  getUserById, getUserByEmail, getContactsByUserId, getActivitiesByUserId,
  addActivity, addSosEvent, getNextColor,
  uuidv4
};
