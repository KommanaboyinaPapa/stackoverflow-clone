const mongoose = require('mongoose');

/**
 * Stores a short-lived forgot-password session so the user can
 * confirm/cancel before we actually update the password.
 *
 * Flow:
 * 1) request-otp -> store OTP (email) or mark provider (phone), expires quickly
 * 2) verify-otp  -> mark verified + generate a temporary password
 * 3) finalize    -> user accepts generated password (or submits their own) and we update DB
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
    /**
     * Email OTP is stored hashed (sha256). Phone OTP is verified via Twilio Verify,
     * so we don't store the code, just the expiry.
     */
    otpHash: { type: String, default: '' },
    otpExpiresAt: { type: Date, required: true },
    otpVerifiedAt: { type: Date, default: null },

    /** Generated only AFTER OTP verification (letters only). */
    generatedPassword: { type: String, default: '' },

    /** Overall session expiry (Mongo TTL cleanup). */
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
