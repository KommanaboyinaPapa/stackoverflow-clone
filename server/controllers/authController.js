const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const { generateToken } = require('../utils/jwt');
const { formatUser } = require('../utils/formatUser');
const { validateRegister, validateLogin } = require('../utils/validators');
const {
  isMobileLoginWindowOpen,
  getMobileLoginWindowStatus,
  MOBILE_LOGIN_MESSAGE,
} = require('../utils/mobileLoginWindow');
const {
  completeLoginSession,
  handlePostCredentialLogin,
  verifyDeviceLoginOtp,
  getLoginHistoryForUser,
  trustDeviceById,
} = require('../utils/loginDeviceHelper');

const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, profileImage, phone } = req.body;

    const validationErrors = validateRegister({ name, email, password });
    if (validationErrors.length) {
      return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
      password: hashedPassword,
      profileImage: profileImage?.trim() || '',
      points: 0,
      friends: [],
    });

    const deviceId = req.body?.deviceId?.trim();
    if (deviceId) {
      const session = await completeLoginSession(user, req, deviceId, true);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: session.user,
        token: session.token,
        sessionId: session.sessionId,
      });
    }

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: formatUser(user),
      token,
    });
  } catch (error) {
    console.error('Register error:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const requestPayload = {
      email: email ? email.toLowerCase().trim() : null,
      deviceId: req.body?.deviceId || null,
      trustDevice: req.body?.trustDevice,
    };
    debugLog('LOGIN API HIT /api/auth/login', requestPayload);

    const validationErrors = validateLogin({ email, password });
    if (validationErrors.length) {
      debugLog('LOGIN VALIDATION FAILED', validationErrors[0]);
      return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
    }

    // Backend-only mobile detection: rely on request User-Agent header (do not trust frontend hints).
    const userAgent = String(req.headers['user-agent'] || '');
    const isMobileRequest = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    console.log('LOGIN DEVICE TYPE DETECTED:', isMobileRequest ? 'MOBILE' : 'DESKTOP');

    if (isMobileRequest) {
      const windowStatus = getMobileLoginWindowStatus();
      console.log('MOBILE TIME WINDOW CHECK:', {
        allowed: windowStatus.open,
        istTime: windowStatus.istTimeLabel,
        window: windowStatus.windowLabel,
      });

      if (!isMobileLoginWindowOpen()) {
        return res.status(403).json({ message: MOBILE_LOGIN_MESSAGE });
      }
    }

    const user = await User.findOne({ email: requestPayload.email }).select('+password');
    if (!user) {
      debugLog('LOGIN USER NOT FOUND', { email: requestPayload.email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    debugLog('LOGIN USER FOUND', { userId: user._id.toString(), email: user.email });
    const isMatch = await bcrypt.compare(password, user.password);
    debugLog('LOGIN PASSWORD MATCH RESULT', { email: user.email, isMatch });
    if (!isMatch) {
      debugLog('LOGIN PASSWORD MISMATCH', { email: user.email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const result = await handlePostCredentialLogin(user, req);
    debugLog('LOGIN SUCCESS', {
      email: user.email,
      requiresDeviceVerification: result.requiresDeviceVerification || false,
      sessionId: result.sessionId ? 'present' : 'none',
    });
    return res.json(result);
  } catch (error) {
    console.error('Login error:', error.stack || error.message);
    if (error.statusCode) {
      debugLog('LOGIN ERROR STATUS', { statusCode: error.statusCode, message: error.message });
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// POST /api/auth/verify-device-login
exports.verifyDeviceLogin = async (req, res) => {
  try {
    const { pendingSessionId, otp, trustDevice } = req.body;

    if (!pendingSessionId || !otp) {
      return res.status(400).json({ message: 'Verification session and OTP are required.' });
    }

    const LoginDeviceOtp = require('../models/LoginDeviceOtp');
    const otpRecord = await LoginDeviceOtp.findOne({
      pendingSessionId,
      verified: false,
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Verification session expired. Please log in again.' });
    }

    const result = await verifyDeviceLoginOtp(
      { pendingSessionId, otp, trustDevice: trustDevice !== false },
      otpRecord.user
    );

    return res.json(result);
  } catch (error) {
    console.error('verifyDeviceLogin error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Device verification failed.' });
  }
};

// GET /api/auth/login-history
exports.getLoginHistory = async (req, res) => {
  try {
    const deviceId = req.query.deviceId || '';
    const sessionId = req.query.sessionId || '';
    const history = await getLoginHistoryForUser(
      req.user._id,
      deviceId,
      sessionId
    );
    res.json({ success: true, history });
  } catch (error) {
    console.error('getLoginHistory error:', error.message);
    res.status(500).json({ message: 'Could not load login history.' });
  }
};

// POST /api/auth/trust-device
exports.trustDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId?.trim()) {
      return res.status(400).json({ message: 'Device ID is required.' });
    }
    const result = await trustDeviceById(req.user._id, deviceId.trim());
    res.json(result);
  } catch (error) {
    console.error('trustDevice error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Could not trust device.' });
  }
};

// GET /api/auth/profile (protected — JWT required)
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'friends',
      'name profileImage points'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const myQuestions = await Question.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('title description tags voteScore answerCount createdAt');

    const myAnswers = await Answer.find({ author: req.user._id })
      .populate('question', 'title')
      .sort({ createdAt: -1 })
      .select('body voteScore createdAt question');

    return res.json({
      success: true,
      user: {
        ...formatUser(user),
        friends: (user.friends || []).map((f) =>
          f._id
            ? {
                id: f._id,
                name: f.name,
                profileImage: formatUser(f).profileImage,
                points: f.points ?? 0,
              }
            : f
        ),
      },
      myQuestions: myQuestions.map((q) => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        tags: q.tags,
        voteScore: q.voteScore ?? 0,
        answerCount: q.answerCount ?? 0,
        createdAt: q.createdAt,
      })),
      myAnswers: myAnswers.map((a) => ({
        _id: a._id,
        body: a.body,
        voteScore: a.voteScore ?? 0,
        createdAt: a.createdAt,
        question: a.question
          ? { _id: a.question._id, title: a.question.title }
          : null,
      })),
      stats: {
        questionsCount: myQuestions.length,
        answersCount: myAnswers.length,
      },
    });
  } catch (error) {
    console.error('Profile error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// PUT /api/auth/phone — update mobile for OTP / profile
exports.updatePhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const trimmed = phone?.trim();

    if (!trimmed) {
      return res.status(400).json({ message: 'Mobile number is required.' });
    }

    if (!/^\+?[\d\s\-()]{8,20}$/.test(trimmed)) {
      return res.status(400).json({
        message: 'Enter a valid mobile number (8–20 digits, may include + prefix).',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const existing = await User.findOne({ phone: trimmed, _id: { $ne: user._id } });
    if (existing) {
      return res.status(400).json({ message: 'This mobile number is already in use.' });
    }

    user.phone = trimmed;
    await user.save();

    return res.json({
      success: true,
      message: 'Mobile number saved successfully.',
      user: formatUser(user),
    });
  } catch (error) {
    console.error('updatePhone error:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This mobile number is already in use.' });
    }
    return res.status(500).json({ message: 'Could not update mobile number.' });
  }
};
