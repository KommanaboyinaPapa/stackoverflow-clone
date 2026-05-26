const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateLetterPassword } = require('../utils/generatePassword');
const { hasForgotPasswordToday } = require('../utils/dateHelper');
const { sendPasswordEmail, isEmailConfigured } = require('../utils/emailService');

const DAILY_LIMIT_MESSAGE = 'You can use this option only one time per day.';
const isDevelopment = process.env.NODE_ENV !== 'production';

/** Message shown on screen when password must be displayed (e.g. dev, no email). */
const tempPasswordMessage = (password) =>
  `Password reset successful. Your temporary password is: ${password}`;

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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.lastForgotPasswordAt = new Date();
    await user.save();

    // Reset via email
    if (email) {
      if (!isEmailConfigured()) {
        if (isDevelopment) {
          return res.json({
            success: true,
            message: tempPasswordMessage(newPassword),
            method: 'email',
            generatedPassword: newPassword,
            showPasswordOnScreen: true,
          });
        }
        return res.status(503).json({
          message: 'Email service is not configured. Please contact support.',
        });
      }

      const mailResult = await sendPasswordEmail(user.email, newPassword, user.name);

      if (mailResult.sent) {
        return res.json({
          success: true,
          message: isDevelopment
            ? tempPasswordMessage(newPassword)
            : 'A new password has been sent to your email address.',
          method: 'email',
          ...(isDevelopment
            ? { generatedPassword: newPassword, showPasswordOnScreen: true }
            : {}),
        });
      }

      if (isDevelopment) {
        return res.json({
          success: true,
          message: tempPasswordMessage(newPassword),
          method: 'email',
          generatedPassword: newPassword,
          showPasswordOnScreen: true,
        });
      }

      return res.status(500).json({
        message: 'Password was reset but we could not send the email. Please contact support.',
      });
    }

    // Reset via phone — show password on screen in development
    if (isDevelopment) {
      return res.json({
        success: true,
        message: tempPasswordMessage(newPassword),
        method: 'phone',
        generatedPassword: newPassword,
        showPasswordOnScreen: true,
      });
    }

    return res.json({
      success: true,
      message: 'Your password has been reset successfully.',
      method: 'phone',
    });
  } catch (error) {
    console.error('forgotPassword error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
