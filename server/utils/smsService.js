/**
 * SMS OTP delivery — provider-ready structure.
 *
 * Future integrations (set env vars, implement send branch):
 * - Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * - Twilio Verify: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
 * - MSG91: MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID
 * - Firebase: FIREBASE_PROJECT_ID + service account (not wired here)
 *
 * Do not hardcode API keys. Use demo OTP in development when provider is missing.
 */

const https = require('https');
const { URL } = require('url');

const envTrim = (key) => String(process.env[key] || '').trim();
const hasEnv = (key) => Boolean(envTrim(key));

const getSmsProvider = () => {
  const raw = envTrim('SMS_PROVIDER').toLowerCase();
  if (!raw) return 'auto';
  // Accept common aliases.
  if (raw === 'twilio') return 'twilio';
  if (raw === 'twilio_verify' || raw === 'verify') return 'twilio_verify';
  if (raw === 'msg91') return 'msg91';
  return raw;
};

const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT_NAME === 'production';

const isDevelopment = () => !isProductionEnv();

const getTwilioSender = () =>
  envTrim('TWILIO_FROM_NUMBER') || envTrim('TWILIO_PHONE_NUMBER') || envTrim('TWILIO_FROM');

const getTwilioSenderEnvKey = () => {
  if (hasEnv('TWILIO_FROM_NUMBER')) return 'TWILIO_FROM_NUMBER';
  if (hasEnv('TWILIO_PHONE_NUMBER')) return 'TWILIO_PHONE_NUMBER';
  if (hasEnv('TWILIO_FROM')) return 'TWILIO_FROM';
  return null;
};

const isTwilioConfigured = () =>
  Boolean(
    hasEnv('TWILIO_ACCOUNT_SID') &&
      hasEnv('TWILIO_AUTH_TOKEN') &&
      getTwilioSender()
  );

const isTwilioVerifyConfigured = () =>
  Boolean(
    hasEnv('TWILIO_ACCOUNT_SID') &&
      hasEnv('TWILIO_AUTH_TOKEN') &&
      hasEnv('TWILIO_VERIFY_SERVICE_SID')
  );

const isMsg91Configured = () =>
  Boolean(
    hasEnv('MSG91_AUTH_KEY') &&
      hasEnv('MSG91_SENDER_ID') &&
      hasEnv('MSG91_TEMPLATE_ID')
  );

// Public: "is SMS OTP possible?"
// Supports Twilio Verify (no phone number required), Twilio Messaging (From number) and MSG91.
const isSmsConfigured = () => {
  const provider = getSmsProvider();
  if (provider === 'twilio_verify') return isTwilioVerifyConfigured();
  if (provider === 'twilio') return isTwilioVerifyConfigured() || isTwilioConfigured();
  if (provider === 'msg91') return isMsg91Configured();
  // auto
  return isTwilioVerifyConfigured() || isTwilioConfigured() || isMsg91Configured();
};

const logSmsConfig = () => {
  const smsProvider = getSmsProvider();
  const twilioSenderKey = getTwilioSenderEnvKey();
  const twilioSenderValue = getTwilioSender();

  console.log('SMS CONFIG CHECK', {
    smsProvider,
    hasAccountSid: hasEnv('TWILIO_ACCOUNT_SID'),
    hasAuthToken: hasEnv('TWILIO_AUTH_TOKEN'),
    hasVerifyServiceSid: hasEnv('TWILIO_VERIFY_SERVICE_SID'),
    hasFromNumber: Boolean(twilioSenderKey),
    twilioSenderKey,
    twilioSenderPreview: twilioSenderValue
      ? `***${twilioSenderValue.slice(-4)}`
      : null,
    isTwilioVerifyConfigured: isTwilioVerifyConfigured(),
    isTwilioMessagingConfigured: isTwilioConfigured(),
    isSmsConfigured: isSmsConfigured(),
    nodeEnv: process.env.NODE_ENV || '(unset)',
    railwayEnv: process.env.RAILWAY_ENVIRONMENT_NAME || '(unset)',
  });
};

const getBasicAuthHeader = () => {
  const accountSid = envTrim('TWILIO_ACCOUNT_SID');
  const authToken = envTrim('TWILIO_AUTH_TOKEN');
  const token = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return `Basic ${token}`;
};

/**
 * Send a custom SMS message (Twilio only).
 * Note: MSG91 integration in this repo is OTP-template-based and doesn't support arbitrary bodies.
 */
