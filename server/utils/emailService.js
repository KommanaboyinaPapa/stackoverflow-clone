const nodemailer = require('nodemailer');

const getSmtpUser = () => process.env.SMTP_USER || process.env.EMAIL_USER || '';
const getSmtpPass = () => process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const getEmailTimeoutMs = () => Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 8000;
const getSmtpHost = () => {
  if (process.env.SMTP_HOST) return process.env.SMTP_HOST;
  const user = getSmtpUser();
  if (user.includes('gmail.com')) return 'smtp.gmail.com';
  return '';
};

const isEmailConfigured = () => {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const host = getSmtpHost();
  return Boolean(host && user && pass);
};

const createTransporter = () =>
  nodemailer.createTransport({
    host: getSmtpHost(),
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: getSmtpUser(),
      pass: getSmtpPass(),
    },
    // Hard timeouts so SMTP/network issues don't stall API responses forever.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 5000,
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 5000,
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 8000,
  });

const getFromAddress = () =>
  process.env.EMAIL_FROM || getSmtpUser() || 'noreply@stackclone.local';

const isDev = () => process.env.NODE_ENV !== 'production';

const withTimeout = (promise, ms, label = 'operation') =>
  new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
    promise
      .then((val) => {
        clearTimeout(id);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });

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
    console.log('OTP EMAIL CONFIG', {
      host: getSmtpHost(),
      userConfigured: Boolean(getSmtpUser()),
      passConfigured: Boolean(getSmtpPass()),
    });
    console.log('EMAIL SEND START', { toEmail, purpose, userName });
    const transporter = createTransporter();
    await withTimeout(
      transporter.sendMail({
        from: `"StackClone" <${getFromAddress()}>`,
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
      }),
      getEmailTimeoutMs(),
      'sendMail'
    );
    console.log('EMAIL SEND SUCCESS', { toEmail, purpose });
    return { sent: true };
  } catch (error) {
    console.error('EMAIL SEND FAILED', { toEmail, purpose, error: error.message });
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
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"StackClone Billing" <${getFromAddress()}>`,
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
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"StackClone" <${getFromAddress()}>`,
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
};
