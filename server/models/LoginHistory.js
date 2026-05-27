const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    browser: { type: String, default: 'Unknown' },
    deviceType: { type: String, default: 'Desktop' },
    deviceName: { type: String, default: 'Unknown Device' },
    operatingSystem: { type: String, default: 'Unknown' },
    // Stored from the login request (x-forwarded-for / req.ip / remoteAddress).
    // Keep empty when unavailable; UI should display "IP Address: Unknown".
    ipAddress: { type: String, default: '' },
    location: { type: String, default: 'Unknown' },
    loginAt: { type: Date, default: Date.now, index: true },
    isTrusted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
