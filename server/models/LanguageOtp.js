const mongoose = require('mongoose');

const languageOtpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetLanguage: {
      type: String,
      required: true,
      enum: ['en', 'es', 'hi', 'pt', 'zh', 'fr'],
    },
    channel: {
      type: String,
      enum: ['email', 'mobile'],
      required: true,
    },
    provider: { type: String, default: null },
    code: { type: String, required: false },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LanguageOtp', languageOtpSchema);
