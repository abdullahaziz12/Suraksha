/**
 * Chat encryption service
 * AES-256-GCM encryption for in-app trustee chat messages.
 */

const crypto = require('crypto');

function getKey() {
  const secret = process.env.CHAT_ENCRYPTION_KEY || 'suraksha-chat-key-change-in-production';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptText(plainText) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(payload) {
  try {
    if (!payload) return '';
    const [ivHex, tagHex, dataHex] = String(payload).split(':');
    if (!ivHex || !tagHex || !dataHex) return '';

    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return '[Unable to decrypt message]';
  }
}

module.exports = {
  encryptText,
  decryptText
};
