/**
 * Suraksha In-Memory Data Store
 * 
 * This serves as the database for the demo backend.
 * In production, replace with a real database (MongoDB, PostgreSQL, etc.)
 * 
 * Features:
 * - User management with hashed passwords
 * - Emergency contacts with SMS alert tracking
 * - SOS event history and logging
 * - Ride tracking and navigation monitoring
 * - Location history for safety analysis
 * - Activity feed for user events
 * - Token revocation for logout
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { EventEmitter } = require('events');

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
    createdAt: new Date().toISOString(),
    settings: {
      // Device features
      gyroscopeEnabled: true,
      gpsEnabled: true,
      tripleTapEnabled: true,
      
      // Notifications
      alertSound: true,
      vibration: true,
      autoSmsLocation: true,
      
      // Privacy & Security
      incognitoTracking: false,
      endToEndEncryption: true,
      dataRetention30Days: true,
      
      // Ride Safety
      shareLiveRoute: true,
      arrivalAlert: true,
      deviationAlert: true,
      
      // Gesture Detection
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
  {
    id: uuidv4(),
    userId: 'user-001',
    name: 'Sara Ahmed',
    relation: 'Sister',
    phone: '+92 300 111 2233',
    color: 'c1',
    primary: true,
    smsAlertsOn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: uuidv4(),
    userId: 'user-001',
    name: 'Mama Fatima',
    relation: 'Mother',
    phone: '+92 321 555 6677',
    color: 'c2',
    primary: false,
    smsAlertsOn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: uuidv4(),
    userId: 'user-001',
    name: 'Nadia Malik',
    relation: 'Friend',
    phone: '+92 333 987 6543',
    color: 'c3',
    primary: false,
    smsAlertsOn: true,
    createdAt: new Date().toISOString()
  },
];

// ─── SOS Events ────────────────────────────────────────────
const sosEvents = [];

// ─── Rides ─────────────────────────────────────────────────
const rides = [];

// ─── Location History ──────────────────────────────────────
const locationHistory = [];

// ─── Activity Feed ─────────────────────────────────────────
const activityFeed = [
  {
    id: uuidv4(),
    userId: 'user-001',
    icon: 'safe',
    emoji: '📍',
    name: 'App Started',
    detail: 'Suraksha protection active',
    time: '5m ago',
    distLabel: 'Safe',
    createdAt: new Date().toISOString()
  },
  {
    id: uuidv4(),
    userId: 'user-001',
    icon: 'safe',
    emoji: '🛡️',
    name: 'Shield Enabled',
    detail: 'All monitors running',
    time: '10m ago',
    distLabel: 'Safe',
    createdAt: new Date().toISOString()
  },
];

// ─── Notifications ──────────────────────────────────────────
const notifications = [];

// ─── Chat Rooms / Messages ──────────────────────────────────
const chatRooms = [];
const chatMessages = [];
const chatEvents = new EventEmitter();

// ─── Active Sessions (JWT tokens invalidation list) ────────
// Stores revoked tokens to prevent use after logout
const revokedTokens = new Set();

// ─── Helper utilities ──────────────────────────────────────

// Avatar color cycle for contacts
const avatarColors = ['c1', 'c2', 'c3', 'c4', 'c5'];

/**
 * Get user by ID
 * @param {string} id - User ID
 * @returns {Object|null} User object or null
 */
function getUserById(id) {
  const user = users.find(u => u.id === id);
  if (!user) return null;
  return user;
}

/**
 * Get user by email
 * @param {string} email - Email address
 * @returns {Object|null} User object or null
 */
function getUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get all contacts for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of contacts
 */
function getContactsByUserId(userId) {
  try {
    return contacts.filter(c => c.userId === userId) || [];
  } catch (err) {
    console.error('[ERROR] Failed to get contacts:', err.message);
    return [];
  }
}

/**
 * Get activity feed for user
 * @param {string} userId - User ID
 * @param {number} limit - Max records to return (default 20)
 * @returns {Array} Activity entries
 */
