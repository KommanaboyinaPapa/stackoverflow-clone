const mongoose = require('mongoose');

/**
 * Stores a short-lived forgot-password session so the user can
 * confirm/cancel before we actually update the password and send email/SMS.
 */
const forgotPasswordSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionKey: { type: String, required: true, unique: true, index: true },
    method: { type: String, enum: ['email', 'phone'], required: true },
    target: { type: String, default: '' }, // email or phone used for recovery
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL cleanup (MongoDB will remove expired records automatically)
forgotPasswordSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  'ForgotPasswordSession',
  forgotPasswordSessionSchema
);

