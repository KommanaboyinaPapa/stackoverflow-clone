const isDev = () => process.env.NODE_ENV !== 'production';

const getEmailTimeoutMs = () => Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 8000;

// Provider priority:
// 1) Brevo (BREVO_API_KEY) — preferred on Railway
// 2) Resend (RESEND_API_KEY)
// 3) SendGrid (SENDGRID_API_KEY)
const getEmailProvider = () => {
  const brevoKey = process.env.BREVO_API_KEY || '';
  if (brevoKey.trim()) {
    return { name: 'brevo', apiKey: brevoKey.trim() };
  }
  const resendKey = process.env.RESEND_API_KEY || '';
  if (resendKey.trim()) {
    return { name: 'resend', apiKey: resendKey.trim() };
  }
  const sendgridKey = process.env.SENDGRID_API_KEY || '';
  if (sendgridKey.trim()) {
    return { name: 'sendgrid', apiKey: sendgridKey.trim() };
  }
  return { name: 'none', apiKey: '' };
};

const getFromAddress = () => process.env.EMAIL_FROM || '';

const parseFrom = (from) => {
  // Supports: "Name <email@domain.com>" or "email@domain.com"
  const str = String(from || '').trim();
  const match = str.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    const email = match[2].trim();
    return { name: name || undefined, email };
  }
  return { email: str };
};

const isEmailConfigured = () => {
  const provider = getEmailProvider();
  const from = getFromAddress();
  return Boolean(provider.name !== 'none' && provider.apiKey && from && from.trim());
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

const extractApiError = async (res) => {
  try {
    const text = await res.text();
    return text || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
};

const sendViaResend = async ({ from, to, subject, html, text }) => {
  const provider = getEmailProvider();
  const payload = {
    from,
    to: [to],
    subject,
    html,
    text,
  };
  const res = await fetchWithTimeout(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    getEmailTimeoutMs()
  );
  if (!res.ok) {
    const errText = await extractApiError(res);
    throw new Error(`Resend API error: ${errText}`);
  }
  return res.json().catch(() => ({}));
};

const sendViaBrevo = async ({ from, to, subject, html, text }) => {
  const provider = getEmailProvider();
  const sender = parseFrom(from);
  if (!sender?.email) {
    throw new Error('EMAIL_FROM is invalid (expected "Name <email@domain>" or "email@domain").');
  }

  const payload = {
    sender: {
      email: sender.email,
      name: sender.name || 'StackClone',
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };

  const res = await fetchWithTimeout(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        'api-key': provider.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    },
    getEmailTimeoutMs()
  );

  if (!res.ok) {
    const errText = await extractApiError(res);
    throw new Error(`Brevo API error: ${errText}`);
  }
  return res.json().catch(() => ({}));
};

const sendViaSendgrid = async ({ from, to, subject, html, text }) => {
  const provider = getEmailProvider();
  const fromObj = parseFrom(from);
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: fromObj.name ? { email: fromObj.email, name: fromObj.name } : { email: fromObj.email },
    subject,
    content: [
      { type: 'text/plain', value: text || '' },
      { type: 'text/html', value: html || '' },
    ],
  };

  const res = await fetchWithTimeout(
    'https://api.sendgrid.com/v3/mail/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    getEmailTimeoutMs()
  );
  if (!res.ok) {
    const errText = await extractApiError(res);
    throw new Error(`SendGrid API error: ${errText}`);
  }
  return { accepted: true };
};

const sendEmail = async ({ to, subject, html, text }) => {
  const provider = getEmailProvider();
  const from = getFromAddress();

  if (!from?.trim()) {
    throw new Error('EMAIL_FROM is required for email sending.');
  }

  if (provider.name === 'brevo') {
    return sendViaBrevo({ from, to, subject, html, text });
  }
  if (provider.name === 'resend') {
    return sendViaResend({ from, to, subject, html, text });
  }
  if (provider.name === 'sendgrid') {
    return sendViaSendgrid({ from, to, subject, html, text });
  }
  throw new Error('Email provider is not configured (set RESEND_API_KEY or SENDGRID_API_KEY).');
};

/**
 * Startup provider verification (non-blocking). Server calls verifySmtpTransport()
 * on boot; we keep that function name for compatibility.
 */
const verifySmtpTransport = async () => {
  const provider = getEmailProvider();
  console.log('EMAIL PROVIDER START', { provider: provider.name });

  if (!isEmailConfigured()) {
    console.error('EMAIL PROVIDER FAILED', {
      provider: provider.name,
      error:
        'Email provider not configured (missing RESEND_API_KEY/SENDGRID_API_KEY and/or EMAIL_FROM).',
    });
    return { ok: false, error: 'not_configured' };
  }

  try {
    if (provider.name === 'brevo') {
      // Validate API key (docs: GET /v3/account)
      const res = await fetchWithTimeout(
        'https://api.brevo.com/v3/account',
        {
          method: 'GET',
          headers: {
            'api-key': provider.apiKey,
            accept: 'application/json',
          },
        },
        8000
      );
      if (!res.ok) {
        const errText = await extractApiError(res);
        throw new Error(`Brevo verify failed: ${errText}`);
      }
    } else if (provider.name === 'resend') {
      // Lightweight auth/connectivity check.
      const res = await fetchWithTimeout(
        'https://api.resend.com/api-keys',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${provider.apiKey}` },
        },
        8000
      );
      if (!res.ok) {
        const errText = await extractApiError(res);
        throw new Error(`Resend verify failed: ${errText}`);
      }
    } else if (provider.name === 'sendgrid') {
      const res = await fetchWithTimeout(
        'https://api.sendgrid.com/v3/user/profile',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${provider.apiKey}` },
        },
        8000
      );
      if (!res.ok) {
        const errText = await extractApiError(res);
        throw new Error(`SendGrid verify failed: ${errText}`);
      }
    }

    console.log('EMAIL PROVIDER SUCCESS', { provider: provider.name });
    return { ok: true };
  } catch (error) {
    console.error('EMAIL PROVIDER FAILED', {
      provider: provider.name,
      error: error?.message || String(error),
    });
    return { ok: false, error: error?.message || String(error) };
  }
};

