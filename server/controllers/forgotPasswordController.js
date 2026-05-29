const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const ForgotPasswordSession = require('../models/ForgotPasswordSession');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { deliverOtp, generateOtpCode, getOtpExpiresAt } = require('../utils/otpService');
const { normalizeToE164IndiaIfNeeded, sendVerifyOtp, verifyTwilioVerifyOtp } = require('../utils/smsService');

const DAILY_LIMIT_MESSAGE = 'You can use this option only one time per day.';
const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
const isDevelopment = () => !isProductionEnv();

const SESSION_TTL_MINUTES = 15;

const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value || '')).digest('hex');

/**
 * STEP 1: Request OTP
 * - Email: send OTP via email
 * - Phone: send OTP via Twilio Verify
 *
 * POST /api/auth/forgot-password/request-otp
 * Body: { email } or { phone } (at least one)
 */
exports.requestForgotPasswordOtp = async (req, res) => {
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
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    const otpCode = generateOtpCode();
    const otpExpiresAt = getOtpExpiresAt();

    const sessionDoc = {
      user: user._id,
      sessionKey,
      method,
      target,
      otpExpiresAt,
      expiresAt,
    };

    // Email OTP: store hash so we can verify later.
    // Phone OTP: Twilio Verify stores/verifies the OTP with Twilio; we don't store the code.
    if (method === 'email') {
      sessionDoc.otpHash = sha256(otpCode);
    }

    await ForgotPasswordSession.create(sessionDoc);

    console.log('forgotPassword OTP session created', {
      method,
      target,
      sessionKey,
    });

    if (method === 'email') {
      const delivery = await deliverOtp({
        channel: 'email',
        email: target,
        code: otpCode,
        purpose: 'password_reset',
        userName: user.name || 'User',
      });

      if (!delivery.sent && !delivery.showDemoOtp && !isDevelopment()) {
        await ForgotPasswordSession.deleteOne({ sessionKey });
        return res.status(500).json({
          message: delivery.reason || 'Could not send OTP email. Please try again later.',
        });
      }

      return res.json({
        success: true,
        method,
        sessionKey,
        message: delivery.sent
          ? 'OTP sent to your email. Please verify to continue.'
          : 'OTP generated. Please verify to continue.',
        ...(delivery.showDemoOtp
          ? { showDemoOtp: delivery.showDemoOtp, demoNote: delivery.demoNote }
          : {}),
        otpExpiresInMinutes: 5,
      });
    }

    // Phone OTP via Twilio Verify (DO NOT send password via SMS).
    const sms = await sendVerifyOtp(target);
    if (!sms.sent) {
      await ForgotPasswordSession.deleteOne({ sessionKey });
      return res.status(500).json({
        message: sms.reason || 'Could not send OTP SMS. Please try again later.',
      });
    }

    return res.json({
      success: true,
      method,
      sessionKey,
      message: 'OTP sent to your phone. Please verify to continue.',
      otpExpiresInMinutes: 5,
    });
  } catch (error) {
    console.error('requestForgotPasswordOtp error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * STEP 2: Verify OTP (and generate password AFTER verification)
 *
 * POST /api/auth/forgot-password/verify-otp
 * Body: { sessionKey, otp }
 */
exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    const otp = String(req.body.otp || '').trim();

    if (!sessionKey) {
      return res.status(400).json({ message: 'Reset session is required.' });
    }

    if (!otp) {
      return res.status(400).json({ message: 'OTP is required.' });
    }

    const session = await ForgotPasswordSession.findOne({ sessionKey });
    if (!session) {
      return res.status(400).json({ message: 'Reset session expired. Please try again.' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'Reset session expired. Please try again.' });
    }

    if (!session.otpVerifiedAt && new Date() > new Date(session.otpExpiresAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    console.log('verifyForgotPasswordOtp attempt', {
      sessionKey,
      method: session.method,
      target: session.target,
    });

    // Allow idempotent verify: if already verified and password generated, just re-show it.
    if (session.otpVerifiedAt && session.generatedPassword) {
      return res.json({
        success: true,
        verified: true,
        method: session.method,
        message: 'OTP already verified.',
        generatedPassword: session.generatedPassword,
        showPasswordOnScreen: true,
      });
    }

    let verified = false;
    let reason = null;

    if (session.method === 'email') {
      verified = sha256(otp) === String(session.otpHash || '');
      if (!verified) reason = 'Invalid OTP. Please try again.';
    } else {
      const result = await verifyTwilioVerifyOtp(session.target, otp);
      verified = Boolean(result.verified);
      reason = result.reason || 'Invalid OTP. Please try again.';
    }

    if (!verified) {
      return res.status(400).json({ message: reason || 'Invalid OTP. Please try again.' });
    }

    const generatedPassword = generateLetterPassword(12);
    session.otpVerifiedAt = new Date();
    session.generatedPassword = generatedPassword;
    await session.save();

    return res.json({
      success: true,
      verified: true,
      method: session.method,
      message: 'OTP verified. Temporary password generated.',
      generatedPassword,
      showPasswordOnScreen: true,
      expiresInMinutes: SESSION_TTL_MINUTES,
    });

  } catch (error) {
    console.error('verifyForgotPasswordOtp error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * STEP 3: Finalize password reset (ONLY after Accept/Confirm)
 *
 * POST /api/auth/forgot-password/finalize
 * Body: { sessionKey, password? }
 */
exports.finalizeForgotPassword = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    const requestedPassword = String(req.body.password || '').trim();

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

    if (!session.otpVerifiedAt) {
      return res.status(400).json({ message: 'Please verify OTP before setting password.' });
    }

    const user = await User.findById(session.user).select('+password');
    if (!user) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(404).json({ message: 'User not found.' });
    }

    if (hasForgotPasswordToday(user.lastForgotPasswordAt)) {
      await ForgotPasswordSession.deleteOne({ _id: session._id });
      return res.status(429).json({ message: DAILY_LIMIT_MESSAGE });
    }

    const passwordToSet = requestedPassword || String(session.generatedPassword || '').trim();
    if (!passwordToSet || passwordToSet.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(passwordToSet, salt);
    user.lastForgotPasswordAt = new Date();
    await user.save();
    await ForgotPasswordSession.deleteOne({ _id: session._id });

    return res.json({
      success: true,
      message: 'Password updated. You can now log in.',
    });
  } catch (error) {
    console.error('finalizeForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * Cancel/reset the flow (no DB changes)
 *
 * POST /api/auth/forgot-password/cancel
 * Body: { sessionKey }
 */
exports.cancelForgotPassword = async (req, res) => {
  try {
    const sessionKey = String(req.body.sessionKey || '').trim();
    if (!sessionKey) {
      return res.status(400).json({ message: 'Reset session is required.' });
    }
    await ForgotPasswordSession.deleteOne({ sessionKey });
    return res.json({ success: true, cancelled: true, message: 'Password reset cancelled.' });
  } catch (error) {
    console.error('cancelForgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
