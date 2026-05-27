const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updatePhone,
  verifyDeviceLogin,
  getLoginHistory,
  trustDevice,
} = require('../controllers/authController');
const {
  forgotPassword,
  confirmForgotPassword,
} = require('../controllers/forgotPasswordController');
const auth = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/verify-device-login (new device OTP)
router.post('/verify-device-login', verifyDeviceLogin);

// POST /api/auth/forgot-password (public)
router.post('/forgot-password', forgotPassword);

// POST /api/auth/forgot-password/confirm (public)
router.post('/forgot-password/confirm', confirmForgotPassword);

// GET /api/auth/profile  (protected – requires valid JWT)
router.get('/profile', auth, getProfile);

// PUT /api/auth/phone — update mobile number (protected)
router.put('/phone', auth, updatePhone);

// GET /api/auth/login-history (protected)
router.get('/login-history', auth, getLoginHistory);

// POST /api/auth/trust-device (protected)
router.post('/trust-device', auth, trustDevice);

module.exports = router;
