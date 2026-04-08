/**
 * Notifications Routes
 * In-app notification feed and read status management
 */

const express = require('express');
const router = express.Router();

const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const {
  getNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead
} = require('../models/store');

router.use(authenticate);

// GET /api/notifications - List notifications
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const items = getNotificationsByUserId(req.user.id, limit);
  const unreadCount = items.filter(item => !item.read).length;

  res.json({
    success: true,
    data: {
      notifications: items,
      count: items.length,
      unreadCount
    }
  });
}));

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const updated = markNotificationRead(req.user.id, req.params.id);
  if (!updated) throw new NotFoundError('Notification');

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification: updated }
  });
}));

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', asyncHandler(async (req, res) => {
  const updatedCount = markAllNotificationsRead(req.user.id);
  res.json({
    success: true,
    message: 'All notifications marked as read',
    data: { updatedCount }
  });
}));

module.exports = router;
