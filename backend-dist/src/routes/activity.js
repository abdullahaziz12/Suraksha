/**
 * Activity Routes
 * User activity feed and event history
 */

const express = require('express');
const router = express.Router();

const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { getActivitiesByUserId } = require('../models/store');

router.use(authenticate);

// ──────────────────────────────────────────────────────────
// GET /api/activity/feed - Get activity feed
// ──────────────────────────────────────────────────────────
router.get('/feed', asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const activities = getActivitiesByUserId(req.user.id, limit);

    res.json({
      success: true,
      data: {
        activities,
        count: activities.length
      }
    });
  } catch (err) {
    console.error('[ERROR] Failed to get activity feed:', err.message);
    throw err;
  }
}));

module.exports = router;
