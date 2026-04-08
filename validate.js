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

function isPhone(val, fieldName = 'phone') {
  // Accepts: +92 300 111 2233, 0300-111-2233, 03001112233, etc.
  const re = /^[+\d][\d\s\-().]{6,20}$/;
  if (!re.test(String(val).trim())) {
    throw new ValidationError(`${fieldName} must be a valid phone number`, fieldName);
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

function isIn(val, allowed, fieldName) {
  if (!allowed.includes(val)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`, fieldName);
  }
}

// ─── Sanitize input ────────────────────────────────────────
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  return val.trim().replace(/<[^>]*>/g, ''); // strip HTML tags
}

module.exports = {
  required, isEmail, minLength, maxLength, isPhone,
  isBoolean, isNumber, isIn, sanitizeString
};