const sendTextSms = async (phone, message) => {
  // Custom SMS requires a Twilio From number (Messaging). Verify cannot send arbitrary bodies.
  // Trial accounts with only verified caller IDs still need a Twilio sender for Messaging API.
  const sender = getTwilioSender();
  const to = normalizeToE164IndiaIfNeeded(phone);
  const from = sender || '(missing)';

  console.log('TWILIO SMS SEND START', {
    to,
    from,
    message: String(message || ''),
  });

  if (!sender) {
    console.error('TWILIO SMS SEND FAILED', {
      to,
      from,
      reason:
        'Twilio Messaging sender missing. Trial account requires a Twilio-owned from number for custom SMS sending.',
      missing: ['TWILIO_FROM_NUMBER', 'TWILIO_PHONE_NUMBER', 'TWILIO_FROM'],
    });
    console.error('TWILIO SMS ERROR DETAILS', {
      hint:
        'Set TWILIO_FROM_NUMBER (or TWILIO_PHONE_NUMBER/TWILIO_FROM) to a Twilio-owned SMS sender number. In trial mode, destination numbers must also be verified in your Twilio console.',
    });
    return {
      sent: false,
      provider: 'twilio',
      reason:
        'Twilio Messaging sender missing. Trial account requires a Twilio-owned from number for custom SMS sending.',
    };
  }

  if (isTwilioConfigured()) {
    try {
      const accountSid = envTrim('TWILIO_ACCOUNT_SID');
      const url = new URL(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
      );

      const resp = await requestJson({
        method: 'POST',
        url,
        headers: {
          Authorization: getBasicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          To: String(to || '').trim(),
          From: String(from || '').trim(),
          Body: String(message || ''),
        }).toString(),
      });

      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        console.log('TWILIO SMS SEND SUCCESS', {
          to,
          from,
          statusCode: resp.statusCode,
        });
        return { sent: true, provider: 'twilio' };
      }

      console.error('TWILIO SMS SEND FAILED', {
        to,
        from,
        statusCode: resp.statusCode,
        reason: resp.data?.message || resp.raw || 'Twilio messaging request failed',
      });
      console.error('TWILIO SMS ERROR DETAILS', {
        statusCode: resp.statusCode,
        message: resp.data?.message || null,
        raw: resp.raw || null,
        code: resp.data?.code || null,
        moreInfo: resp.data?.more_info || null,
      });
      return {
        sent: false,
        provider: 'twilio',
        reason: resp.data?.message || resp.raw || 'Twilio messaging request failed',
      };
    } catch (error) {
      console.error('TWILIO SMS SEND FAILED', {
        to,
        from,
        error: error?.message || String(error),
      });
      console.error('TWILIO SMS ERROR DETAILS', {
        error: error?.message || String(error),
      });
      return { sent: false, provider: 'twilio', reason: error.message };
    }
  }

  return {
    sent: false,
    reason: isMsg91Configured()
      ? 'MSG91 is configured for OTP templates only (custom SMS not supported).'
      : 'SMS delivery is not configured.',
  };
};

const normalizeMsg91Mobile = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const requestJson = async ({ method, url, headers, body }) => {
  const requestUrl = typeof url === 'string' ? new URL(url) : url;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const contentType = String(res.headers['content-type'] || '');
          if (contentType.includes('application/json')) {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
            } catch (e) {
              resolve({ statusCode: res.statusCode, data: null, raw: data });
            }
          } else {
            resolve({ statusCode: res.statusCode, data: null, raw: data });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

// Phone formatting for Twilio Verify:
// - If user enters 10 digits, assume India and convert to +91XXXXXXXXXX
// - If already starts with "+", keep as-is
const normalizeToE164IndiaIfNeeded = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return raw;
};

