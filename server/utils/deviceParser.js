/**
 * Lightweight user-agent parsing (no external dependency).
 */
const parseDeviceInfo = (userAgent = '') => {
  const ua = String(userAgent || '');

  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';

  let deviceType = 'Desktop';
  let deviceName = 'Desktop Computer';
  let operatingSystem = 'Unknown';

  // OS detection (independent of device type) so mobile entries don't end up "Unknown"
  if (/Android/i.test(ua)) {
    operatingSystem = 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    operatingSystem = 'iOS';
  } else if (/Windows/i.test(ua)) {
    operatingSystem = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    operatingSystem = 'macOS';
  } else if (/Linux/i.test(ua)) {
    operatingSystem = 'Linux';
  }

  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) {
    deviceType = 'Mobile';
    deviceName = /iPhone|iPod/i.test(ua) ? 'iPhone' : 'Mobile Phone';
  } else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) {
    deviceType = 'Tablet';
    deviceName = /iPad/i.test(ua) ? 'iPad' : 'Tablet';
  } else if (/Windows/i.test(ua)) {
    deviceName = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceName = 'Mac';
  } else if (/Linux/i.test(ua)) {
    deviceName = 'Linux PC';
  }

  // Best-effort laptop detection (UA is often ambiguous; this is only a hint).
  // UI will normalize Tablet -> Mobile for display.
  if (deviceType === 'Desktop' && /CrOS|MacBook|Notebook|Laptop/i.test(ua)) {
    deviceType = 'Laptop';
    if (/CrOS/i.test(ua)) deviceName = 'Chromebook';
    if (/MacBook/i.test(ua)) deviceName = 'MacBook';
  }

  return { browser, deviceType, deviceName, operatingSystem };
};

/** Microsoft Edge / legacy IE — skip extra device OTP per internship rules */
const isMicrosoftBrowser = (browser = '') =>
  /Microsoft Edge|Internet Explorer|MSIE|Trident/i.test(String(browser));

const isChromeBrowser = (browser = '') =>
  String(browser) === 'Google Chrome';

module.exports = {
  parseDeviceInfo,
  isMicrosoftBrowser,
  isChromeBrowser,
};