function getActivitiesByUserId(userId, limit = 20) {
  try {
    return activityFeed
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  } catch (err) {
    console.error('[ERROR] Failed to get activities:', err.message);
    return [];
  }
}

/**
 * Get notifications for user
 * @param {string} userId - User ID
 * @param {number} limit - Max records to return
 * @returns {Array} Notification entries
 */
function getNotificationsByUserId(userId, limit = 50) {
  try {
    return notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  } catch (err) {
    console.error('[ERROR] Failed to get notifications:', err.message);
    return [];
  }
}

/**
 * Add notification
 * @param {string} userId - User ID
 * @param {Object} item - Notification payload
 * @returns {Object|null} Created notification
 */
function addNotification(userId, item) {
  try {
    if (!userId || typeof item !== 'object') {
      throw new Error('Invalid userId or notification item');
    }

    const entry = {
      id: uuidv4(),
      userId,
      title: item.title || 'Notification',
      message: item.message || '',
      type: item.type || 'info',
      read: false,
      createdAt: new Date().toISOString()
    };

    notifications.unshift(entry);

    const userItems = notifications.filter(n => n.userId === userId);
    if (userItems.length > 150) {
      const oldest = userItems[userItems.length - 1];
      const idx = notifications.findIndex(n => n.id === oldest.id);
      if (idx !== -1) notifications.splice(idx, 1);
    }

    return entry;
  } catch (err) {
    console.error('[ERROR] Failed to add notification:', err.message);
    return null;
  }
}

/**
 * Mark one notification as read
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 * @returns {Object|null} Updated notification
 */