// Twilio Verify send (Twilio generates the OTP; CustomCode is not used).
// Docs: https://www.twilio.com/docs/verify/api/verification
const sendViaTwilioVerify = async (phone) => {
  const serviceSid = envTrim('TWILIO_VERIFY_SERVICE_SID');
  const url = new URL(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`
  );

  const to = normalizeToE164IndiaIfNeeded(phone);
  console.log('TWILIO VERIFY SEND START', { to });

  // Twilio Verify expects application/x-www-form-urlencoded
  // Let Twilio generate and send the OTP automatically (do NOT pass CustomCode).
  const body = new URLSearchParams({
    To: String(to || '').trim(),
    Channel: 'sms',
  }).toString();

  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    console.log('TWILIO VERIFY SEND SUCCESS', { to });
    return { sent: true, provider: 'twilio_verify' };
  }

  const reason = resp.data?.message || resp.raw || 'Twilio Verify request failed';
  console.error('TWILIO VERIFY SEND FAILED', {
    to,
    statusCode: resp.statusCode,
    reason,
  });
  return {
    sent: false,
    provider: 'twilio_verify',
    reason: `Twilio Verify ${resp.statusCode}: ${reason}`,
  };
};

const sendVerifyOtp = async (phone) => {
  if (!isTwilioVerifyConfigured()) {
    return {
      sent: false,
      provider: 'twilio_verify',
      reason: 'Twilio Verify is not configured. Set TWILIO_VERIFY_SERVICE_SID.',
    };
  }
  return sendViaTwilioVerify(phone);
};

// Twilio Verify check (validates user-entered OTP).
// Docs: https://www.twilio.com/docs/verify/api/verification-check
const verifyTwilioVerifyOtp = async (phone, otp) => {
  const serviceSid = envTrim('TWILIO_VERIFY_SERVICE_SID');
  const url = new URL(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`
  );

  const to = normalizeToE164IndiaIfNeeded(phone);
  console.log('TWILIO VERIFY CHECK START', { to });
  const body = new URLSearchParams({
    To: String(to || '').trim(),
    Code: String(otp || '').trim(),
  }).toString();

  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    const status = String(resp.data?.status || '').toLowerCase();
    const verified = status === 'approved';
    if (verified) {
      console.log('TWILIO VERIFY CHECK SUCCESS', { to, status });
    } else {
      console.error('TWILIO VERIFY CHECK FAILED', { to, status });
    }
    return {
      verified,
      provider: 'twilio_verify',
      reason: verified ? null : `Twilio Verify status: ${status || 'unknown'}`,
    };
  }

  const reason = resp.data?.message || resp.raw || 'Twilio Verify check failed';
  console.error('TWILIO VERIFY CHECK FAILED', {
    to,
    statusCode: resp.statusCode,
    reason,
  });
  return {
    verified: false,
    provider: 'twilio_verify',
    reason,
  };
};

const sendViaMsg91 = async (phone) => {
  const mobile = normalizeMsg91Mobile(phone);
  const templateId = String(process.env.MSG91_TEMPLATE_ID || '').trim();
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();

  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', templateId);
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('authkey', authKey);

  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  });

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    if (resp.data?.type && resp.data.type !== 'success') {
      return { sent: false, provider: 'msg91', reason: resp.data?.message || 'MSG91 error' };
    }
    return { sent: true, provider: 'msg91' };
  }

  return { sent: false, provider: 'msg91', reason: 'MSG91 request failed' };
};

const verifyMsg91Otp = async (phone, otp) => {
  const mobile = normalizeMsg91Mobile(phone);
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();

  const url = new URL('https://control.msg91.com/api/v5/otp/verify');
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('otp', String(otp || '').trim());

  const resp = await requestJson({
    method: 'GET',
    url,
    headers: {
      authkey: authKey,
      Accept: 'application/json',
    },
  });

  if (resp.statusCode === 401) {
    return { verified: false, provider: 'msg91', reason: 'MSG91 auth failed' };
  }

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    if (resp.data?.type) {
      return {
        verified: resp.data.type === 'success',
        provider: 'msg91',
        reason: resp.data?.message || null,
      };
    }
    return { verified: true, provider: 'msg91', reason: null };
  }

  return { verified: false, provider: 'msg91', reason: 'MSG91 request failed' };
};

/**
 * Send OTP SMS.
 */
const sendOtpSms = async (phone, code, purpose = 'verification') => {
  // Prefer Twilio Verify when available (works without owning a Twilio phone number).
  if (isTwilioVerifyConfigured()) {
    try {
      return await sendViaTwilioVerify(phone);
    } catch (error) {
      console.error('Twilio Verify SMS failed:', error.message);
      if (!isDevelopment()) {
        return { sent: false, reason: error.message };
      }
    }
  }

  if (isMsg91Configured()) {
    try {
      return await sendViaMsg91(phone);
    } catch (error) {
      console.error('MSG91 SMS failed:', error.message);
      if (!isDevelopment()) {
        return { sent: false, reason: error.message };
      }
    }
  }

  // Fallback: if a Twilio From number exists, we can still send OTP via Messaging.
  if (isTwilioConfigured()) {
    const message = `StackClone: Your ${purpose} OTP is ${code}. Valid for 5 minutes. Do not share.`;
    try {
      return await sendTextSms(phone, message);
    } catch (error) {
      console.error('Twilio Messaging OTP failed:', error.message);
      if (!isDevelopment()) {
        return { sent: false, reason: error.message };
      }
    }
  }

  return {
    sent: false,
    reason:
      'SMS delivery is not configured. Contact administrator or use French (email OTP).',
  };
};

module.exports = {
  isSmsConfigured,
  isTwilioConfigured,
  isTwilioVerifyConfigured,
  isMsg91Configured,
  getSmsProvider,
  logSmsConfig,
  sendTextSms,
  sendVerifyOtp,
  sendOtpSms,
  verifyMsg91Otp,
  verifyTwilioVerifyOtp,
  normalizeToE164IndiaIfNeeded,
};
