/**
 * Email service for OTP delivery.
 */

const nodemailer = require('nodemailer');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email, otp, name = 'User') {
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@suraksha.app';
  const transporter = getTransporter();

  const subject = 'Suraksha Email Verification OTP';
  const text = `Hi ${name},\n\nYour Suraksha verification OTP is: ${otp}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`;

  if (!transporter) {
    console.log(`[INFO] OTP for ${email}: ${otp}`);
    return { sent: false, fallback: true };
  }

  await transporter.sendMail({
    from: fromEmail,
    to: email,
    subject,
    text
  });

  return { sent: true, fallback: false };
}

module.exports = {
  generateOtp,
  sendOtpEmail
};
