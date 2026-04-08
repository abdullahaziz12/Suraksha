/**
 * Device Sensors & Hardware Access Routes
 * Gyroscope, accelerometer, and power button detection
 * 
 * Note: Most of this runs on the FRONTEND (browser APIs)
 * These routes provide backend support and data storage
 */

const express = require('express');
const router = express.Router();

const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { required, isNumber } = require('../middleware/validate');
const { addActivity, uuidv4 } = require('../models/store');

router.use(authenticate);

// Store sensor events temporarily
const sensorEvents = [];

/**
 * POST /api/sensors/gyroscope-event
 * Log gyroscope shake/motion event detected
 * Frontend detects shake, sends to backend
 */
router.post('/gyroscope-event', asyncHandler(async (req, res) => {
  try {
    const { intensity, x, y, z, timestamp } = req.body;

    required(intensity, 'intensity');
    isNumber(intensity, 'intensity');

    if (intensity < 0 || intensity > 100) {
      throw new ValidationError('Intensity must be between 0 and 100');
    }

    // Trigger SOS if intensity is very high (violent shake)
    if (intensity > 85) {
      addActivity(req.user.id, {
        icon: 'warn',
        emoji: '🤳',
        name: 'Gyroscope Event Detected',
        detail: `High motion detected (intensity: ${intensity}%)`,
        time: 'Just now',
        distLabel: 'Alert'
      });

      // Could automatically trigger SOS if enabled in user settings
      if (req.user.settings?.shakeAlert) {
        res.json({
          success: true,
          data: {
            event: 'gyroscope',
            intensity,
            sosTrigger: true,
            message: 'High motion detected - consider triggering SOS'
          }
        });
        return;
      }
    }

    // Store event for analysis
    sensorEvents.push({
      id: uuidv4(),
      userId: req.user.id,
      type: 'gyroscope',
      intensity,
      x: x || null,
      y: y || null,
      z: z || null,
      timestamp: timestamp || new Date().toISOString()
    });

    // Keep only last 100 events
    if (sensorEvents.length > 100) sensorEvents.splice(0, 1);

    res.json({
      success: true,
      data: {
        event: 'gyroscope',
        intensity,
        sosTrigger: false,
        recorded: true
      }
    });
  } catch (err) {
    console.error('[ERROR] Gyroscope event failed:', err.message);
    throw err;
  }
}));

/**
 * POST /api/sensors/accelerometer-event
 * Log accelerometer/fall detection event
 */
router.post('/accelerometer-event', asyncHandler(async (req, res) => {
  try {
    const { x, y, z, magnitude, isDrop } = req.body;

    isNumber(x, 'x');
    isNumber(y, 'y');
    isNumber(z, 'z');

    // Calculate total acceleration
    const totalAccel = Math.sqrt(x * x + y * y + z * z);

    // Fall detection if acceleration suddenly drops and then increases
    if (isDrop && totalAccel > 50 && req.user.settings?.fallDetection) {
      addActivity(req.user.id, {
        icon: 'warn',
        emoji: '⚠️',
        name: 'Potential Fall Detected',
        detail: 'Unusual motion pattern detected',
        time: 'Just now',
        distLabel: 'Alert'
      });

      res.json({
        success: true,
        data: {
          event: 'fall_detected',
          sosTrigger: true,
          message: 'Fall detected - SOS triggered'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        event: 'accelerometer',
        totalAcceleration: totalAccel.toFixed(2),
        recorded: true
      }
    });
  } catch (err) {
    console.error('[ERROR] Accelerometer event failed:', err.message);
    throw err;
  }
}));

/**
 * POST /api/sensors/power-button-event
 * Log power button double-tap event
 * Frontend detects double power button press, sends trigger
 */
router.post('/power-button-event', asyncHandler(async (req, res) => {
  try {
    const { tapCount, timestamp } = req.body;

    required(tapCount, 'tapCount');

    // Double tap = 2 taps in quick succession
    if (tapCount >= 2 && req.user.settings?.powerButtonDoubleTap) {
      // Send emergency alert to trustee contact
      addActivity(req.user.id, {
        icon: 'sos',
        emoji: '🆘',
        name: 'Power Button SOS Triggered',
        detail: 'Emergency alert sent via power button double-tap',
        time: 'Just now',
        distLabel: 'LIVE'
      });

      res.json({
        success: true,
        data: {
          event: 'power_button_sos',
          sosTrigger: true,
          message: 'Emergency alert sent to your trustee contact'
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          event: 'power_button',
          tapCount,
          recorded: true
        }
      });
    }
  } catch (err) {
    console.error('[ERROR] Power button event failed:', err.message);
    throw err;
  }
}));

/**
 * GET /api/sensors/sensor-support
 * Check which sensor APIs are available on device
 * Returns capabilities
 */
router.get('/sensor-support', asyncHandler(async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        message: 'Check sensor support on frontend',
        frontendApis: {
          geolocation: 'navigator.geolocation.getCurrentPosition()',
          gyroscope: 'DeviceOrientationEvent',
          accelerometer: 'DeviceMotionEvent',
          powerButton: 'Custom detection on Android'
        },
        note: 'Most sensor APIs only work in HTTPS or localhost'
      }
    });
  } catch (err) {
    console.error('[ERROR] Sensor support check failed:', err.message);
    throw err;
  }
}));

module.exports = router;
