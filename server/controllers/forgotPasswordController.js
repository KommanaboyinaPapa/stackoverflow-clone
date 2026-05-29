const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const ForgotPasswordSession = require('../models/ForgotPasswordSession');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { sendPasswordEmail, isEmailConfigured } = require('../utils/emailService');
const { normalizeToE164IndiaIfNeeded } = require('../utils/smsService');

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

    return res.json({
      success: true,
      message:
        'Temporary password generated. Click Confirm & Send to update your password.',
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

    const requestedPassword = String(req.body.password || req.body.generatedPassword || '').trim();
    const passwordToSet = requestedPassword || String(session.generatedPassword || '').trim();

    if (!passwordToSet || passwordToSet.length < 8) {
      return res.status(400).json({
        message:
          'Password must be provided and be at least 8 characters long. Please enter a valid password.',
      });
    }

    if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(passwordToSet, salt);
    user.lastForgotPasswordAt = new Date();
    await user.save();
    await ForgotPasswordSession.deleteOne({ _id: session._id });

    const emailTarget = user.email ? user.email : null;
    const shouldSendEmail = Boolean(emailTarget && isEmailConfigured());

    if (emailTarget && shouldSendEmail) {
      console.log('confirmForgotPassword email send', {
        userId: user._id.toString(),
        sessionKey,
        email: emailTarget,
      });
      const mailResult = await sendPasswordEmail(emailTarget, passwordToSet, user.name);

      if (mailResult.sent) {
        console.log('confirmForgotPassword email sent', {
          userId: user._id.toString(),
          email: emailTarget,
          sessionKey,
        });
        return res.json({
          success: true,
          method: session.method,
          message: 'A new password has been sent to your email address.',
          generatedPassword: passwordToSet,
        });
      }

      if (isDevelopment()) {
        return res.json({
          success: true,
          method: session.method,
          message: 'Password updated. Email send failed in development; use the shown password to log in.',
          generatedPassword: passwordToSet,
        });
      }

      return res.status(500).json({
        message: 'Password was updated but we could not send the email. Please contact support.',
      });
    }

    // No email could be sent; still treat the reset as complete.
    return res.json({
      success: true,
      method: session.method,
      message: 'Password updated. Use the shown password to log in.',
      generatedPassword: passwordToSet,
    });

  } catch (error) {
    console.error('confirmForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
