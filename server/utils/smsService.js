/**
 * SMS OTP delivery — provider-ready structure.
 *
 * Future integrations (set env vars, implement send branch):
 * - Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
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

const isMsg91Configured = () =>
  Boolean(
    process.env.MSG91_AUTH_KEY &&
      process.env.MSG91_SENDER_ID &&
      process.env.MSG91_TEMPLATE_ID
  );

const isSmsConfigured = () => isTwilioConfigured() || isMsg91Configured();

const sendViaTwilio = async (phone, message) => {
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to: phone,
  });
  return { sent: true, provider: 'twilio' };
};

/**
 * Send a custom SMS message (Twilio only).
 * Note: MSG91 integration in this repo is OTP-template-based and doesn't support arbitrary bodies.
 */
const sendTextSms = async (phone, message) => {
  if (isTwilioConfigured()) {
    try {
      return await sendViaTwilio(phone, message);
    } catch (error) {
      console.error('Twilio SMS failed:', error.message);
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
  if (isTwilioConfigured()) {
    const message = `StackClone: Your ${purpose} OTP is ${code}. Valid for 5 minutes. Do not share.`;
    try {
      return await sendViaTwilio(phone, message);
    } catch (error) {
      console.error('Twilio SMS failed:', error.message);
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

  return {
    sent: false,
    reason:
      'SMS delivery is not configured. Contact administrator or use French (email OTP).',
  };
};

module.exports = {
  isSmsConfigured,
  isTwilioConfigured,
  isMsg91Configured,
  sendTextSms,
  sendOtpSms,
  verifyMsg91Otp,
};
