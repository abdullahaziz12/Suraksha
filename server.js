/**
 * Suraksha Backend Server
 * Women's Safety Platform API
 * 
 * Complete error handling, validation, and exception management
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { generalLimiter } = require('./src/middleware/rateLimiter');

// Import routes
const authRoutes = require('./src/routes/auth');
const contactRoutes = require('./src/routes/contacts');
const sosRoutes = require('./src/routes/sos');
const rideRoutes = require('./src/routes/ride');
const locationRoutes = require('./src/routes/location');
const settingsRoutes = require('./src/routes/settings');
const activityRoutes = require('./src/routes/activity');
const notificationsRoutes = require('./src/routes/notifications');
const chatRoutes = require('./src/routes/chat');
const googleAuthRoutes = require('./src/routes/google-auth');
const geoRoutes = require('./src/routes/geo');
const sensorsRoutes = require('./src/routes/sensors');
const { connectDB } = require('./src/config/db');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);

// ─── Security Middleware ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token']
}));

// ─── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ─────────────────────────────────────────
app.use('/api', generalLimiter);

// ─── Serve Frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/sos',      sosRoutes);
app.use('/api/ride',     rideRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/google-auth', googleAuthRoutes);
app.use('/api/geo',      geoRoutes);
app.use('/api/sensors',  sensorsRoutes);

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Suraksha API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─── Serve Frontend for SPA routing ────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'), (err) => {
    if (err) {
      res.status(500).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Frontend file not found'
        }
      });
    }
  });
});

// ─── Error Handling ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Uncaught Exception Handlers ────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise);
  console.error('[CRITICAL] Reason:', reason);
  process.exit(1);
});

// ─── Start Server ──────────────────────────────────────────
let server;

function logStartup(port) {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║          🛡️  SURAKSHA BACKEND             ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`✅  Server running on http://localhost:${port}`);
  console.log(`📡  API available at http://localhost:${port}/api`);
  console.log(`🌐  Frontend served at http://localhost:${port}`);
  console.log(`❤️   Health check: http://localhost:${port}/api/health\n`);
}

function listenWithRetry(startPort, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryListen = (port) => {
      attempts += 1;
      const candidate = app.listen(port, () => {
        server = candidate;
        if (port !== startPort) {
          console.warn(`[WARN] Preferred port ${startPort} was busy. Using port ${port}.`);
        }
        logStartup(port);
        resolve(port);
      });

      candidate.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempts < maxAttempts) {
          const nextPort = port + 1;
          console.warn(`[WARN] Port ${port} is already in use. Trying ${nextPort}...`);
          tryListen(nextPort);
          return;
        }
        reject(error);
      });
    };

    tryListen(startPort);
  });
}

async function startServer() {
  await connectDB();
  await listenWithRetry(DEFAULT_PORT);
}

startServer().catch((error) => {
  console.error('[CRITICAL] Failed to start server:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

module.exports = app;
