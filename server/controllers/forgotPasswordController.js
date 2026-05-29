const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const ForgotPasswordSession = require('../models/ForgotPasswordSession');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { sendPasswordEmail, isEmailConfigured } = require('../utils/emailService');
const { sendTextSms, isSmsConfigured } = require('../utils/smsService');

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
      user = await User.findOne({ phone }).select('+password');
    }

    if (!user) {
      return res.status(404).json({
        message: 'No account found with that email or phone number.',
      });
    }

    if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
      return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
    }

    const newPassword = generateLetterPassword(12);
    const method = email ? 'email' : 'phone';

    // Replace any existing pending sessions for the user (only the latest should be confirmable)
    await ForgotPasswordSession.deleteMany({ user: user._id });

    const sessionKey = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    await ForgotPasswordSession.create({
      user: user._id,
      sessionKey,
      method,
      target: method === 'email' ? user.email : user.phone || phone,
      expiresAt,
    });

    // IMPORTANT: Do not update DB password or send email/SMS yet.
    // Only generate and show in UI; user must click Confirm & Send.
    return res.json({
      success: true,
      message:
        'Temporary password generated. Click Confirm & Send to update your password and receive it.',
      method,
      sessionKey,
      generatedPassword: newPassword,
      showPasswordOnScreen: true,
      expiresInMinutes: SESSION_TTL_MINUTES,
    });
  } catch (error) {
    console.error('forgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// POST /api/auth/forgot-password/confirm
// Body: { sessionKey, confirm, generatedPassword }
exports.confirmForgotPassword = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    const confirm = Boolean(req.body.confirm);
    const generatedPassword = String(req.body.generatedPassword || '').trim();

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

    if (!confirm) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.json({ success: true, cancelled: true, message: 'Password reset cancelled.' });
    }

    if (!generatedPassword || generatedPassword.length < 8) {
      return res.status(400).json({ message: 'Temporary password is missing or invalid.' });
    }

    const user = await User.findById(session.user).select('+password');
    if (!user) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(404).json({ message: 'User not found.' });
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

      const mailResult = await sendPasswordEmail(user.email, generatedPassword, user.name);
      await ForgotPasswordSession.deleteOne({ _id: session._id });

      if (mailResult.sent) {
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

    // Phone recovery (custom SMS supported via Twilio only in this repo)
    if (!isSmsConfigured()) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      if (isDevelopment()) {
        return res.json({
          success: true,
          method: 'phone',
          message: 'Password updated. SMS service not configured; use the shown password to log in.',
        });
      }
      return res.status(503).json({
        message: 'SMS service is not configured. Please contact support.',
      });
    }

    const smsResult = await sendTextSms(
      session.target,
      `StackClone: Your temporary password is ${generatedPassword}. Please log in and change it.`
    );
    await ForgotPasswordSession.deleteOne({ _id: session._id });

    if (!smsResult.sent) {
      console.error('ForgotPassword SMS delivery failed', {
        to: session.target,
        provider: smsResult.provider,
        reason: smsResult.reason,
      });
    }

    if (smsResult.sent) {
      return res.json({
        success: true,
        method: 'phone',
        message: 'A new password has been sent to your phone number.',
      });
    }

    if (isDevelopment()) {
      return res.json({
        success: true,
        method: 'phone',
        message: 'Password updated. SMS send failed in development; use the shown password to log in.',
      });
    }

    return res.status(500).json({
      message: 'Password was updated but we could not send the SMS. Please contact support.',
    });
  } catch (error) {
    console.error('confirmForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
