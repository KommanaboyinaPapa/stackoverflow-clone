const mongoose = require('mongoose');

const loginDeviceOtpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true },
    pendingSessionId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    browser: { type: String, default: '' },
    deviceType: { type: String, default: '' },
    deviceName: { type: String, default: '' },
    operatingSystem: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    location: { type: String, default: '' },
  },
  { timestamps: true }
);

// Fast lookups/deletes for active OTPs
loginDeviceOtpSchema.index({ user: 1, verified: 1 });
loginDeviceOtpSchema.index({ user: 1, deviceId: 1, verified: 1 });

// Auto-cleanup expired OTPs (reduces collection size & improves query speed).
// MongoDB TTL monitor runs roughly every ~60s, so expiry is not instant, but good enough.
loginDeviceOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginDeviceOtp', loginDeviceOtpSchema);
