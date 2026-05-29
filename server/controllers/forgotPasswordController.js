const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const ForgotPasswordSession = require('../models/ForgotPasswordSession');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { sendPasswordEmail, isEmailConfigured } = require('../utils/emailService');
const {
  sendTextSms,
  sendVerifyOtp,
  verifyTwilioVerifyOtp,
  isSmsConfigured,
  isTwilioVerifyConfigured,
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

    // Replace any existing pending sessions for the user (only the latest should be confirmable)
    await ForgotPasswordSession.deleteMany({ user: user._id });

    const sessionKey = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    await ForgotPasswordSession.create({
      user: user._id,
      sessionKey,
      method,
      target,
      expiresAt,
    });

    if (method === 'phone') {
      if (!isTwilioVerifyConfigured()) {
        await ForgotPasswordSession.deleteOne({ sessionKey });
        return res.status(503).json({
          message:
            'SMS OTP via Twilio Verify is not configured. Please contact support.',
        });
      }

      const otpResult = await sendVerifyOtp(target);
      if (!otpResult.sent) {
        await ForgotPasswordSession.deleteOne({ sessionKey });
        console.error('ForgotPassword Verify OTP send failed:', otpResult.reason);
        if (isDevelopment()) {
          return res.status(500).json({
            message:
              'OTP send failed in development; please try again or use email reset.',
          });
        }
        return res.status(500).json({
          message: 'Could not send OTP. Please contact support.',
        });
      }

      return res.json({
        success: true,
        message: 'OTP sent to your phone. Enter the code to confirm password reset.',
        method,
        sessionKey,
        requiresOtp: true,
        expiresInMinutes: SESSION_TTL_MINUTES,
      });
    }

    const newPassword = generateLetterPassword(12);

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

    const user = await User.findById(session.user).select('+password');
    if (!user) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(404).json({ message: 'User not found.' });
    }

    if (session.method === 'phone') {
      const otp = String(req.body.otp || '').trim();
      if (!otp) {
        return res.status(400).json({ message: 'OTP is required.' });
      }

      const verification = await verifyTwilioVerifyOtp(session.target, otp);
      if (!verification.verified) {
        console.error('ForgotPassword Verify OTP failed', {
          to: session.target,
          reason: verification.reason,
        });
        return res.status(400).json({
          message: 'Invalid OTP. Please check the code and try again.',
        });
      }

      if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
        await ForgotPasswordSession.deleteOne({ _id: session._id });
        return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
      }

      const newPassword = generateLetterPassword(12);
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      user.lastForgotPasswordAt = new Date();
      await user.save();
      await ForgotPasswordSession.deleteOne({ _id: session._id });

      return res.json({
        success: true,
        method: 'phone',
        message: 'Password reset confirmed. Use the generated password to log in.',
        generatedPassword: newPassword,
        showPasswordOnScreen: true,
      });
    }

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

  } catch (error) {
    console.error('confirmForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
