const LanguageOtp = require('../models/LanguageOtp');
const User = require('../models/User');
const {
  generateOtpCode,
  getOtpExpiresAt,
  deliverOtp,
} = require('../utils/otpService');
const {
  isTwilioConfigured,
  isTwilioVerifyConfigured,
  isMsg91Configured,
  verifyMsg91Otp,
  verifyTwilioVerifyOtp,
} = require('../utils/smsService');

const VALID_LANGS = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

const getOtpChannel = (languageCode) =>
  languageCode === 'fr' ? 'email' : 'mobile';

// POST /api/language/send-otp
exports.sendLanguageOtp = async (req, res) => {
  try {
    const { language } = req.body;

    if (!VALID_LANGS.includes(language)) {
      return res.status(400).json({ message: 'Invalid language code.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const channel = getOtpChannel(language);

    if (channel === 'mobile' && !user.phone?.trim()) {
      return res.status(400).json({
        message:
          'Add a mobile number to your profile before changing language with SMS OTP.',
        code: 'PHONE_REQUIRED',
      });
    }

    const smsProvider =
      channel === 'mobile'
        ? isTwilioVerifyConfigured() || isTwilioConfigured()
          ? 'twilio'
          : isMsg91Configured()
            ? 'msg91'
            : null
        : null;

    if (channel === 'mobile' && !smsProvider) {
      return res.status(500).json({
        message: 'SMS delivery is not configured. Contact administrator.',
      });
    }

    // OTP generation rules:
    // - Email (includes FR) always uses local OTP code (sent via email service)
    // - Mobile via Twilio Verify: Twilio generates the OTP (no local code)
    // - Mobile via Twilio Messaging (fallback): use local OTP code and send as SMS body
    // - Mobile via MSG91: provider generates OTP (no local code)
    const code =
      channel === 'email'
        ? generateOtpCode()
        : channel === 'mobile' && smsProvider === 'twilio' && !isTwilioVerifyConfigured()
          ? generateOtpCode()
          : undefined;
    const expiresAt = getOtpExpiresAt();

    await LanguageOtp.deleteMany({
      user: user._id,
      verified: false,
    });

    const otpRecord = await LanguageOtp.create({
      user: user._id,
      targetLanguage: language,
      channel,
      provider: channel === 'mobile' ? smsProvider : null,
      ...(code ? { code } : {}),
      expiresAt,
    });

    if (channel === 'mobile') {
      console.log('Language OTP user phone (DB):', user.phone || '');
    }

    const delivery = await deliverOtp({
      channel,
      email: user.email,
      // Always use the logged-in user's saved profile phone number from DB.
      phone: user.phone,
      code,
      purpose: 'language_change',
      userName: user.name,
    });

    if (channel === 'mobile' && !delivery.sent) {
      console.error('Language OTP SMS send failed:', {
        provider: delivery.provider || null,
        reason: delivery.reason || null,
      });
      await LanguageOtp.deleteOne({ _id: otpRecord._id });
      // Keep UI flow/message same, but include backend reason for debugging.
      return res.status(502).json({
        message: 'Could not send OTP. Please try again.',
        provider: delivery.provider || null,
        reason: delivery.reason || null,
        code: 'OTP_SEND_FAILED',
      });
    }

    const response = {
      success: true,
      message: delivery.sent
        ? channel === 'email'
          ? `OTP sent to your email (${maskEmail(user.email)}).`
          : `OTP sent to your mobile (${maskPhone(user.phone)}).`
        : channel === 'email'
          ? 'OTP generated. Check your email or use demo OTP below (development).'
          : 'OTP generated. Check your phone.',
      channel,
      otpSent: delivery.sent,
      destinationMasked:
        channel === 'email'
          ? maskEmail(user.email)
          : maskPhone(user.phone),
      expiresInMinutes: 5,
    };

    if (delivery.showDemoOtp) {
      response.demoOtp = delivery.showDemoOtp;
      response.demoNote = delivery.demoNote;
    }

    res.json(response);
  } catch (error) {
    console.error('sendLanguageOtp error:', error.message);
    res.status(500).json({ message: 'Could not send OTP.' });
  }
};

// POST /api/language/verify-otp
exports.verifyLanguageOtp = async (req, res) => {
  try {
    const { language, otp } = req.body;

    if (!VALID_LANGS.includes(language)) {
      return res.status(400).json({ message: 'Invalid language code.' });
    }

    if (!otp?.trim()) {
      return res.status(400).json({ message: 'OTP is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const record = await LanguageOtp.findOne({
      user: req.user._id,
      targetLanguage: language,
      verified: false,
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        message: 'No active OTP found. Please request a new code.',
      });
    }

    if (new Date() > record.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired. Request a new code.' });
    }

    if (record.channel === 'mobile' && record.provider === 'msg91') {
      if (!user.phone?.trim()) {
        return res.status(400).json({ message: 'Mobile number missing in profile.' });
      }
      const verification = await verifyMsg91Otp(user.phone, String(otp).trim());
      if (!verification.verified) {
        return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
      }
    } else if (
      record.channel === 'mobile' &&
      record.provider === 'twilio' &&
      isTwilioVerifyConfigured()
    ) {
      if (!user.phone?.trim()) {
        return res.status(400).json({ message: 'Mobile number missing in profile.' });
      }
      const verification = await verifyTwilioVerifyOtp(user.phone, String(otp).trim());
      if (!verification.verified) {
        console.error('Twilio Verify check failed:', verification.reason || 'invalid otp');
        return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
      }
    } else {
      if (!record.code || record.code !== String(otp).trim()) {
        return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
      }
    }

    record.verified = true;
    await record.save();

    user.preferredLanguage = language;
    await user.save();

    res.json({
      success: true,
      message: 'Language updated successfully.',
      preferredLanguage: user.preferredLanguage,
    });
  } catch (error) {
    console.error('verifyLanguageOtp error:', error.message);
    res.status(500).json({ message: 'OTP verification failed.' });
  }
};

// PUT /api/language/preference (guest sync / direct for same language only)
exports.updateGuestPreference = async (req, res) => {
  try {
    const { language } = req.body;
    if (!VALID_LANGS.includes(language)) {
      return res.status(400).json({ message: 'Invalid language code.' });
    }

    const user = await User.findById(req.user._id);
    user.preferredLanguage = language;
    await user.save();

    res.json({
      success: true,
      preferredLanguage: user.preferredLanguage,
    });
  } catch (error) {
    console.error('updateGuestPreference error:', error.message);
    res.status(500).json({ message: 'Could not update language.' });
  }
};

function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return '***';
  return `***${phone.slice(-4)}`;
}
