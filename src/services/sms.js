/**
 * SMS Service
 * Real SMS sending through Twilio REST API.
 */

const https = require('https');
const querystring = require('querystring');

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER
  };
}

function isSmsConfigured() {
  const cfg = getTwilioConfig();
  return Boolean(cfg.accountSid && cfg.authToken && cfg.fromNumber);
}

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function buildMapLink(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '';
  }

  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function sendSms({ to, body }) {
  return new Promise((resolve) => {
    try {
      if (!isSmsConfigured()) {
        resolve({ ok: false, error: 'SMS service is not configured' });
        return;
      }

      const cfg = getTwilioConfig();
      const recipient = normalizePhoneNumber(to);
      if (!recipient) {
        resolve({ ok: false, error: 'Invalid recipient phone number' });
        return;
      }

      const payload = querystring.stringify({
        To: recipient,
        From: cfg.fromNumber,
        Body: String(body || '').slice(0, 1600)
      });

      const request = https.request(
        {
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
          method: 'POST',
          auth: `${cfg.accountSid}:${cfg.authToken}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (response) => {
          let responseBody = '';
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            let parsed = null;
            try {
              parsed = responseBody ? JSON.parse(responseBody) : null;
            } catch (err) {
              parsed = null;
            }

            if (response.statusCode >= 200 && response.statusCode < 300 && parsed && parsed.sid) {
              resolve({
                ok: true,
                sid: parsed.sid,
                to: recipient
              });
              return;
            }

            resolve({
              ok: false,
              to: recipient,
              error: (parsed && parsed.message) || `SMS request failed with status ${response.statusCode || 'unknown'}`
            });
          });
        }
      );

      request.on('error', (err) => {
        resolve({ ok: false, to: recipient, error: err.message || 'SMS request failed' });
      });

      request.write(payload);
      request.end();
    } catch (err) {
      resolve({ ok: false, error: err.message || 'Unexpected SMS error' });
    }
  });
}

module.exports = {
  sendSms,
  isSmsConfigured,
  buildMapLink
};
