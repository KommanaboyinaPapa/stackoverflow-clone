/**
 * Mobile logins allowed only 10:00 AM – 1:00 PM IST.
 */
const MOBILE_LOGIN_MESSAGE =
  'Mobile login is allowed only between 10:00 AM and 1:00 PM IST.';

const { getISTTimeParts } = require('./paymentWindow');

const isMobileLoginWindowOpen = (date = new Date()) => {
  const { minutesSinceMidnight } = getISTTimeParts(date);
  const start = 10 * 60;
  const end = 13 * 60;
  // Inclusive end: allow exactly 1:00 PM IST (13:00).
  return minutesSinceMidnight >= start && minutesSinceMidnight <= end;
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
