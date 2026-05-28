const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  sendLanguageOtp,
  verifyLanguageOtp,
} = require('../controllers/languageController');

// Route-entry debug log to confirm requests reach backend (runs before auth middleware).
const logRouteHit = (label) => (req, _res, next) => {
  console.log(label);
  next();
};

router.post('/send-otp', logRouteHit('LANGUAGE OTP ROUTE HIT'), auth, sendLanguageOtp);
router.post('/verify-otp', logRouteHit('LANGUAGE OTP VERIFY ROUTE HIT'), auth, verifyLanguageOtp);

module.exports = router;