/**
 * Send 6-digit OTP email.
 */
const sendOtpEmail = async (toEmail, otpCode, purpose = 'verification', userName = 'User') => {
  const subjectMap = {
    language_change: 'StackClone — Language change OTP',
    device_login: 'StackClone — New device sign-in OTP',
    password_reset: 'StackClone — Password reset OTP',
    verification: 'StackClone — Verification OTP',
  };
  const subject = subjectMap[purpose] || subjectMap.verification;

  if (!isEmailConfigured()) {
    if (isDev()) {
      console.log('--- EMAIL OTP (dev, not configured) ---');
      console.log(`To: ${toEmail}`);
      console.log(`OTP: ${otpCode}`);
      console.log(`Purpose: ${purpose}`);
      console.log('---------------------------------------');
      return { sent: false, reason: 'Email not configured', demo: true };
    }
    return { sent: false, reason: 'Email service not configured' };
  }

  try {
    const provider = getEmailProvider();
    console.log('OTP EMAIL CONFIG', { provider: provider.name });
    // Keep both log formats for easier production grep / backwards compatibility.
    console.log('EMAIL SEND START', { toEmail, purpose, userName });
    console.log('OTP EMAIL SEND START', { toEmail, purpose, userName });
    await sendEmail({
      to: toEmail,
      subject,
      text: `Hello ${userName},\n\nYour one-time code is: ${otpCode}\n\nValid for 5 minutes. Do not share this code.\n\n— StackClone`,
      html: `
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your one-time verification code:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otpCode}</p>
        <p>Valid for <strong>5 minutes</strong>. Do not share this code.</p>
        <p>— StackClone Team</p>
      `,
    });
    console.log('EMAIL SEND SUCCESS', { toEmail, purpose });
    console.log('OTP EMAIL SEND SUCCESS', { toEmail, purpose });
    return { sent: true };
  } catch (error) {
    console.error('EMAIL SEND FAILED', { toEmail, purpose, error: error.message });
    console.error('OTP EMAIL SEND FAILED', { toEmail, purpose, error: error.message });
    if (isDev()) {
      console.log(`Dev fallback OTP for ${toEmail}: ${otpCode}`);
      return { sent: false, reason: error.message, demo: true };
    }
    return { sent: false, reason: error.message };
  }
};

