const crypto = require('crypto');
const LoginHistory = require('../models/LoginHistory');
const TrustedDevice = require('../models/TrustedDevice');
const LoginDeviceOtp = require('../models/LoginDeviceOtp');
const { parseDeviceInfo, isMicrosoftBrowser } = require('./deviceParser');
const { generateToken } = require('./jwt');
const { formatUser } = require('./formatUser');
const {
  generateOtpCode,
  getOtpExpiresAt,
} = require('./otpService');
const { sendOtpEmail, isEmailConfigured } = require('./emailService');
const {
  isMobileLoginWindowOpen,
  getMobileLoginWindowStatus,
  MOBILE_LOGIN_MESSAGE,
} = require('./mobileLoginWindow');

const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

const DEMO_LOCATIONS = [
  'Mumbai, India',
  'Delhi, India',
  'Bengaluru, India',
  'Hyderabad, India',
  'Chennai, India',
  'Pune, India',
  'Kolkata, India',
];

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  const raw = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1)
  const ip = String(raw).startsWith('::ffff:') ? String(raw).slice(7) : String(raw);
  return ip || '';
};

const getDemoLocation = (ip) => {
  const str = String(ip || 'local');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash + str.charCodeAt(i)) % DEMO_LOCATIONS.length;
  }
  return DEMO_LOCATIONS[Math.abs(hash) % DEMO_LOCATIONS.length];
};

const getDevicePayload = (req) => {
  const userAgent = req.body?.userAgent || req.headers['user-agent'] || '';
  const parsed = parseDeviceInfo(userAgent);
  const ipAddress = getClientIp(req);
  return {
    ...parsed,
    ipAddress,
    location: getDemoLocation(ipAddress),
    userAgent: userAgent.slice(0, 512),
  };
};

const upsertTrustedDevice = async (userId, deviceId, payload) => {
  const update = {
    browser: payload.browser,
    deviceType: payload.deviceType,
    deviceName: payload.deviceName,
    operatingSystem: payload.operatingSystem,
    ipAddress: payload.ipAddress,
    location: payload.location,
    lastLoginAt: new Date(),
  };
  await TrustedDevice.findOneAndUpdate(
    { user: userId, deviceId },
    { user: userId, deviceId, ...update },
    { upsert: true, new: true }
  );
};

const recordLoginHistory = async (userId, deviceId, sessionId, payload, isTrusted) => {
  return LoginHistory.create({
    user: userId,
    deviceId,
    sessionId,
    browser: payload.browser,
    deviceType: payload.deviceType,
    deviceName: payload.deviceName,
    operatingSystem: payload.operatingSystem,
    ipAddress: payload.ipAddress,
    location: payload.location,
    loginAt: new Date(),
    isTrusted,
  });
};

const completeLoginSession = async (user, req, deviceId, trustDevice = true) => {
  const payload = getDevicePayload(req);
  const sessionId = crypto.randomBytes(16).toString('hex');
  const token = generateToken(user._id);

  if (trustDevice) {
    await upsertTrustedDevice(user._id, deviceId, payload);
  }

  await recordLoginHistory(user._id, deviceId, sessionId, payload, trustDevice);

  return {
    success: true,
    message: 'Login successful',
    user: formatUser(user),
    token,
    sessionId,
  };
};

