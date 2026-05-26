/**
 * Payments allowed only 10:00–11:00 AM IST (inclusive start, exclusive end at 11:00).
 */
const PAYMENT_WINDOW_MESSAGE =
  'Subscriptions can only be purchased daily between 10:00 AM and 11:00 AM IST. Please return during this window.';

const isDevelopment = () => {
  const env = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
  return env !== 'production';
};

/** Dev-only: PAYMENT_WINDOW_OVERRIDE=true (trimmed, case-insensitive) */
const isPaymentWindowOverrideEnabled = () => {
  const value = String(process.env.PAYMENT_WINDOW_OVERRIDE || '')
    .trim()
    .toLowerCase();
  return value === 'true' || value === '1';
};

const getISTTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return { hour, minute, minutesSinceMidnight: hour * 60 + minute };
};

const isPaymentWindowOpen = (date = new Date()) => {
  if (isDevelopment() && isPaymentWindowOverrideEnabled()) {
    return true;
  }
  const { minutesSinceMidnight } = getISTTimeParts(date);
  const start = 10 * 60;
  const end = 11 * 60;
  return minutesSinceMidnight >= start && minutesSinceMidnight < end;
};

const getPaymentWindowStatus = (date = new Date()) => {
  const open = isPaymentWindowOpen(date);
  const { hour, minute } = getISTTimeParts(date);
  const istTimeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;

  return {
    open,
    istTimeLabel,
    windowLabel: '10:00 AM – 11:00 AM IST',
    message: open
      ? 'Payment window is open. Complete your subscription now.'
      : PAYMENT_WINDOW_MESSAGE,
  };
};

module.exports = {
  PAYMENT_WINDOW_MESSAGE,
  getISTTimeParts,
  isPaymentWindowOpen,
  getPaymentWindowStatus,
  isPaymentWindowOverrideEnabled,
};