/**
 * Subscription invoice / receipt email.
 */
const sendInvoiceEmail = async (toEmail, userName, invoice) => {
  const lines = [
    `Invoice: ${invoice.invoiceNumber}`,
    `Plan: ${invoice.planName}`,
    `Amount: ₹${invoice.amountInr}`,
    `Paid at: ${invoice.paidAt}`,
    `Valid until: ${invoice.subscriptionExpiresAt}`,
    `Daily question limit: ${invoice.dailyQuestionLimitLabel}`,
  ].join('\n');

  if (!isEmailConfigured()) {
    if (isDev()) {
      console.log('--- INVOICE EMAIL (dev, not configured) ---');
      console.log(lines);
      return { sent: false, reason: 'Email not configured', demo: true };
    }
    return { sent: false, reason: 'Email not configured' };
  }

  try {
    await sendEmail({
      to: toEmail,
      subject: `StackClone Invoice ${invoice.invoiceNumber}`,
      text: `Hello ${userName},\n\nThank you for your subscription.\n\n${lines}\n\n— StackClone`,
      html: `
          <h2>Payment receipt</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <table style="border-collapse:collapse;">
            <tr><td><strong>Invoice</strong></td><td>${invoice.invoiceNumber}</td></tr>
            <tr><td><strong>Plan</strong></td><td>${invoice.planName}</td></tr>
            <tr><td><strong>Amount</strong></td><td>₹${invoice.amountInr}</td></tr>
            <tr><td><strong>Paid</strong></td><td>${invoice.paidAt}</td></tr>
            <tr><td><strong>Expires</strong></td><td>${invoice.subscriptionExpiresAt}</td></tr>
            <tr><td><strong>Questions/day</strong></td><td>${invoice.dailyQuestionLimitLabel}</td></tr>
          </table>
          <p>— StackClone Team</p>
        `,
    });
    return { sent: true };
  } catch (error) {
    console.error('Invoice email failed:', error.message);
    return { sent: false, reason: error.message };
  }
};

/**
 * Send the new password to the user's email (forgot password).
 */
const sendPasswordEmail = async (toEmail, newPassword, userName) => {
  if (!isEmailConfigured()) {
    console.log('--- EMAIL NOT CONFIGURED (dev mode) ---');
    console.log(`To: ${toEmail}`);
    console.log(`New password: ${newPassword}`);
    console.log('----------------------------------');
    return { sent: false, reason: 'SMTP not configured', devLogged: true };
  }

  try {
    await sendEmail({
      to: toEmail,
      subject: 'Your new StackClone password',
      text: `Hello ${userName},\n\nYour password has been reset.\n\nNew password: ${newPassword}\n\nPlease log in and change it if you wish.\n\n— StackClone Team`,
      html: `
          <p>Hello <strong>${userName}</strong>,</p>
          <p>Your password has been reset.</p>
          <p><strong>New password:</strong> <code>${newPassword}</code></p>
          <p>Please log in and change it if you wish.</p>
          <p>— StackClone Team</p>
        `,
    });
    return { sent: true };
  } catch (error) {
    console.error('Email send failed:', error.message);
    if (isDev()) {
      console.log(`Dev fallback password for ${toEmail}: ${newPassword}`);
      return { sent: false, reason: 'Email failed', devLogged: true };
    }
    return { sent: false, reason: error.message };
  }
};

module.exports = {
  sendPasswordEmail,
  sendOtpEmail,
  sendInvoiceEmail,
  isEmailConfigured,
  verifySmtpTransport,
};