const handlePostCredentialLogin = async (user, req) => {
  const flowStartAt = Date.now();
  const deviceId = req.body?.deviceId?.trim();
  const forceDeviceVerification =
    process.env.NODE_ENV !== 'production' && Boolean(req.body?.forceDeviceVerification);
  debugLog('handlePostCredentialLogin called', {
    userId: user._id.toString(),
    email: user.email,
    deviceId,
    userName: user.name,
    forceDeviceVerification,
  });

  if (!deviceId) {
    const err = new Error('Device identification is required.');
    err.statusCode = 400;
    debugLog('LOGIN DEVICE ID MISSING', { userId: user._id.toString() });
    throw err;
  }

  const payload = getDevicePayload(req);
  debugLog('LOGIN DEVICE PAYLOAD', payload);

  const isMobileDevice =
    payload.deviceType === 'Mobile' || payload.deviceType === 'Tablet';

  if (isMobileDevice && !isMobileLoginWindowOpen()) {
    const err = new Error(MOBILE_LOGIN_MESSAGE);
    err.statusCode = 403;
    err.mobileLoginWindow = getMobileLoginWindowStatus();
    debugLog('MOBILE LOGIN BLOCKED', {
      userId: user._id.toString(),
      deviceType: payload.deviceType,
    });
    throw err;
  }

  const trusted = await TrustedDevice.findOne({ user: user._id, deviceId });
  debugLog('TRUSTED DEVICE CHECK', { trusted: Boolean(trusted) });
  if (trusted && !forceDeviceVerification) {
    await TrustedDevice.updateOne(
      { _id: trusted._id },
      {
        lastLoginAt: new Date(),
        browser: payload.browser,
        deviceType: payload.deviceType,
        deviceName: payload.deviceName,
        operatingSystem: payload.operatingSystem,
        ipAddress: payload.ipAddress,
        location: payload.location,
      }
    );
    debugLog('TRUSTED DEVICE LOGIN, COMPLETING SESSION', {
      userId: user._id.toString(),
      deviceId,
    });
    return completeLoginSession(user, req, deviceId, true);
  }

  // Run the "other devices" checks in parallel (these can be slow on large datasets).
  const [otherTrusted, otherHistoryExists] = await Promise.all([
    TrustedDevice.countDocuments({
      user: user._id,
      deviceId: { $ne: deviceId },
    }),
    LoginHistory.exists({
      user: user._id,
      deviceId: { $ne: deviceId },
    }),
  ]);

  debugLog('OTHER DEVICE CHECK', { otherTrusted, otherHistory: Boolean(otherHistoryExists) });
  if (otherTrusted === 0 && !otherHistoryExists && !forceDeviceVerification) {
    debugLog('FIRST DEVICE LOGIN, COMPLETING SESSION', {
      userId: user._id.toString(),
      deviceId,
    });
    return completeLoginSession(user, req, deviceId, true);
  }

  if (isMicrosoftBrowser(payload.browser) && !forceDeviceVerification) {
    debugLog('MICROSOFT BROWSER NO OTP, COMPLETING SESSION', { browser: payload.browser });
    return completeLoginSession(user, req, deviceId, true);
  }

  if (payload.browser === 'Google Chrome') {
    console.log('CHROME OTP FLOW HIT', {
      email: user.email,
      deviceId,
      browser: payload.browser,
      userAgent: req.body?.userAgent || req.headers['user-agent'] || '',
    });
  }

  debugLog('NEW DEVICE DETECTED, GENERATING OTP', {
    userId: user._id.toString(),
    email: user.email,
    deviceId,
  });
  const code = generateOtpCode();
  console.log('OTP GENERATION', {
    userId: user._id.toString(),
    email: user.email,
    deviceId,
  });
  const pendingSessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = getOtpExpiresAt();

  await LoginDeviceOtp.deleteMany({ user: user._id, verified: false });
  await LoginDeviceOtp.create({
    user: user._id,
    deviceId,
    pendingSessionId,
    code,
    expiresAt,
    browser: payload.browser,
    deviceType: payload.deviceType,
    deviceName: payload.deviceName,
    operatingSystem: payload.operatingSystem,
    ipAddress: payload.ipAddress,
    location: payload.location,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const emailConfigured = isEmailConfigured();

  // In production, email misconfiguration should fail fast.
  if (isProd && !emailConfigured) {
    const err = new Error('Failed to send OTP email. Email service not configured.');
    err.statusCode = 502;
    throw err;
  }

  // Fire-and-forget OTP email sending so login API response is not blocked by SMTP latency.
  if (emailConfigured) {
    setImmediate(async () => {
      try {
        await sendOtpEmail(user.email, code, 'device_login', user.name);
      } catch (error) {
        // sendOtpEmail already logs failures; this is just a safety net.
        console.error('OTP EMAIL ASYNC TASK FAILED', {
          toEmail: user.email,
          error: error?.message || String(error),
        });
      }
    });
  }

  console.log('OTP FLOW TIME', {
    ms: Date.now() - flowStartAt,
    email: user.email,
  });

  const response = {
    success: true,
    requiresDeviceVerification: true,
    pendingSessionId,
    message: emailConfigured
      ? `New device detected. Enter the code sent to ${user.email}.`
      : 'New device detected. Enter the verification code (see demo OTP in development).',
    deviceLabel: `${payload.browser} · ${payload.deviceName}`,
    emailHint: user.email,
    otpChannel: 'email',
    otpSent: emailConfigured || !isProd,
    otpSendDeferred: Boolean(emailConfigured),
  };

  if (forceDeviceVerification && process.env.NODE_ENV !== 'production') {
    response.demoForced = true;
  }

  // Development convenience: if email isn't configured, show OTP on screen.
  if (!emailConfigured && !isProd) {
    response.demoOtp = code;
    response.demoNote =
      'Development mode: OTP shown below because email is not configured.';
  }

  return response;
};

const verifyDeviceLoginOtp = async ({ pendingSessionId, otp, trustDevice }, userId) => {
  const record = await LoginDeviceOtp.findOne({
    pendingSessionId,
    user: userId,
    verified: false,
  });

  if (!record) {
    const err = new Error('Verification session expired. Please log in again.');
    err.statusCode = 400;
    throw err;
  }

  if (new Date() > record.expiresAt) {
    const err = new Error('OTP has expired. Please log in again.');
    err.statusCode = 400;
    throw err;
  }

  if (record.code !== String(otp).trim()) {
    const err = new Error('Invalid OTP. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  record.verified = true;
  await record.save();

  const User = require('../models/User');
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const token = generateToken(user._id);
  const shouldTrust = trustDevice !== false;

  const payload = {
    browser: record.browser,
    deviceType: record.deviceType,
    deviceName: record.deviceName,
    operatingSystem: record.operatingSystem,
    ipAddress: record.ipAddress,
    location: record.location,
  };

  if (shouldTrust) {
    await upsertTrustedDevice(user._id, record.deviceId, payload);
  }

  await recordLoginHistory(user._id, record.deviceId, sessionId, payload, shouldTrust);

  return {
    success: true,
    message: shouldTrust
      ? 'Device verified and trusted. Login successful.'
      : 'Device verified. Login successful.',
    user: formatUser(user),
    token,
    sessionId,
    trusted: shouldTrust,
  };
};

const getLoginHistoryForUser = async (userId, currentDeviceId, currentSessionId) => {
  const history = await LoginHistory.find({ user: userId })
    .sort({ loginAt: -1 })
    .limit(50)
    .lean();

  const trustedDevices = await TrustedDevice.find({ user: userId }).lean();
  const trustedSet = new Set(trustedDevices.map((d) => d.deviceId));

  return history.map((entry) => ({
    _id: entry._id,
    deviceId: entry.deviceId,
    browser: entry.browser,
    operatingSystem: entry.operatingSystem || 'Unknown',
    deviceType: entry.deviceType,
    deviceName: entry.deviceName,
    device: entry.deviceName,
    ipAddress: entry.ipAddress,
    location: entry.location,
    loginAt: entry.loginAt,
    isTrusted: trustedSet.has(entry.deviceId),
    isCurrent:
      entry.deviceId === currentDeviceId &&
      (!currentSessionId || entry.sessionId === currentSessionId),
  }));
};

const trustDeviceById = async (userId, deviceId) => {
  const latest = await LoginHistory.findOne({ user: userId, deviceId }).sort({
    loginAt: -1,
  });
  if (!latest) {
    const err = new Error('No login record found for this device.');
    err.statusCode = 404;
    throw err;
  }

  await upsertTrustedDevice(userId, deviceId, {
    browser: latest.browser,
    deviceType: latest.deviceType,
    deviceName: latest.deviceName,
    operatingSystem: latest.operatingSystem,
    ipAddress: latest.ipAddress,
    location: latest.location,
  });

  return { success: true, message: 'Device marked as trusted.' };
};

module.exports = {
  completeLoginSession,
  handlePostCredentialLogin,
  verifyDeviceLoginOtp,
  getLoginHistoryForUser,
  trustDeviceById,
};
