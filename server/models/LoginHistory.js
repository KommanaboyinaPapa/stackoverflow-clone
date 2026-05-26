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
    ipAddress: { type: String, default: '127.0.0.1' },
    location: { type: String, default: 'Unknown' },
    loginAt: { type: Date, default: Date.now, index: true },
    isTrusted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
