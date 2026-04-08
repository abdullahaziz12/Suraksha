const User = require('../models/User');
const { isDbConnected } = require('../config/db');
const { users } = require('../models/store');
const { v4: uuidv4 } = require('uuid');

function normalizePhoneForLookup(phone) {
  const raw = String(phone || '').replace(/\s|\-|\(|\)/g, '');
  if (!raw) return '';
  if (/^\+92\d{10}$/.test(raw)) return raw;
  if (/^92\d{10}$/.test(raw)) return `+${raw}`;
  if (/^0\d{10}$/.test(raw)) return `+92${raw.slice(1)}`;
  if (/^3\d{9}$/.test(raw)) return `+92${raw}`;
  return raw;
}

function normalizeRecord(user) {
  if (!user) return null;
  if (typeof user.toObject === 'function') {
    const plain = user.toObject();
    delete plain._id;
    return plain;
  }
  return user;
}

async function findUserByEmail(email) {
  if (!email) return null;

  if (isDbConnected()) {
    return User.findOne({ email: String(email).toLowerCase() });
  }

  return users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase()) || null;
}

async function findUserById(id) {
  if (!id) return null;

  if (isDbConnected()) {
    return User.findOne({ id: String(id) });
  }

  return users.find((u) => u.id === id) || null;
}

async function findUserByPhone(phone) {
  const normalized = normalizePhoneForLookup(phone);
  if (!normalized) return null;

  if (isDbConnected()) {
    return User.findOne({ phone: normalized });
  }

  return users.find((u) => normalizePhoneForLookup(u.phone) === normalized) || null;
}

async function createUser(payload) {
  if (isDbConnected()) {
    const user = await User.create(payload);
    return user;
  }

  const user = {
    id: payload.id || uuidv4(),
    ...payload
  };
  users.push(user);
  return user;
}

async function saveUser(user) {
  if (!user) return null;

  if (isDbConnected()) {
    if (typeof user.save === 'function') {
      return user.save();
    }

    if (user.id) {
      return User.findOneAndUpdate({ id: user.id }, user, { new: true, upsert: false });
    }

    return null;
  }

  return user;
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByPhone,
  createUser,
  saveUser,
  normalizeRecord
};
