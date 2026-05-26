const mongoose = require('mongoose');

const trustedDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true },
    browser: { type: String, default: 'Unknown' },
    deviceType: { type: String, default: 'Desktop' },
    deviceName: { type: String, default: 'Unknown Device' },
    ipAddress: { type: String, default: '' },
    location: { type: String, default: '' },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

trustedDeviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('TrustedDevice', trustedDeviceSchema);
