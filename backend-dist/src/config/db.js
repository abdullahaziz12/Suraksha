const mongoose = require('mongoose');

let connectionAttempted = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (connectionAttempted) {
    return mongoose.connection.readyState === 1;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[WARN] MONGODB_URI not set. Running with in-memory data store.');
    return false;
  }

  connectionAttempted = true;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
    console.log('[INFO] MongoDB connected successfully.');
    return true;
  } catch (error) {
    console.error('[ERROR] MongoDB connection failed:', error.message);
    return false;
  }
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isDbConnected
};
