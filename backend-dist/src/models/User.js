const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

function getDefaultSettings() {
  return {
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
    powerButtonDoubleTap: true
  };
}

const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: ''
    },
    avatar: {
      type: String,
      default: 'U'
    },
    picture: {
      type: String,
      default: null
    },
    authProvider: {
      type: String,
      default: 'email'
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    protectionEnabled: {
      type: Boolean,
      default: true
    },
    sosCountdownSeconds: {
      type: Number,
      default: 5
    },
    settings: {
      type: Object,
      default: getDefaultSettings
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString()
    }
  },
  {
    versionKey: false,
    bufferCommands: false
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
module.exports.getDefaultSettings = getDefaultSettings;
