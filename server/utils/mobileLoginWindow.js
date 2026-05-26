/**
 * Mobile logins allowed only 10:00 AM – 1:00 PM IST (inclusive start, exclusive end at 13:00).
 */
const MOBILE_LOGIN_MESSAGE =
  'Mobile sign-in is allowed only between 10:00 AM and 1:00 PM IST. Please use a desktop browser or return during this window.';

const { getISTTimeParts } = require('./paymentWindow');

const isMobileLoginWindowOpen = (date = new Date()) => {
  console.log('[DEBUG MOBILE BYPASS] NODE_ENV:', process.env.NODE_ENV);
  console.log('[DEBUG MOBILE BYPASS] MOBILE_LOGIN_OVERRIDE raw:', process.env.MOBILE_LOGIN_OVERRIDE);
  console.log('[DEBUG MOBILE BYPASS] MOBILE_LOGIN_OVERRIDE trimmed:', process.env.MOBILE_LOGIN_OVERRIDE?.trim());

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.MOBILE_LOGIN_OVERRIDE?.trim() === 'true'
  ) {
    console.log('[DEBUG MOBILE BYPASS] BYPASS ALLOWED: true');
    return true;
  }
  const { minutesSinceMidnight } = getISTTimeParts(date);
  const start = 10 * 60;
  const end = 13 * 60;
  return minutesSinceMidnight >= start && minutesSinceMidnight < end;
};

const getMobileLoginWindowStatus = (date = new Date()) => {
  const open = isMobileLoginWindowOpen(date);
  const { hour, minute } = getISTTimeParts(date);
  const istTimeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;

  return {
    open,
    istTimeLabel,
    windowLabel: '10:00 AM – 1:00 PM IST',
    message: open
      ? 'Mobile sign-in window is open.'
      : MOBILE_LOGIN_MESSAGE,
  };
};

module.exports = {
  MOBILE_LOGIN_MESSAGE,
  isMobileLoginWindowOpen,
  getMobileLoginWindowStatus,
};
