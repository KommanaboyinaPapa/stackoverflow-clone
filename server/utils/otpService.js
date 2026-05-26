/**
 * Shared OTP utilities — 6-digit codes, 5-minute expiry, delivery via email/SMS.
 */
const OTP_TTL_MS = 5 * 60 * 1000;

const { sendOtpEmail, isEmailConfigured } = require('./emailService');
const { sendOtpSms, isSmsConfigured } = require('./smsService');

const generateOtpCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const getOtpExpiresAt = () => new Date(Date.now() + OTP_TTL_MS);

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const shouldShowDemoOtp = (channel, deliveryResult) =>
  isDevelopment() && channel === 'email' && !deliveryResult?.sent;

/**
 * Deliver OTP to email or mobile. Returns { sent, channel, reason?, showDemoOtp? }.
 */
const deliverOtp = async ({
  channel,
  email,
  phone,
  code,
  purpose = 'verification',
  userName = 'User',
}) => {
  let result = { sent: false, channel };

  if (channel === 'email') {
    if (!email?.trim()) {
      return { sent: false, channel, reason: 'Email address missing' };
    }
    result = await sendOtpEmail(email.trim(), code, purpose, userName);
  } else if (channel === 'mobile') {
    if (!phone?.trim()) {
      return { sent: false, channel, reason: 'Mobile number missing' };
    }
    result = await sendOtpSms(phone.trim(), code, purpose);
  } else {
    return { sent: false, channel, reason: 'Invalid channel' };
  }

  if (shouldShowDemoOtp(channel, result)) {
    return {
      ...result,
      showDemoOtp: code,
      demoNote:
        'Development mode: OTP shown below because email/SMS is not configured.',
    };
  }

  return result;
};

module.exports = {
  OTP_TTL_MS,
  generateOtpCode,
  getOtpExpiresAt,
  deliverOtp,
  isEmailConfigured,
  isSmsConfigured,
  isDevelopment,
  shouldShowDemoOtp,
};
