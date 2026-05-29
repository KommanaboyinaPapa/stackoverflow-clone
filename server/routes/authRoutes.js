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
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  finalizeForgotPassword,
  cancelForgotPassword,
} = require('../controllers/forgotPasswordController');
const auth = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/verify-device-login (new device OTP)
router.post('/verify-device-login', verifyDeviceLogin);

// Forgot password (public) - OTP flow
router.post('/forgot-password/request-otp', requestForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/finalize', finalizeForgotPassword);
router.post('/forgot-password/cancel', cancelForgotPassword);

// GET /api/auth/profile  (protected – requires valid JWT)
router.get('/profile', auth, getProfile);

// PUT /api/auth/phone — update mobile number (protected)
router.put('/phone', auth, updatePhone);

// GET /api/auth/login-history (protected)
router.get('/login-history', auth, getLoginHistory);

// POST /api/auth/trust-device (protected)
router.post('/trust-device', auth, trustDevice);

module.exports = router;
