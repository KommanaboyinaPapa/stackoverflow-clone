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
    ipAddress: { type: String, default: '' },
    location: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoginDeviceOtp', loginDeviceOtpSchema);
