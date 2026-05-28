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

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const isTwilioConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );

const isTwilioVerifyConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  );

const isMsg91Configured = () =>
  Boolean(
    process.env.MSG91_AUTH_KEY &&
      process.env.MSG91_SENDER_ID &&
      process.env.MSG91_TEMPLATE_ID
  );

// Public: "is SMS OTP possible?"
// Supports Twilio Verify (no phone number required), Twilio Messaging (From number) and MSG91.
const isSmsConfigured = () =>
  isTwilioVerifyConfigured() || isTwilioConfigured() || isMsg91Configured();

const getBasicAuthHeader = () => {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const token = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return `Basic ${token}`;
};

/**
 * Send a custom SMS message (Twilio only).
 * Note: MSG91 integration in this repo is OTP-template-based and doesn't support arbitrary bodies.
 */
const sendTextSms = async (phone, message) => {
  // Custom SMS requires a Twilio From number (Messaging). Verify cannot send arbitrary bodies.
  if (isTwilioConfigured()) {
    try {
      const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
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
          To: String(phone || '').trim(),
          From: String(process.env.TWILIO_FROM_NUMBER || '').trim(),
          Body: String(message || ''),
        }).toString(),
      });

      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        return { sent: true, provider: 'twilio' };
      }

      return {
        sent: false,
        provider: 'twilio',
        reason: resp.data?.message || resp.raw || 'Twilio messaging request failed',
      };
    } catch (error) {
      console.error('Twilio Messaging SMS failed:', error.message);
      if (!isDevelopment()) {
        return { sent: false, reason: error.message };
      }
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
  return raw;
};

// Twilio Verify send (Twilio generates the OTP; CustomCode is not used).
// Docs: https://www.twilio.com/docs/verify/api/verification
const sendViaTwilioVerify = async (phone) => {
  const serviceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  const url = new URL(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`
  );

  const to = normalizeToE164IndiaIfNeeded(phone);
  console.log('Twilio Verify OTP sending to:', to);

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
    return { sent: true, provider: 'twilio_verify' };
  }

  const reason = resp.data?.message || resp.raw || 'Twilio Verify request failed';
  console.error('Twilio Verify request failed:', {
    statusCode: resp.statusCode,
    reason,
  });
  return {
    sent: false,
    provider: 'twilio_verify',
    reason: `Twilio Verify ${resp.statusCode}: ${reason}`,
  };
};

// Twilio Verify check (validates user-entered OTP).
// Docs: https://www.twilio.com/docs/verify/api/verification-check
const verifyTwilioVerifyOtp = async (phone, otp) => {
  const serviceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  const url = new URL(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`
  );

  const to = normalizeToE164IndiaIfNeeded(phone);
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
    return {
      verified: status === 'approved',
      provider: 'twilio_verify',
      reason: status === 'approved' ? null : `Twilio Verify status: ${status || 'unknown'}`,
    };
  }

  return {
    verified: false,
    provider: 'twilio_verify',
    reason: resp.data?.message || resp.raw || 'Twilio Verify check failed',
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
  sendTextSms,
  sendOtpSms,
  verifyMsg91Otp,
  verifyTwilioVerifyOtp,
};
