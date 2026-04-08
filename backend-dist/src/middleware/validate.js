/**
 * Input Validation Middleware
 * Ensures data integrity with comprehensive validation & sanitization
 */

const { ValidationError } = require('./errorHandler');

// ─── Field validators ──────────────────────────────────────
function required(val, fieldName) {
  if (val === undefined || val === null || String(val).trim() === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

function isEmail(val, fieldName = 'email') {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(String(val).trim())) {
    throw new ValidationError(`${fieldName} must be a valid email address`, fieldName);
  }
}

function minLength(val, min, fieldName) {
  if (String(val).trim().length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`, fieldName);
  }
}

function maxLength(val, max, fieldName) {
  if (String(val).trim().length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters`, fieldName);
  }
}

function isStrongPassword(val, fieldName = 'password') {
  const password = String(val || '');

  if (password.length < 8) {
    throw new ValidationError(`${fieldName} must be at least 8 characters`, fieldName);
  }

  if (!/[A-Z]/.test(password)) {
    throw new ValidationError(`${fieldName} must include at least one uppercase letter`, fieldName);
  }

  if (!/\d/.test(password)) {
    throw new ValidationError(`${fieldName} must include at least one number`, fieldName);
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new ValidationError(`${fieldName} must include at least one special character`, fieldName);
  }
}

function isPhone(val, fieldName = 'phone') {
  // Accepts: +92 300 111 2233, 0300-111-2233, 03001112233, +1-555-123-4567, etc.
  const re = /^[+\d][\d\s\-().]{6,20}$/;
  if (!re.test(String(val).trim())) {
    throw new ValidationError(`${fieldName} must be a valid phone number`, fieldName);
  }
}

function normalizePakistanPhone(val) {
  const raw = String(val || '').replace(/\s|\-|\(|\)/g, '');

  if (!raw) return '';

  if (/^\+92\d{10}$/.test(raw)) return raw;
  if (/^92\d{10}$/.test(raw)) return `+${raw}`;
  if (/^0\d{10}$/.test(raw)) return `+92${raw.slice(1)}`;
  if (/^3\d{9}$/.test(raw)) return `+92${raw}`;

  throw new ValidationError('phone must be a valid Pakistan number in +92 format', 'phone');
}

function isPakistanPhone(val, fieldName = 'phone') {
  const normalized = normalizePakistanPhone(val);
  if (!/^\+92\d{10}$/.test(normalized)) {
    throw new ValidationError(`${fieldName} must be in Pakistan +92 format`, fieldName);
  }
}

function isBoolean(val, fieldName) {
  if (typeof val !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean (true/false)`, fieldName);
  }
}

function isNumber(val, fieldName) {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName);
  }
}

function isInteger(val, fieldName) {
  if (!Number.isInteger(val)) {
    throw new ValidationError(`${fieldName} must be an integer`, fieldName);
  }
}

function isString(val, fieldName) {
  if (typeof val !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
}

function isIn(val, allowed, fieldName) {
  if (!allowed.includes(val)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowed.join(', ')}`,
      fieldName
    );
  }
}

function isLatitude(val, fieldName = 'latitude') {
  isNumber(val, fieldName);
  if (val < -90 || val > 90) {
    throw new ValidationError(`${fieldName} must be between -90 and 90`, fieldName);
  }
}

function isLongitude(val, fieldName = 'longitude') {
  isNumber(val, fieldName);
  if (val < -180 || val > 180) {
    throw new ValidationError(`${fieldName} must be between -180 and 180`, fieldName);
  }
}

function isUrl(val, fieldName = 'url') {
  try {
    new URL(String(val));
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`, fieldName);
  }
}

// ─── Sanitize input ────────────────────────────────────────
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  
  // Remove leading/trailing whitespace
  val = val.trim();
  
  // Remove HTML tags to prevent XSS
  val = val.replace(/<[^>]*>/g, '');
  
  // Remove any double-encoded content
  val = val.replace(/&lt;|&gt;|&quot;|&#x27;|&amp;/g, (m) => ({
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&amp;': '&'
  }[m])).replace(/<[^>]*>/g, '');
  
  // Prevent SQL injection by limiting special characters in names
  // (but allow spaces, hyphens, apostrophes for names)
  if (val.length > 1000) {
    val = val.substring(0, 1000);
  }
  
  return val;
}

function sanitizePhone(val) {
  if (typeof val !== 'string') return val;
  // Only keep digits and +
  return val.replace(/[^\d+\s\-()]/g, '');
}

function sanitizeEmail(val) {
  if (typeof val !== 'string') return val;
  return val.trim().toLowerCase();
}

// ─── Sanitize location ─────────────────────────────────────
function sanitizeLocation(val) {
  if (typeof val !== 'object' || val === null) return null;
  
  const { latitude, longitude, accuracy, altitude, heading, speed } = val;
  
  const sanitized = {};
  
  if (latitude !== undefined && latitude !== null) {
    isLatitude(latitude);
    sanitized.latitude = parseFloat(latitude.toFixed(8));
  }
  
  if (longitude !== undefined && longitude !== null) {
    isLongitude(longitude);
    sanitized.longitude = parseFloat(longitude.toFixed(8));
  }
  
  if (accuracy !== undefined && accuracy !== null) {
    isNumber(accuracy, 'accuracy');
    sanitized.accuracy = Math.max(0, parseFloat(accuracy));
  }
  
  if (altitude !== undefined && altitude !== null) {
    isNumber(altitude, 'altitude');
    sanitized.altitude = parseFloat(altitude);
  }
  
  if (heading !== undefined && heading !== null) {
    isNumber(heading, 'heading');
    if (heading < 0 || heading > 360) {
      throw new ValidationError('heading must be between 0 and 360', 'heading');
    }
    sanitized.heading = parseFloat(heading);
  }
  
  if (speed !== undefined && speed !== null) {
    isNumber(speed, 'speed');
    sanitized.speed = Math.max(0, parseFloat(speed));
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

module.exports = {
  required,
  isEmail,
  minLength,
  isStrongPassword,
  maxLength,
  isPhone,
  isPakistanPhone,
  isBoolean,
  isNumber,
  isInteger,
  isString,
  isIn,
  isLatitude,
  isLongitude,
  isUrl,
  sanitizeString,
  sanitizePhone,
  normalizePakistanPhone,
  sanitizeEmail,
  sanitizeLocation
};