function markNotificationRead(userId, notificationId) {
  const notification = notifications.find(
    n => n.id === notificationId && n.userId === userId
  );
  if (!notification) return null;
  notification.read = true;
  return notification;
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {number} Number of updated notifications
 */
function markAllNotificationsRead(userId) {
  let updated = 0;
  notifications.forEach((n) => {
    if (n.userId === userId && !n.read) {
      n.read = true;
      updated++;
    }
  });
  return updated;
}

/**
 * Get or create trustee chat room for a user
 * @param {string} userId - User ID
 * @returns {Object} Chat room
 */
function getOrCreateTrusteeRoom(userId) {
  let room = chatRooms.find(r => r.userId === userId && r.type === 'trustee');
  if (!room) {
    room = {
      id: uuidv4(),
      userId,
      type: 'trustee',
      title: 'Trustee Emergency Room',
      createdAt: new Date().toISOString()
    };
    chatRooms.push(room);
  }
  return room;
}

/**
 * Add chat message and emit user-scoped event
 * @param {string} userId - User ID
 * @param {Object} payload - Message payload
 * @returns {Object|null} Stored message
 */
function addChatMessage(userId, payload) {
  try {
    if (!userId || typeof payload !== 'object') {
      throw new Error('Invalid chat message payload');
    }

    const room = getOrCreateTrusteeRoom(userId);
    const message = {
      id: uuidv4(),
      roomId: room.id,
      userId,
      type: payload.type || 'text',
      senderRole: payload.senderRole || 'user',
      senderName: payload.senderName || 'You',
      encryptedText: payload.encryptedText || '',
      meta: payload.meta || {},
      createdAt: new Date().toISOString()
    };

    chatMessages.push(message);

    const roomMessages = chatMessages.filter(m => m.userId === userId);
    if (roomMessages.length > 500) {
      const oldest = roomMessages[0];
      const idx = chatMessages.findIndex(m => m.id === oldest.id);
      if (idx !== -1) chatMessages.splice(idx, 1);
    }

    chatEvents.emit(`chat:${userId}`, message);
    return message;
  } catch (err) {
    console.error('[ERROR] Failed to add chat message:', err.message);
    return null;
  }
}

/**
 * Get chat messages for user
 * @param {string} userId - User ID
 * @param {number} limit - Max records
 * @returns {Array}
 */
function getChatMessagesByUserId(userId, limit = 50) {
  return chatMessages
    .filter(m => m.userId === userId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-limit);
}

/**
 * Subscribe to user chat events
 * @param {string} userId - User ID
 * @param {Function} listener - Event callback
 * @returns {Function} unsubscribe callback
 */
function subscribeToChat(userId, listener) {
  const key = `chat:${userId}`;
  chatEvents.on(key, listener);
  return () => chatEvents.off(key, listener);
}

/**
 * Add activity to feed
 * @param {string} userId - User ID
 * @param {Object} item - Activity item data
 * @returns {Object} Created activity entry
 */
function addActivity(userId, item) {
  try {
    if (!userId || typeof item !== 'object') {
      throw new Error('Invalid userId or item');
    }

    const entry = {
      id: uuidv4(),
      userId,
      ...item,
      createdAt: new Date().toISOString()
    };

    activityFeed.unshift(entry);

    // Keep only last 100 entries per user to prevent memory leaks
    const userEntries = activityFeed.filter(a => a.userId === userId);
    if (userEntries.length > 100) {
      const oldest = userEntries[userEntries.length - 1];
      const idx = activityFeed.indexOf(oldest);
      if (idx !== -1) {
        activityFeed.splice(idx, 1);
      }
    }

    return entry;
  } catch (err) {
    console.error('[ERROR] Failed to add activity:', err.message);
    return null;
  }
}

/**
 * Add SOS event
 * @param {string} userId - User ID
 * @param {Object} data - Event data
 * @returns {Object} Created SOS event
 */
function addSosEvent(userId, data) {
  try {
    if (!userId || typeof data !== 'object') {
      throw new Error('Invalid userId or data');
    }

    const event = {
      id: uuidv4(),
      userId,
      ...data,
      createdAt: new Date().toISOString()
    };

    sosEvents.unshift(event);

    // Keep only last 500 SOS events to prevent memory leaks
    if (sosEvents.length > 500) {
      sosEvents.splice(500);
    }

    return event;
  } catch (err) {
    console.error('[ERROR] Failed to add SOS event:', err.message);
    return null;
  }
}

/**
 * Get next color for contact avatar
 * @param {string} userId - User ID
 * @returns {string} Color code
 */
function getNextColor(userId) {
  try {
    const existing = contacts.filter(c => c.userId === userId);
    return avatarColors[existing.length % avatarColors.length];
  } catch (err) {
    console.error('[ERROR] Failed to get next color:', err.message);
    return avatarColors[0];
  }
}

/**
 * Clear activity feed for a user (admin/data cleanup)
 * @param {string} userId - User ID
 */
function clearActivitiesByUserId(userId) {
  try {
    const idx = activityFeed.findIndex(a => a.userId === userId);
    activityFeed.splice(idx, activityFeed.filter(a => a.userId === userId).length);
  } catch (err) {
    console.error('[ERROR] Failed to clear activities:', err.message);
  }
}

/**
 * Get store statistics (for debugging)
 * @returns {Object} Store statistics
 */
function getStoreStats() {
  return {
    users: users.length,
    contacts: contacts.length,
    sosEvents: sosEvents.length,
    rides: rides.length,
    locationHistory: locationHistory.length,
    activityFeed: activityFeed.length,
    notifications: notifications.length,
    chatRooms: chatRooms.length,
    chatMessages: chatMessages.length,
    revokedTokens: revokedTokens.size,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  // Collections
  users,
  contacts,
  sosEvents,
  rides,
  locationHistory,
  activityFeed,
  notifications,
  chatRooms,
  chatMessages,
  revokedTokens,
  
  // Query functions
  getUserById,
  getUserByEmail,
  getContactsByUserId,
  getActivitiesByUserId,
  getNotificationsByUserId,
  getOrCreateTrusteeRoom,
  getChatMessagesByUserId,
  
  // Mutation functions
  addActivity,
  addSosEvent,
  addNotification,
  addChatMessage,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToChat,
  getNextColor,
  clearActivitiesByUserId,
  
  // Utilities
  getStoreStats,
  uuidv4,
  avatarColors
};
