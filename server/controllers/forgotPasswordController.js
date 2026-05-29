const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const ForgotPasswordSession = require('../models/ForgotPasswordSession');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { sendPasswordEmail, isEmailConfigured } = require('../utils/emailService');
const {
  sendTextSms,
  normalizeToE164IndiaIfNeeded,
} = require('../utils/smsService');

const DAILY_LIMIT_MESSAGE = 'You can use this option only one time per day.';
const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
const isDevelopment = () => !isProductionEnv();

const SESSION_TTL_MINUTES = 15;

// POST /api/auth/forgot-password
// Body: { email } or { phone } (at least one)
exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase() || '';
    const phone = req.body.phone?.trim() || '';

    if (!email && !phone) {
      return res.status(400).json({
        message: 'Please provide your registered email or phone number.',
      });
    }

    let user;
    if (email) {
      user = await User.findOne({ email }).select('+password');
    } else {
      const normalizedPhone = normalizeToE164IndiaIfNeeded(phone);
      const phoneCandidates = [phone];
      if (normalizedPhone && normalizedPhone !== phone) {
        phoneCandidates.push(normalizedPhone);
      }
      user = await User.findOne({ phone: { $in: phoneCandidates } }).select('+password');
    }

    if (!user) {
      return res.status(404).json({
        message: 'No account found with that email or phone number.',
      });
    }

    if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
      return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
    }

    const method = email ? 'email' : 'phone';
    const target = method === 'email' ? user.email : user.phone || phone;

    console.log('forgotPassword user lookup', {
      method,
      identifier: email || phone,
      userId: user._id.toString(),
      target,
    });

    // Replace any existing pending sessions for the user (only the latest should be confirmable)
    await ForgotPasswordSession.deleteMany({ user: user._id });

    const sessionKey = crypto.randomBytes(16).toString('hex');
    const generatedPassword = generateLetterPassword(12);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    await ForgotPasswordSession.create({
      user: user._id,
      sessionKey,
      method,
      target,
      generatedPassword,
      expiresAt,
    });

    console.log('forgotPassword generated password', {
      method,
      target,
      sessionKey,
    });

    if (method === 'phone') {
      // Send an OTP via configured SMS provider (Twilio Verify preferred).
      const { sendVerifyOtp, sendOtpSms } = require('../utils/smsService');
      let sendResult = { sent: false };
      try {
        // Prefer verify service
        if (typeof sendVerifyOtp === 'function') {
          sendResult = await sendVerifyOtp(target);
        }
        // Fallback to generic OTP send
        if (!sendResult.sent && typeof sendOtpSms === 'function') {
          sendResult = await sendOtpSms(target);
        }
      } catch (err) {
        console.error('forgotPassword send OTP error', err.message || err);
      }

      if (!sendResult.sent) {
        console.error('forgotPassword OTP send failed', {
          to: target,
          reason: sendResult.reason || 'unknown',
        });
        return res.status(503).json({
          message:
            'Unable to send OTP to the provided phone number. Please try again later or use email recovery.',
        });
      }

      return res.json({
        success: true,
        message: 'OTP sent to your phone. Enter the code to continue.',
        method,
        sessionKey,
        otpSent: true,
        expiresInMinutes: SESSION_TTL_MINUTES,
      });
    }

    // IMPORTANT: Do not update DB password or send email/SMS yet.
    // Only generate and show in UI; user must click Confirm & Send.
    return res.json({
      success: true,
      message:
        'Temporary password generated. Click Confirm & Send to update your password and receive it.',
      method,
      sessionKey,
      generatedPassword,
      showPasswordOnScreen: true,
      expiresInMinutes: SESSION_TTL_MINUTES,
    });
  } catch (error) {
    console.error('forgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// POST /api/auth/forgot-password/confirm
// Body: { sessionKey, confirm }
exports.confirmForgotPassword = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    const confirm = Boolean(req.body.confirm);

    if (!sessionKey) {
      return res.status(400).json({ message: 'Reset session is required.' });
    }

    const session = await ForgotPasswordSession.findOne({ sessionKey });
    if (!session) {
      return res.status(400).json({ message: 'Reset session expired. Please try again.' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'Reset session expired. Please try again.' });
    }

    console.log('confirmForgotPassword attempt', {
      sessionKey,
      method: session.method,
      target: session.target,
    });

    if (!confirm) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.json({ success: true, cancelled: true, message: 'Password reset cancelled.' });
    }

    const user = await User.findById(session.user).select('+password');
    if (!user) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(404).json({ message: 'User not found.' });
    }

    if (session.method === 'phone') {
      const generatedPassword = String(session.generatedPassword || '').trim();

      if (!generatedPassword || generatedPassword.length < 8) {
        return res.status(500).json({ message: 'Reset session is invalid. Please try again.' });
      }

      console.log('confirmForgotPassword phone attempt', {
        sessionKey,
        target: session.target,
      });

      if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
        await ForgotPasswordSession.deleteOne({ _id: session._id });
        return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(generatedPassword, salt);
      user.lastForgotPasswordAt = new Date();
      await user.save();

      const smsResult = await sendTextSms(
        session.target,
        `Your StackClone password has been reset. New password: ${generatedPassword}`
      );
      await ForgotPasswordSession.deleteOne({ _id: session._id });

      if (!smsResult.sent) {
        // Do NOT block the reset if SMS cannot be sent (trial account/no sender number).
        console.warn('confirmForgotPassword phone SMS not sent (non-blocking)', {
          userId: user._id.toString(),
          sessionKey,
          reason: smsResult.reason,
        });

        // Return success but include the generated password and an advisory message
        // so the user can copy it from the UI when SMS delivery is unavailable.
        return res.json({
          success: true,
          method: 'phone',
          message:
            `Password updated. SMS delivery failed: ${smsResult.reason}. SMS sender number is not configured, so please copy the generated password shown on screen.`,
          generatedPassword,
          smsNotSent: true,
        });
      }

      console.log('confirmForgotPassword phone success', {
        userId: user._id.toString(),
        sessionKey,
      });

      return res.json({
        success: true,
        method: 'phone',
        message: 'A new password has been sent to your phone.',
        generatedPassword,
      });
    }

    const generatedPassword = String(session.generatedPassword || '').trim();
    if (!generatedPassword || generatedPassword.length < 8) {
      return res.status(400).json({ message: 'Temporary password is missing or invalid.' });
    }

    // Enforce daily limit on actual reset.
    if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(generatedPassword, salt);
    user.lastForgotPasswordAt = new Date();
    await user.save();

    // Now send via recovery method.
    if (session.method === 'email') {
      if (!isEmailConfigured()) {
        await ForgotPasswordSession.deleteOne({ _id: session._id });
        if (isDevelopment()) {
          return res.json({
            success: true,
            method: 'email',
            message: 'Password updated. Email service not configured; use the shown password to log in.',
          });
        }
        return res.status(503).json({
          message: 'Email service is not configured. Please contact support.',
        });
      }

      console.log('confirmForgotPassword email send', {
        userId: user._id.toString(),
        sessionKey,
        email: user.email,
      });
      const mailResult = await sendPasswordEmail(user.email, generatedPassword, user.name);
      await ForgotPasswordSession.deleteOne({ _id: session._id });

      if (mailResult.sent) {
        console.log('confirmForgotPassword email sent', {
          userId: user._id.toString(),
          email: user.email,
          sessionKey,
        });
        return res.json({
          success: true,
          method: 'email',
          message: 'A new password has been sent to your email address.',
        });
      }

      if (isDevelopment()) {
        return res.json({
          success: true,
          method: 'email',
          message: 'Password updated. Email send failed in development; use the shown password to log in.',
        });
      }

      return res.status(500).json({
        message: 'Password was updated but we could not send the email. Please contact support.',
      });
    }

  } catch (error) {
    console.error('confirmForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// POST /api/auth/forgot-password/verify-otp
// Body: { sessionKey, otp }
exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    const otp = String(req.body.otp || '').trim();

    if (!sessionKey || !otp) {
      return res.status(400).json({ message: 'Session and OTP are required.' });
    }

    const session = await ForgotPasswordSession.findOne({ sessionKey });
    if (!session) {
      return res.status(400).json({ message: 'Reset session expired. Please start again.' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'Reset session expired. Please start again.' });
    }

    if (session.method !== 'phone') {
      return res.status(400).json({ message: 'OTP verification is only for phone-based resets.' });
    }

    const { verifyTwilioVerifyOtp, verifyMsg91Otp, isTwilioVerifyConfigured } = require('../utils/smsService');

    let verifyResult = { verified: false };
    try {
      if (isTwilioVerifyConfigured && isTwilioVerifyConfigured()) {
        verifyResult = await verifyTwilioVerifyOtp(session.target, otp);
      } else if (typeof verifyMsg91Otp === 'function') {
        verifyResult = await verifyMsg91Otp(session.target, otp);
      } else {
        return res.status(503).json({ message: 'OTP verification is not configured on the server.' });
      }
    } catch (err) {
      console.error('verifyForgotPasswordOtp error', err.message || err);
    }

    if (!verifyResult.verified) {
      return res.status(400).json({ message: verifyResult.reason || 'OTP verification failed.' });
    }

    // OTP verified — return the generated password to the client so it can be shown before confirm.
    const generatedPassword = String(session.generatedPassword || '').trim();
    if (!generatedPassword) {
      return res.status(500).json({ message: 'Temporary password missing. Please start the flow again.' });
    }

    return res.json({
      success: true,
      message: 'OTP verified. Temporary password generated and shown on screen.',
      generatedPassword,
      sessionKey,
    });
  } catch (error) {
    console.error('verifyForgotPasswordOtp error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
